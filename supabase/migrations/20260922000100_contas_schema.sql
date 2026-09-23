-- Tabela de segredos compartilhada com o servidor (sem política de RLS: invisível para a API).
create table if not exists public.segredos (nome text primary key, valor text not null);
alter table public.segredos enable row level security;

-- Automação de contas a pagar ("Quita"). Schema próprio, fora da API REST:
-- só é acessível pelas funções public.contas_* que exigem o segredo do servidor.
create schema if not exists contas;
revoke all on schema contas from public, anon, authenticated;

create table contas.carteiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Minha empresa',
  token_painel text not null unique default encode(gen_random_bytes(18), 'hex'),
  telegram_chat_id bigint unique,
  antecedencia_dias int not null default 3 check (antecedencia_dias between 0 and 15),
  demo boolean not null default false,
  criado_em timestamptz not null default now()
);

create table contas.documentos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references contas.carteiras(id) on delete cascade,
  tipo text not null check (tipo in ('boleto', 'arrecadacao', 'nfe', 'outro')),
  origem text not null check (origem in ('telegram', 'upload', 'exemplo', 'texto')),
  fornecedor text not null default '',
  documento_fornecedor text not null default '',
  descricao text not null default '',
  categoria text not null default 'Outros',
  valor_centavos bigint not null default 0 check (valor_centavos >= 0),
  vencimento date,
  linha_digitavel text,
  chave_nfe text,
  status text not null default 'a_pagar' check (status in ('a_pagar', 'pago', 'ignorado')),
  pago_em timestamptz,
  confianca text not null default 'alta' check (confianca in ('alta', 'media', 'baixa')),
  detalhes jsonb not null default '{}'::jsonb,
  arquivo_nome text,
  impressao text not null, -- identidade do documento para não lançar a mesma conta duas vezes
  criado_em timestamptz not null default now(),
  unique (carteira_id, impressao)
);
create index documentos_carteira_venc on contas.documentos (carteira_id, vencimento);

create table contas.execucoes (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid references contas.carteiras(id) on delete cascade,
  documento_id uuid references contas.documentos(id) on delete set null,
  gatilho text not null check (gatilho in ('telegram', 'upload', 'exemplo', 'agendador', 'texto')),
  status text not null check (status in ('sucesso', 'duplicado', 'revisao', 'erro', 'ignorado')),
  resumo text not null default '',
  passos jsonb not null default '[]'::jsonb,
  duracao_ms int not null default 0,
  criado_em timestamptz not null default now()
);
create index execucoes_carteira on contas.execucoes (carteira_id, criado_em desc);

create table contas.lembretes (
  documento_id uuid not null references contas.documentos(id) on delete cascade,
  tipo text not null check (tipo in ('antecedencia', 'vencimento', 'atraso')),
  enviado_em timestamptz not null default now(),
  primary key (documento_id, tipo)
);

alter table contas.carteiras enable row level security;
alter table contas.documentos enable row level security;
alter table contas.execucoes enable row level security;
alter table contas.lembretes enable row level security;

insert into public.segredos (nome, valor) values ('contas', encode(gen_random_bytes(32), 'hex')) on conflict (nome) do nothing;

create or replace function contas.autorizado(p_segredo text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.segredos where nome = 'contas' and valor = p_segredo);
$$;

insert into contas.carteiras (nome, demo, antecedencia_dias) values ('Padaria Pão de Ontem (demonstração)', true, 3);
