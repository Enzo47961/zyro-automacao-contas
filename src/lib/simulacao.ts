import 'server-only';
import { formatarLinhaDigitavel } from './codigos';
import { CONTA_ENERGIA, MODELOS_BOLETO, pdfBoleto, pdfConta, xmlNfeLaticinios } from './exemplos';
import type { EmailRecebido } from './gmail';

/**
 * E-mails da caixa de entrada simulada (/gmail). Os anexos são gerados na hora,
 * com códigos válidos e vencimento relativo a hoje, e passam pelo mesmo caminho
 * de um e-mail real. A `semente` é fixa por visitante: assim o "reenvio" traz
 * exatamente o mesmo boleto e o bloqueio de repetição aparece de verdade.
 */

export const CENARIOS = ['energia', 'moinho', 'nfe', 'internet', 'energia-lembrete', 'moinho-reenvio', 'newsletter'] as const;
export type Cenario = (typeof CENARIOS)[number];

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

export async function emailSimulado(cenario: Cenario, semente: number, agora = Date.now()): Promise<Omit<EmailRecebido, 'id'>> {
  const sufixo = String(semente).padStart(4, '0').slice(-4);
  const energia = () => pdfConta({ ...CONTA_ENERGIA, complemento: `0045871${sufixo}` }, agora);
  const moinho = () => pdfBoleto({ ...MODELOS_BOLETO[0], nossoNumero: `${MODELOS_BOLETO[0].nossoNumero.slice(0, 7)}${sufixo}` }, agora);

  switch (cenario) {
    case 'energia': {
      const { bytes } = await energia();
      return {
        de: 'Energia Paulista <fatura@energiapaulista.com.br>',
        assunto: 'Sua conta de energia chegou',
        corpo: 'Olá! A sua fatura de energia elétrica está disponível em anexo.',
        anexos: [{ nome: 'fatura-energia.pdf', mime: 'application/pdf', base64: b64(bytes) }],
      };
    }
    case 'energia-lembrete': {
      // A mesma conta de luz, agora só com o código no corpo do e-mail.
      const { codigo } = await energia();
      return {
        de: 'Energia Paulista <nao-responda@energiapaulista.com.br>',
        assunto: 'Lembrete: sua fatura vence em breve',
        corpo: `Não esqueça: sua conta de energia vence nos próximos dias.\n\nCódigo para pagamento:\n${formatarLinhaDigitavel(codigo)}\n\nSe já pagou, desconsidere.`,
        anexos: [],
      };
    }
    case 'moinho':
    case 'moinho-reenvio': {
      const { bytes } = await moinho();
      return {
        de: 'Moinho Bom Trigo <financeiro@moinhobomtrigo.com.br>',
        assunto: cenario === 'moinho' ? 'Boleto do pedido 4471 — farinha de trigo' : 'RE: Boleto do pedido 4471 — farinha de trigo (reenvio)',
        corpo: cenario === 'moinho' ? 'Segue o boleto referente ao pedido 4471.' : 'Bom dia! Reenviando o boleto, caso não tenha recebido.',
        anexos: [{ nome: 'boleto-pedido-4471.pdf', mime: 'application/pdf', base64: b64(bytes) }],
      };
    }
    case 'nfe':
      return {
        de: 'Laticínios Serra Azul <nfe@serraazul.com.br>',
        assunto: `NF-e ${48000 + (semente % 9999)} — Laticínios Serra Azul`,
        corpo: 'Segue o XML da nota fiscal eletrônica. Pagamento em 2 parcelas.',
        anexos: [{ nome: `nfe-${48000 + (semente % 9999)}.xml`, mime: 'application/xml', base64: b64(new TextEncoder().encode(xmlNfeLaticinios(agora, 48000 + (semente % 9999)))) }],
      };
    case 'internet': {
      const modelo = MODELOS_BOLETO[1];
      const { bytes } = await pdfBoleto({ ...modelo, nossoNumero: `${modelo.nossoNumero.slice(0, 7)}${sufixo}` }, agora);
      return {
        de: 'FibraNet Telecom <cobranca@fibranet.com.br>',
        assunto: 'Seu boleto da internet está disponível',
        corpo: 'Olá! Segue o boleto da mensalidade da sua internet fibra.',
        anexos: [{ nome: 'boleto-fibranet.pdf', mime: 'application/pdf', base64: b64(bytes) }],
      };
    }
    case 'newsletter':
      return {
        de: 'Loja do Confeiteiro <ofertas@lojadoconfeiteiro.com.br>',
        assunto: 'Só hoje: 20% de desconto em formas e confeitos',
        corpo: 'Aproveite as ofertas da semana! Cupom CONFEITA20 válido até domingo.',
        anexos: [],
      };
  }
}
