import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Acesso ao banco: só pelas funções public.contas_*, que exigem o segredo do
 * servidor. As tabelas ficam no schema `contas`, fora da API REST do Supabase.
 */
const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });

const segredo = () => {
  const valor = process.env.CONTAS_SEGREDO;
  if (!valor) throw new Error('CONTAS_SEGREDO não configurado.');
  return valor;
};

async function rpc<T>(funcao: string, parametros: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(funcao, { p_segredo: segredo(), ...parametros });
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

export type Carteira = {
  id: string;
  nome: string;
  token_painel: string;
  telegram_chat_id: number | null;
  antecedencia_dias: number;
  demo: boolean;
  simulacao: boolean;
  /** Segredo do script do Gmail: só aparece na página de conexão. */
  chave_gmail: string;
  gmail_email: string | null;
  gmail_conectado_em: string | null;
  gmail_verificado_em: string | null;
  criado_em: string;
};

export type TipoLembrete = 'antecedencia' | 'vencimento' | 'atraso';
export type Lembrete = { documento_id: string; tipo: TipoLembrete; canal: 'telegram' | 'email'; enviado_em: string };
export type EmailLido = {
  mensagem_id: string;
  remetente: string;
  assunto: string;
  resultado: 'conta' | 'duplicado' | 'sem_conta';
  documentos: number;
  recebido_em: string;
};

export type StatusConta = 'a_pagar' | 'pago' | 'ignorado';

export type Documento = {
  id: string;
  carteira_id: string;
  tipo: 'boleto' | 'arrecadacao' | 'nfe' | 'outro';
  origem: 'telegram' | 'upload' | 'exemplo' | 'texto' | 'gmail';
  fornecedor: string;
  documento_fornecedor: string;
  descricao: string;
  categoria: string;
  valor_centavos: number;
  vencimento: string | null;
  linha_digitavel: string | null;
  chave_nfe: string | null;
  status: StatusConta;
  pago_em: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  detalhes: Record<string, unknown>;
  arquivo_nome: string | null;
  criado_em: string;
};

export type Passo = { nome: string; status: 'ok' | 'aviso' | 'erro' | 'pulado'; ms: number; detalhe: string };

export type Execucao = {
  id: string;
  carteira_id: string;
  documento_id: string | null;
  gatilho: 'telegram' | 'upload' | 'exemplo' | 'agendador' | 'texto' | 'gmail';
  status: 'sucesso' | 'duplicado' | 'revisao' | 'erro' | 'ignorado';
  resumo: string;
  passos: Passo[];
  duracao_ms: number;
  criado_em: string;
};

export type NovoDocumento = Omit<Documento, 'id' | 'carteira_id' | 'status' | 'pago_em' | 'criado_em'> & {
  impressao: string;
  status?: StatusConta;
  pago_em?: string | null;
  criado_em?: string;
};

export const banco = {
  carteiraPorToken: (token: string) => rpc<Carteira | null>('contas_carteira', { p_token: token }),
  carteiraDemo: () => rpc<Carteira | null>('contas_carteira', { p_demo: true }),
  carteiraPorChat: (chat: number, nome?: string, criar = false) =>
    rpc<Carteira | null>('contas_carteira', { p_chat: chat, p_nome: nome ?? null, p_criar: criar }),
  salvarDocumento: (carteira: string, doc: NovoDocumento) =>
    rpc<{ id: string; duplicado: boolean; status?: StatusConta }>('contas_salvar', { p_carteira: carteira, p_doc: doc }),
  registrarExecucao: (exec: Omit<Execucao, 'id' | 'criado_em'> & { criado_em?: string }) => rpc<string>('contas_execucao', { p_exec: exec }),
  painel: (carteira: string) =>
    rpc<{ documentos: Documento[]; execucoes: Execucao[]; lembretes: Lembrete[]; emails: EmailLido[] }>('contas_painel', { p_carteira: carteira }),
  mudarStatus: (carteira: string, documento: string, status: StatusConta) =>
    rpc<Documento>('contas_status', { p_carteira: carteira, p_documento: documento, p_status: status }),
  atualizarCarteira: (carteira: string, nome: string | null, antecedencia: number | null) =>
    rpc<Carteira | null>('contas_atualizar_carteira', { p_carteira: carteira, p_nome: nome, p_antecedencia: antecedencia }),
  lembretesPendentes: (hoje: string) =>
    rpc<Array<{ tipo: 'antecedencia' | 'vencimento' | 'atraso'; chat_id: number; carteira_id: string; token_painel: string; documento: Documento }>>(
      'contas_lembretes_pendentes',
      { p_hoje: hoje },
    ),
  lembreteEnviado: (documento: string, tipo: string) => rpc<void>('contas_lembrete_enviado', { p_documento: documento, p_tipo: tipo }),
  carteirasTelegram: () => rpc<Carteira[]>('contas_carteiras_telegram', {}),
  limparDemo: () => rpc<string>('contas_limpar_demo', {}),

  // Gmail
  criarCarteira: (nome: string, simulacao: boolean) => rpc<Carteira>('contas_criar_carteira', { p_nome: nome, p_simulacao: simulacao }),
  carteiraPorChaveGmail: (chave: string) => rpc<Carteira | null>('contas_carteira_gmail', { p_chave: chave }),
  gmailPing: (carteira: string, email: string | null) => rpc<void>('contas_gmail_ping', { p_carteira: carteira, p_email: email }),
  emailLido: (carteira: string, mensagem: string) => rpc<EmailLido | null>('contas_email_lido', { p_carteira: carteira, p_mensagem: mensagem }),
  registrarEmail: (carteira: string, email: Omit<EmailLido, 'recebido_em'>) =>
    rpc<void>('contas_registrar_email', {
      p_carteira: carteira,
      p_mensagem: email.mensagem_id,
      p_remetente: email.remetente,
      p_assunto: email.assunto,
      p_resultado: email.resultado,
      p_documentos: email.documentos,
    }),
  avisosEmail: (carteira: string, hoje: string) =>
    rpc<Array<{ tipo: TipoLembrete; documento: Documento }>>('contas_avisos_email', { p_carteira: carteira, p_hoje: hoje }),
  avisoEmailEnviado: (carteira: string, documento: string, tipo: TipoLembrete) =>
    rpc<void>('contas_aviso_email_enviado', { p_carteira: carteira, p_documento: documento, p_tipo: tipo }),
  limparSimulacoes: () => rpc<number>('contas_limpar_simulacoes', {}),
};
