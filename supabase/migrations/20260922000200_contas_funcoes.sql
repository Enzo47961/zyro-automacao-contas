-- Carteira por token do painel, por chat do Telegram (criando no /start) ou a de demonstração.
create or replace function public.contas_carteira(
  p_segredo text, p_token text default null, p_chat bigint default null, p_nome text default null,
  p_criar boolean default false, p_demo boolean default false
) returns json language plpgsql security definer set search_path = '' as $$
declare v contas.carteiras;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  if p_demo then
    select * into v from contas.carteiras where demo order by criado_em limit 1;
  elsif p_token is not null then
    select * into v from contas.carteiras where token_painel = p_token;
  elsif p_chat is not null then
    select * into v from contas.carteiras where telegram_chat_id = p_chat;
    if not found and p_criar then
      insert into contas.carteiras (nome, telegram_chat_id)
      values (coalesce(nullif(btrim(p_nome), ''), 'Minha empresa'), p_chat) returning * into v;
    end if;
  end if;
  if v.id is null then return null; end if;
  return row_to_json(v);
end;
$$;

create or replace function public.contas_salvar(p_segredo text, p_carteira uuid, p_doc jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_existente contas.documentos;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  select * into v_existente from contas.documentos where carteira_id = p_carteira and impressao = p_doc->>'impressao';
  if found then
    return json_build_object('id', v_existente.id, 'duplicado', true, 'status', v_existente.status);
  end if;
  insert into contas.documentos (carteira_id, tipo, origem, fornecedor, documento_fornecedor, descricao, categoria,
                                 valor_centavos, vencimento, linha_digitavel, chave_nfe, confianca, detalhes, arquivo_nome,
                                 impressao, status, pago_em, criado_em)
  values (p_carteira, p_doc->>'tipo', p_doc->>'origem', coalesce(p_doc->>'fornecedor', ''), coalesce(p_doc->>'documento_fornecedor', ''),
          coalesce(p_doc->>'descricao', ''), coalesce(p_doc->>'categoria', 'Outros'), coalesce((p_doc->>'valor_centavos')::bigint, 0),
          (p_doc->>'vencimento')::date, p_doc->>'linha_digitavel', p_doc->>'chave_nfe', coalesce(p_doc->>'confianca', 'alta'),
          coalesce(p_doc->'detalhes', '{}'::jsonb), p_doc->>'arquivo_nome', p_doc->>'impressao',
          coalesce(p_doc->>'status', 'a_pagar'), (p_doc->>'pago_em')::timestamptz, coalesce((p_doc->>'criado_em')::timestamptz, now()))
  returning id into v_id;
  return json_build_object('id', v_id, 'duplicado', false);
end;
$$;

create or replace function public.contas_execucao(p_segredo text, p_exec jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  insert into contas.execucoes (carteira_id, documento_id, gatilho, status, resumo, passos, duracao_ms, criado_em)
  values ((p_exec->>'carteira_id')::uuid, (p_exec->>'documento_id')::uuid, p_exec->>'gatilho', p_exec->>'status',
          coalesce(p_exec->>'resumo', ''), coalesce(p_exec->'passos', '[]'::jsonb), coalesce((p_exec->>'duracao_ms')::int, 0),
          coalesce((p_exec->>'criado_em')::timestamptz, now()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.contas_painel(p_segredo text, p_carteira uuid)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  return json_build_object(
    'documentos', coalesce((select json_agg(d order by d.vencimento nulls last, d.criado_em)
                              from contas.documentos d where d.carteira_id = p_carteira and d.status <> 'ignorado'), '[]'::json),
    'execucoes', coalesce((select json_agg(e order by e.criado_em desc)
                             from (select * from contas.execucoes where carteira_id = p_carteira order by criado_em desc limit 40) e), '[]'::json)
  );
end;
$$;

create or replace function public.contas_status(p_segredo text, p_carteira uuid, p_documento uuid, p_status text)
returns json language plpgsql security definer set search_path = '' as $$
declare v contas.documentos;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  if p_status not in ('a_pagar', 'pago', 'ignorado') then raise exception 'STATUS_INVALIDO'; end if;
  update contas.documentos
     set status = p_status, pago_em = case when p_status = 'pago' then now() else null end
   where id = p_documento and carteira_id = p_carteira
  returning * into v;
  if not found then raise exception 'DOCUMENTO_INEXISTENTE'; end if;
  return row_to_json(v);
end;
$$;

create or replace function public.contas_atualizar_carteira(p_segredo text, p_carteira uuid, p_nome text, p_antecedencia int)
returns json language plpgsql security definer set search_path = '' as $$
declare v contas.carteiras;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  update contas.carteiras
     set nome = coalesce(nullif(btrim(p_nome), ''), nome),
         antecedencia_dias = coalesce(p_antecedencia, antecedencia_dias)
   where id = p_carteira and not demo
  returning * into v;
  return row_to_json(v);
end;
$$;

-- Lembretes do dia: antecedência configurada, dia do vencimento e 1 dia de atraso. Nunca repete.
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
       and not exists (select 1 from contas.lembretes l where l.documento_id = d.id and l.tipo = t.tipo)
  ), '[]'::json);
end;
$$;

create or replace function public.contas_lembrete_enviado(p_segredo text, p_documento uuid, p_tipo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  insert into contas.lembretes (documento_id, tipo) values (p_documento, p_tipo) on conflict do nothing;
end;
$$;

-- Carteiras com Telegram, para o resumo semanal.
create or replace function public.contas_carteiras_telegram(p_segredo text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  return coalesce((select json_agg(row_to_json(c)) from contas.carteiras c where c.telegram_chat_id is not null), '[]'::json);
end;
$$;

create or replace function public.contas_limpar_demo(p_segredo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not contas.autorizado(p_segredo) then raise exception 'NAO_AUTORIZADO'; end if;
  select id into v from contas.carteiras where demo order by criado_em limit 1;
  delete from contas.execucoes where carteira_id = v;
  delete from contas.documentos where carteira_id = v;
  return v;
end;
$$;

revoke all on function contas.autorizado(text) from public, anon, authenticated;
