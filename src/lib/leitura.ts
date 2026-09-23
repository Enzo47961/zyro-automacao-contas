import 'server-only';
import { XMLParser } from 'fast-xml-parser';
import { soDigitos } from './codigos';

export type ConteudoLido =
  | { formato: 'pdf'; texto: string; paginas: number }
  | { formato: 'xml-nfe'; nfe: NfeXml }
  | { formato: 'texto'; texto: string }
  | { formato: 'imagem' }
  | { formato: 'desconhecido'; motivo: string };

export type NfeXml = {
  chave: string;
  numero: string;
  emissao: string | null;
  emitente: string;
  cnpjEmitente: string;
  valorTotalCentavos: number;
  duplicatas: Array<{ numero: string; vencimento: string; valorCentavos: number }>;
  itens: string[];
};

const LIMITE_BYTES = 8 * 1024 * 1024;

const reaisParaCentavos = (valor: unknown) => Math.round(Number(String(valor ?? '0').replace(',', '.')) * 100);

export async function lerConteudo(arquivo: { nome: string; mime: string; bytes: Uint8Array }): Promise<ConteudoLido> {
  if (arquivo.bytes.byteLength > LIMITE_BYTES) return { formato: 'desconhecido', motivo: 'arquivo maior que 8 MB' };
  const cabecalho = new TextDecoder('latin1').decode(arquivo.bytes.slice(0, 512));

  if (cabecalho.includes('%PDF-')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(arquivo.bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { formato: 'pdf', texto: text, paginas: totalPages };
  }

  if (/^image\//.test(arquivo.mime) || /\.(jpe?g|png|webp|heic)$/i.test(arquivo.nome)) return { formato: 'imagem' };

  const texto = new TextDecoder('utf-8').decode(arquivo.bytes);
  if (/<(nfeProc|NFe)[\s>]/.test(texto)) {
    const nfe = lerXmlNfe(texto);
    return nfe ? { formato: 'xml-nfe', nfe } : { formato: 'desconhecido', motivo: 'XML de NF-e incompleto' };
  }
  if (/\.txt$/i.test(arquivo.nome) || arquivo.mime.startsWith('text/')) return { formato: 'texto', texto };
  return { formato: 'desconhecido', motivo: 'formato não suportado (envie PDF, XML de NF-e ou a linha digitável)' };
}

/** XML da NF-e (nfeProc ou NFe): emitente, total e as duplicatas — cada duplicata é uma conta a pagar. */
export function lerXmlNfe(xml: string): NfeXml | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', removeNSPrefix: true, parseTagValue: false });
  const raiz = parser.parse(xml);
  const inf = raiz?.nfeProc?.NFe?.infNFe ?? raiz?.NFe?.infNFe;
  if (!inf) return null;

  const chave = soDigitos(String(inf['@Id'] ?? raiz?.nfeProc?.protNFe?.infProt?.chNFe ?? ''));
  const lista = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const duplicatas = lista(inf.cobr?.dup).map((d: Record<string, unknown>) => ({
    numero: String(d.nDup ?? ''),
    vencimento: String(d.dVenc ?? '').slice(0, 10),
    valorCentavos: reaisParaCentavos(d.vDup),
  }));

  return {
    chave,
    numero: String(inf.ide?.nNF ?? ''),
    emissao: String(inf.ide?.dhEmi ?? inf.ide?.dEmi ?? '').slice(0, 10) || null,
    emitente: String(inf.emit?.xFant ?? inf.emit?.xNome ?? '').trim(),
    cnpjEmitente: soDigitos(String(inf.emit?.CNPJ ?? inf.emit?.CPF ?? '')),
    valorTotalCentavos: reaisParaCentavos(inf.total?.ICMSTot?.vNF),
    duplicatas: duplicatas.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.vencimento) && d.valorCentavos > 0),
    itens: lista(inf.det).slice(0, 5).map((d: Record<string, Record<string, unknown>>) => String(d.prod?.xProd ?? '')).filter(Boolean),
  };
}

/**
 * Nome e CNPJ do beneficiário impressos no boleto. Os layouts variam por banco,
 * então procuramos o rótulo "Beneficiário"/"Cedente" e o primeiro CNPJ perto dele.
 */
export function extrairBeneficiario(texto: string): { nome: string; cnpj: string } | null {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cnpjRegex = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const rotulo = /^(benefici[aá]rio|cedente)\b[:\s-]*/i.exec(linha);
    if (!rotulo) continue;
    const resto = linha.slice(rotulo[0].length).trim();
    const candidato = (resto && !/^(final|cnpj|ag[eê]ncia)/i.test(resto) ? resto : linhas[i + 1] ?? '').replace(cnpjRegex, '').replace(/[-–|,:]\s*$/, '').replace(/\bCNPJ\b[:\s]*/i, '').trim();
    const cnpj = [linha, linhas[i + 1] ?? '', linhas[i + 2] ?? ''].map((l) => cnpjRegex.exec(l)?.[0]).find(Boolean) ?? '';
    if (candidato.length >= 3) return { nome: candidato.slice(0, 80), cnpj: soDigitos(cnpj) };
  }
  return null;
}

/**
 * Fallback para contas de consumo, que não usam o rótulo "Beneficiário": a
 * primeira linha com cara de razão social (Ltda, S.A., EIRELI) no topo do documento.
 */
export function extrairEmpresa(texto: string, ignorar: string[] = []): string | null {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).slice(0, 25);
  const ignorados = ignorar.map((i) => i.toLowerCase());
  for (const linha of linhas) {
    // Linhas do pagador ("Cliente: Padaria X Ltda") não são o fornecedor.
    if (/^(cliente|pagador|sacado|destinat[aá]rio|documento de demonstra)/i.test(linha)) continue;
    const m = /([A-ZÀ-Ú][\wÀ-ú&.,' -]{2,70}?\b(?:Ltda|S\.?\/?A\.?|EIRELI|Cia\.?))(?=\W|$)/.exec(linha);
    if (m && !ignorados.some((i) => m[1].toLowerCase().includes(i))) return m[1].replace(/^(cliente|pagador|sacado)\s*:\s*/i, '').trim();
  }
  return null;
}
