import 'server-only';
import { banco, type Carteira, type Documento } from './banco';
import { formatarLinhaDigitavel } from './codigos';
import { hojeBrasilia } from './exemplos';
import { escapar, processar } from './pipeline';

/** Cliente mínimo da Bot API do Telegram (HTTPS puro, sem biblioteca). */
const token = () => {
  const valor = process.env.TELEGRAM_BOT_TOKEN;
  if (!valor) throw new Error('TELEGRAM_BOT_TOKEN não configurado.');
  return valor;
};

export async function telegram<T = unknown>(metodo: string, corpo: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
  });
  const dados = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!dados.ok) throw new Error(`Telegram ${metodo}: ${dados.description}`);
  return dados.result;
}

type Botao = { text: string; callback_data?: string; url?: string };

export const enviar = (chat: number, texto: string, botoes?: Botao[][]) =>
  telegram('sendMessage', {
    chat_id: chat,
    text: texto,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(botoes ? { reply_markup: { inline_keyboard: botoes } } : {}),
  });

const LIMITE_ARQUIVO = 8 * 1024 * 1024;

async function baixar(fileId: string): Promise<Uint8Array> {
  const arquivo = await telegram<{ file_path: string; file_size?: number }>('getFile', { file_id: fileId });
  if ((arquivo.file_size ?? 0) > LIMITE_ARQUIVO) throw new Error('arquivo grande demais');
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${arquivo.file_path}`, { signal: AbortSignal.timeout(20_000) });
  return new Uint8Array(await res.arrayBuffer());
}

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'sem data');

export const linkPainel = (carteira: Pick<Carteira, 'token_painel'>) => `${process.env.APP_URL ?? ''}/p/${carteira.token_painel}`;

/** Botões de uma conta: marcar como paga e ver a linha digitável para copiar. */
export function botoesConta(doc: Pick<Documento, 'id' | 'linha_digitavel'>, carteira: Pick<Carteira, 'token_painel'>): Botao[][] {
  const linha: Botao[] = [{ text: '💸 Marcar como paga', callback_data: `pago:${doc.id}` }];
  if (doc.linha_digitavel) linha.push({ text: '📋 Linha digitável', callback_data: `linha:${doc.id}` });
  return [linha, [{ text: '📊 Abrir painel', url: linkPainel(carteira) }]];
}

const AJUDA = [
  '<b>Como usar</b>',
  '• Encaminhe o <b>PDF do boleto</b>, a <b>conta de consumo</b> ou o <b>XML da NF-e</b>.',
  '• Ou cole aqui a <b>linha digitável</b> (os números do boleto).',
  '',
  'Eu confiro os dígitos verificadores, leio valor e vencimento, evito lançamento duplicado e te lembro antes de vencer.',
  '',
  '/contas — próximas contas a pagar',
  '/painel — link do seu painel',
].join('\n');

type Mensagem = {
  chat: { id: number; first_name?: string; title?: string };
  from?: { first_name?: string };
  text?: string;
  caption?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  photo?: Array<{ file_id: string; file_size?: number }>;
};
type Callback = { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
export type Atualizacao = { message?: Mensagem; callback_query?: Callback };

export async function tratarAtualizacao(atualizacao: Atualizacao): Promise<void> {
  if (atualizacao.callback_query) return tratarBotao(atualizacao.callback_query);
  const msg = atualizacao.message;
  if (!msg) return;

  const chat = msg.chat.id;
  const nome = msg.chat.title ?? msg.from?.first_name ?? msg.chat.first_name ?? 'Minha empresa';
  const texto = (msg.text ?? msg.caption ?? '').trim();

  const carteira = await banco.carteiraPorChat(chat, nome, true);
  if (!carteira) return;

  if (/^\/start\b/.test(texto)) {
    await enviar(
      chat,
      `Olá, ${escapar(nome)}! 👋\n\nEu sou o <b>ZYRO</b>: cuido das suas contas a pagar.\n\n${AJUDA}\n\nPara testar agora, use um dos boletos de exemplo do site.`,
      [[{ text: '📊 Abrir meu painel', url: linkPainel(carteira) }], [{ text: '📄 Baixar boletos de exemplo', url: `${process.env.APP_URL ?? ''}/#exemplos` }]],
    );
    return;
  }
  if (/^\/(ajuda|help)\b/.test(texto)) return void (await enviar(chat, AJUDA));
  if (/^\/painel\b/.test(texto)) {
    return void (await enviar(chat, 'Seu painel com todas as contas, gráficos e o histórico da automação:', [[{ text: '📊 Abrir painel', url: linkPainel(carteira) }]]));
  }
  if (/^\/contas\b/.test(texto)) return void (await enviar(chat, await resumoContas(carteira), [[{ text: '📊 Abrir painel', url: linkPainel(carteira) }]]));

  // Documento, foto ou linha digitável colada.
  let resultado;
  if (msg.document) {
    try {
      const bytes = await baixar(msg.document.file_id);
      resultado = await processar(
        { tipo: 'arquivo', nome: msg.document.file_name ?? 'documento', mime: msg.document.mime_type ?? '', bytes },
        { carteira, gatilho: 'telegram', origem: 'telegram' },
      );
    } catch {
      return void (await enviar(chat, 'Não consegui baixar esse arquivo (limite de 8 MB). Tente enviar só o boleto.'));
    }
  } else if (msg.photo?.length) {
    resultado = await processar({ tipo: 'arquivo', nome: 'foto.jpg', mime: 'image/jpeg', bytes: new Uint8Array() }, { carteira, gatilho: 'telegram', origem: 'telegram' });
  } else if ((texto.match(/\d/g)?.length ?? 0) >= 44) {
    resultado = await processar({ tipo: 'texto', texto }, { carteira, gatilho: 'texto', origem: 'texto' });
  } else {
    return void (await enviar(chat, `Não entendi 🤔\n\n${AJUDA}`));
  }

  const novos = resultado.documentos.filter((d) => !d.duplicado);
  const botoes = novos.length === 1 ? botoesConta(novos[0], carteira) : [[{ text: '📊 Abrir painel', url: linkPainel(carteira) }]];
  await enviar(chat, resultado.mensagem, botoes);
}

async function tratarBotao(cb: Callback): Promise<void> {
  const [acao, id] = (cb.data ?? '').split(':');
  const chat = cb.message?.chat.id;
  if (!chat || !id) return void (await telegram('answerCallbackQuery', { callback_query_id: cb.id }));
  const carteira = await banco.carteiraPorChat(chat);
  if (!carteira) return void (await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Carteira não encontrada.' }));

  if (acao === 'pago') {
    try {
      const doc = await banco.mudarStatus(carteira.id, id, 'pago');
      await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: `✅ ${doc.fornecedor} marcado como pago` });
      if (cb.message) {
        await telegram('editMessageReplyMarkup', {
          chat_id: chat,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: '✅ Pago', callback_data: 'nada:0' }], [{ text: '📊 Abrir painel', url: linkPainel(carteira) }]] },
        });
      }
    } catch {
      await telegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Conta não encontrada.' });
    }
    return;
  }
  if (acao === 'linha') {
    const { documentos } = await banco.painel(carteira.id);
    const doc = documentos.find((d) => d.id === id);
    await telegram('answerCallbackQuery', { callback_query_id: cb.id });
    if (doc?.linha_digitavel) {
      await enviar(chat, `📋 Linha digitável de <b>${escapar(doc.fornecedor)}</b> (toque para copiar):\n\n<code>${formatarLinhaDigitavel(doc.linha_digitavel)}</code>`);
    }
    return;
  }
  await telegram('answerCallbackQuery', { callback_query_id: cb.id });
}

export async function resumoContas(carteira: Carteira): Promise<string> {
  const { documentos } = await banco.painel(carteira.id);
  const hoje = hojeBrasilia();
  const abertas = documentos.filter((d) => d.status === 'a_pagar').sort((a, b) => (a.vencimento ?? '9').localeCompare(b.vencimento ?? '9'));
  if (!abertas.length) return 'Nenhuma conta em aberto. 🎉 Envie um boleto para começar.';
  const vencidas = abertas.filter((d) => d.vencimento && d.vencimento < hoje);
  const proximas = abertas.filter((d) => !d.vencimento || d.vencimento >= hoje).slice(0, 8);
  const total = abertas.reduce((t, d) => t + d.valor_centavos, 0);
  const linha = (d: Documento) => `• ${dataBr(d.vencimento)} — <b>${escapar(d.fornecedor)}</b> · ${reais(d.valor_centavos)}`;
  return [
    `<b>Contas em aberto</b> · total ${reais(total)}`,
    ...(vencidas.length ? ['', `⚠️ <b>Vencidas (${vencidas.length})</b>`, ...vencidas.map(linha)] : []),
    '',
    '📅 <b>Próximas</b>',
    ...proximas.map(linha),
  ].join('\n');
}
