-- Gmail como porta de entrada. Um script do Google (Apps Script) roda no Gmail da
-- própria pessoa, manda para o ZYRO os e-mails com cara de conta e, no dia certo,
-- busca os avisos para enviar por e-mail a ela mesma. Também há carteiras de
-- simulação, criadas pela página /gmail e apagadas depois de um dia.

alter table contas.carteiras
  add column chave_gmail text unique default encode(gen_random_bytes(24), 'hex'),
  add column gmail_email text,
  add column gmail_conectado_em timestamptz,
  add column gmail_verificado_em timestamptz,
  add column simulacao boolean not null default false;

alter table contas.documentos drop constraint documentos_origem_check,
  add constraint documentos_origem_check check (origem in ('telegram', 'upload', 'exemplo', 'texto', 'gmail'));
alter table contas.execucoes drop constraint execucoes_gatilho_check,
  add constraint execucoes_gatilho_check check (gatilho in ('telegram', 'upload', 'exemplo', 'agendador', 'texto', 'gmail'));

-- O mesmo aviso pode sair por mais de um canal, mas nunca duas vezes no mesmo canal.
alter table contas.lembretes add column canal text not null default 'telegram' check (canal in ('telegram', 'email'));
alter table contas.lembretes drop constraint lembretes_pkey, add primary key (documento_id, tipo, canal);

-- E-mails já lidos: o mesmo e-mail nunca é processado duas vezes.
-- Assunto e remetente só ficam guardados quando o e-mail trazia uma conta.
create table contas.emails (
  carteira_id uuid not null references contas.carteiras(id) on delete cascade,
  mensagem_id text not null,
  remetente text not null default '',
  assunto text not null default '',
  resultado text not null check (resultado in ('conta', 'duplicado', 'sem_conta')),
  documentos int not null default 0,
  recebido_em timestamptz not null default now(),
  primary key (carteira_id, mensagem_id)
);
create index emails_carteira on contas.emails (carteira_id, recebido_em desc);
alter table contas.emails enable row level security;

-- Nova carteira sem Telegram (Gmail real ou simulação), com limite diário contra abuso.
create or replace function public.contas_criar_carteira(p_segredo text, p_nome text, p_simulacao boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v contas.carteiras;
  v_limite int := 60;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  if p_simulacao then v_limite := 400; end if;
  if (select count(*) from contas.carteiras
       where simulacao = p_simulacao and telegram_chat_id is null and not demo
         and criado_em > now() - interval '1 day') >= v_limite then
    raise exception 'LIMITE_DIARIO';
  end if;
  insert into contas.carteiras (nome, simulacao, antecedencia_dias)
  values (coalesce(nullif(btrim(left(p_nome, 60)), ''), 'Minha empresa'), p_simulacao, 3)
  returning * into v;
  return row_to_json(v);
end;
$$;

create or replace function public.contas_carteira_gmail(p_segredo text, p_chave text)
returns json language plpgsql security definer set search_path = '' as $$
declare v contas.carteiras;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  select * into v from contas.carteiras where chave_gmail = p_chave and not demo;
  if v.id is null then return null; end if;
  return row_to_json(v);
end;
$$;

-- O script do Gmail avisa que está vivo (e, na instalação, qual é o endereço).
create or replace function public.contas_gmail_ping(p_segredo text, p_carteira uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  update contas.carteiras
     set gmail_email = coalesce(nullif(btrim(left(p_email, 120)), ''), gmail_email),
         gmail_conectado_em = coalesce(gmail_conectado_em, now()),
         gmail_verificado_em = now()
   where id = p_carteira;
end;
$$;

create or replace function public.contas_email_lido(p_segredo text, p_carteira uuid, p_mensagem text)
returns json language plpgsql security definer set search_path = '' as $$
declare v contas.emails;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  select * into v from contas.emails where carteira_id = p_carteira and mensagem_id = p_mensagem;
  if not found then return null; end if;
  return row_to_json(v);
end;
$$;

create or replace function public.contas_registrar_email(
  p_segredo text, p_carteira uuid, p_mensagem text, p_remetente text, p_assunto text, p_resultado text, p_documentos int
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  insert into contas.emails (carteira_id, mensagem_id, remetente, assunto, resultado, documentos)
  values (p_carteira, left(p_mensagem, 200),
          case when p_resultado = 'sem_conta' then '' else left(coalesce(p_remetente, ''), 160) end,
          case when p_resultado = 'sem_conta' then '' else left(coalesce(p_assunto, ''), 200) end,
          p_resultado, coalesce(p_documentos, 0))
  on conflict do nothing;
  update contas.carteiras set gmail_verificado_em = now() where id = p_carteira;
end;
$$;

-- Avisos por e-mail que já podem sair hoje. Diferente do Telegram (que roda uma vez
-- por dia), aqui vale uma janela: conta que chega 2 dias antes do vencimento, com
-- antecedência de 3, ainda recebe o aviso "vence em 2 dias". Nunca repete.
create or replace function public.contas_avisos_email(p_segredo text, p_carteira uuid, p_hoje date)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  return coalesce((
    select json_agg(json_build_object('tipo', t.tipo, 'documento', row_to_json(d)) order by d.vencimento)
      from contas.documentos d
      join contas.carteiras c on c.id = d.carteira_id
      cross join lateral (
        select 'antecedencia'::text as tipo
         where c.antecedencia_dias > 0 and d.vencimento > p_hoje and d.vencimento <= p_hoje + c.antecedencia_dias
        union all select 'vencimento' where d.vencimento = p_hoje
        union all select 'atraso' where d.vencimento = p_hoje - 1
      ) t
     where d.carteira_id = p_carteira and d.status = 'a_pagar'
       and not exists (select 1 from contas.lembretes l where l.documento_id = d.id and l.tipo = t.tipo and l.canal = 'email')
  ), '[]'::json);
end;
$$;

create or replace function public.contas_aviso_email_enviado(p_segredo text, p_carteira uuid, p_documento uuid, p_tipo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  insert into contas.lembretes (documento_id, tipo, canal)
  select d.id, p_tipo, 'email' from contas.documentos d where d.id = p_documento and d.carteira_id = p_carteira
  on conflict do nothing;
end;
$$;

-- Telegram: só olha os lembretes do próprio canal.
create or replace function public.contas_lembretes_pendentes(p_segredo text, p_hoje date)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  return coalesce((
    select json_agg(json_build_object('tipo', t.tipo, 'chat_id', c.telegram_chat_id, 'carteira_id', c.id,
                                      'token_painel', c.token_painel, 'documento', row_to_json(d)))
      from contas.documentos d
      join contas.carteiras c on c.id = d.carteira_id
      cross join lateral (
        select 'antecedencia'::text as tipo where d.vencimento = p_hoje + c.antecedencia_dias and c.antecedencia_dias > 0
        union all select 'vencimento' where d.vencimento = p_hoje
        union all select 'atraso' where d.vencimento = p_hoje - 1
      ) t
     where d.status = 'a_pagar' and c.telegram_chat_id is not null
       and not exists (select 1 from contas.lembretes l where l.documento_id = d.id and l.tipo = t.tipo and l.canal = 'telegram')
  ), '[]'::json);
end;
$$;

-- Painel: também os avisos já enviados e os últimos e-mails lidos.
create or replace function public.contas_painel(p_segredo text, p_carteira uuid)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  return json_build_object(
    'documentos', coalesce((select json_agg(d order by d.vencimento nulls last, d.criado_em)
                              from contas.documentos d where d.carteira_id = p_carteira and d.status <> 'ignorado'), '[]'::json),
    'execucoes', coalesce((select json_agg(e order by e.criado_em desc)
                             from (select * from contas.execucoes where carteira_id = p_carteira order by criado_em desc limit 40) e), '[]'::json),
    'lembretes', coalesce((select json_agg(json_build_object('documento_id', l.documento_id, 'tipo', l.tipo, 'canal', l.canal, 'enviado_em', l.enviado_em))
                             from contas.lembretes l join contas.documentos d on d.id = l.documento_id
                            where d.carteira_id = p_carteira), '[]'::json),
    'emails', coalesce((select json_agg(e order by e.recebido_em desc)
                          from (select * from contas.emails where carteira_id = p_carteira order by recebido_em desc limit 30) e), '[]'::json)
  );
end;
$$;

create or replace function public.contas_limpar_simulacoes(p_segredo text)
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  delete from contas.carteiras where simulacao and criado_em < now() - interval '1 day';
  get diagnostics v = row_count;
  return v;
end;
$$;

