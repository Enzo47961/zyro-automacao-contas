import 'server-only';
import { banco, type Carteira, type Documento, type Execucao, type TipoLembrete } from './banco';
import { formatarLinhaDigitavel } from './codigos';
import { hojeBrasilia } from './exemplos';
import { tituloAviso } from './avisos';
import { escapar, processar, type Resultado } from './pipeline';

/**
 * Gmail como porta de entrada. O script do Google que roda no Gmail da pessoa
 * manda cada e-mail com cara de conta para cá; aqui ele passa pelo MESMO pipeline
 * do Telegram. Duas travas contra repetição:
 *   1. o mesmo e-mail (id do Gmail) nunca é lido duas vezes;
 *   2. a mesma conta que chega em outro e-mail (reenvio, lembrete da empresa com
 *      a linha digitável no corpo) cai na impressão digital do documento.
 */

export type EmailRecebido = {
  id: string;
  de: string;
  assunto: string;
  corpo: string;
  anexos: Array<{ nome: string; mime: string; base64: string }>;
};

export type ResultadoEmail = {
  resultado: 'conta' | 'duplicado' | 'sem_conta' | 'ja_lido';
  documentos: Array<Pick<Documento, 'id' | 'fornecedor' | 'valor_centavos' | 'vencimento' | 'categoria' | 'descricao'> & { duplicado: boolean }>;
  execucoes: Array<Pick<Execucao, 'status' | 'resumo' | 'passos' | 'duracao_ms'>>;
};

/** Os avisos que o próprio ZYRO manda não podem voltar como "conta nova". */
export const PREFIXO_AVISO = 'Aviso ZYRO';

const LIMITE_ANEXOS = 3 * 1024 * 1024;

export async function carteiraDoScript(request: Request): Promise<Carteira | null> {
  const chave = /^Bearer ([a-f0-9]{48})$/.exec(request.headers.get('authorization') ?? '')?.[1];
  return chave ? banco.carteiraPorChaveGmail(chave) : null;
}

const nomeRemetente = (de: string) => de.replace(/<[^>]*>/, '').replace(/"/g, '').trim() || de;

export async function receberEmail(carteira: Carteira, email: EmailRecebido, agora = Date.now()): Promise<ResultadoEmail> {
  const id = email.id.slice(0, 200);
  if (await banco.emailLido(carteira.id, id)) return { resultado: 'ja_lido', documentos: [], execucoes: [] };

  const vazio = (resultado: ResultadoEmail['resultado']): ResultadoEmail => ({ resultado, documentos: [], execucoes: [] });
  if (email.assunto.startsWith(PREFIXO_AVISO)) return vazio('sem_conta');

  const de = nomeRemetente(email.de).slice(0, 80);
  const assunto = email.assunto.slice(0, 120);
  const base = { carteira, gatilho: 'gmail' as const, origem: 'gmail' as const, agora, ignorarSemConta: true };
  const saida: ResultadoEmail = vazio('sem_conta');

  let usados = 0;
  for (const anexo of email.anexos.slice(0, 5)) {
    if (!/\.(pdf|xml)$/i.test(anexo.nome) && !/pdf|xml/i.test(anexo.mime)) continue;
    const bytes = new Uint8Array(Buffer.from(anexo.base64, 'base64'));
    usados += bytes.byteLength;
    if (usados > LIMITE_ANEXOS) break;
    const r = await processar(
      { tipo: 'arquivo', nome: anexo.nome.slice(0, 120), mime: anexo.mime, bytes },
      { ...base, descricaoEntrada: `E-mail de ${de} · “${assunto}” · anexo ${anexo.nome}` },
    );
    if (r.documentos.length) {
      saida.documentos.push(...r.documentos.map(resumir));
      saida.execucoes.push(r.execucao);
    }
  }

  // Sem conta nos anexos: muitas empresas mandam a linha digitável no corpo do e-mail.
  if (!saida.documentos.length && (email.corpo.match(/\d/g)?.length ?? 0) >= 44) {
    const r = await processar({ tipo: 'texto', texto: email.corpo.slice(0, 20_000) }, { ...base, descricaoEntrada: `E-mail de ${de} · “${assunto}” · código no corpo do e-mail` });
    if (r.documentos.length) {
      saida.documentos.push(...r.documentos.map(resumir));
      saida.execucoes.push(r.execucao);
    }
  }

  if (saida.documentos.length) saida.resultado = saida.documentos.some((d) => !d.duplicado) ? 'conta' : 'duplicado';
  await banco.registrarEmail(carteira.id, { mensagem_id: id, remetente: de, assunto, resultado: saida.resultado === 'ja_lido' ? 'sem_conta' : saida.resultado, documentos: saida.documentos.length });
  return saida;
}

function resumir(d: Resultado['documentos'][number]): ResultadoEmail['documentos'][number] {
  return {
    id: d.id,
    fornecedor: d.fornecedor,
    valor_centavos: d.valor_centavos,
    vencimento: d.vencimento,
    categoria: d.categoria,
    descricao: d.descricao,
    duplicado: d.duplicado,
  };
}

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** O e-mail de aviso que o script manda para a própria pessoa (e o Gmail notifica no celular). */
export function montarAviso(tipo: TipoLembrete, d: Documento, carteira: Pick<Carteira, 'token_painel'>, hoje = hojeBrasilia()) {
  const titulo = tituloAviso(tipo, d.vencimento ?? hoje, hoje);
  const painel = `${process.env.APP_URL ?? ''}/p/${carteira.token_painel}`;
  const linha = d.linha_digitavel ? formatarLinhaDigitavel(d.linha_digitavel) : null;
  const assunto = `${PREFIXO_AVISO} · ${titulo}: ${d.fornecedor} · ${reais(d.valor_centavos)}`;
  const texto = [
    `${titulo}: ${d.fornecedor}`,
    `${reais(d.valor_centavos)} · vencimento ${dataBr(d.vencimento)}`,
    d.descricao,
    linha ? `\nLinha digitável: ${linha}` : '',
    `\nPainel: ${painel}`,
  ]
    .filter(Boolean)
    .join('\n');
  const cor = tipo === 'antecedencia' ? '#c8f04d' : tipo === 'vencimento' ? '#e8a317' : '#d9412f';
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #d0d8d1;border-radius:14px;overflow:hidden">
<div style="background:#061b11;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">⚡ ZYRO <span style="float:right;background:${cor};color:#061b11;border-radius:99px;padding:2px 10px;font-size:13px">${escapar(titulo)}</span></div>
<div style="padding:20px;color:#141b16">
<p style="margin:0;font-size:13px;color:#5d6d62">${escapar(d.categoria)}</p>
<p style="margin:4px 0 0;font-size:20px;font-weight:bold">${escapar(d.fornecedor)}</p>
<p style="margin:10px 0 0;font-size:26px;font-weight:bold">${reais(d.valor_centavos)}</p>
<p style="margin:2px 0 0;color:#46554a">vencimento ${dataBr(d.vencimento)}${d.descricao ? ` · ${escapar(d.descricao)}` : ''}</p>
${linha ? `<p style="margin:16px 0 4px;font-size:12px;color:#5d6d62">Linha digitável</p><p style="margin:0;font-family:monospace;font-size:14px;background:#f3f5f2;padding:10px;border-radius:8px">${linha}</p>` : ''}
<p style="margin:20px 0 0"><a href="${painel}" style="background:#0d3b25;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:bold">Abrir no painel</a></p>
</div></div>`;
  return { assunto, texto, html };
}
