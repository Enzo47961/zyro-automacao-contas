import 'server-only';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { cnpjFormatado, formatarLinhaDigitavel, gerarArrecadacao, gerarChaveNfe, gerarLinhaDigitavel, lerBoleto, modulo11Padrao } from './codigos';

/**
 * Documentos de exemplo, gerados na hora com datas relativas a hoje — assim
 * nunca "vencem" na demonstração. Empresas e CNPJs são fictícios, e cada
 * arquivo traz a marca "DOCUMENTO DE DEMONSTRAÇÃO — SEM VALOR".
 */

const DIA_MS = 86_400_000;
export const hojeBrasilia = (agora = Date.now()) => new Date(agora - 3 * 3_600_000).toISOString().slice(0, 10);
export const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** CNPJ fictício com dígitos verificadores válidos (base de 8 dígitos + filial 0001). */
export function cnpjFicticio(base: string): string {
  const doze = `${base.padStart(8, '0').slice(0, 8)}0001`;
  const dv = (n: string, pesos: number[]) => {
    const r = [...n].reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(doze, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(`${doze}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${doze}${d1}${d2}`;
}

export const PAGADOR = { nome: 'Padaria Pão de Ontem Ltda', cnpj: cnpjFicticio('41852963') };

export type ModeloBoleto = {
  arquivo: string;
  titulo: string;
  fornecedor: string;
  cnpjBase: string;
  banco: string;
  valorCentavos: number;
  diasParaVencer: number;
  descricao: string;
  nossoNumero: string;
};

export const MODELOS_BOLETO: ModeloBoleto[] = [
  { arquivo: 'boleto-moinho-bom-trigo.pdf', titulo: 'Boleto · farinha de trigo', fornecedor: 'Moinho Bom Trigo Ltda', cnpjBase: '27463819', banco: '237', valorCentavos: 184250, diasParaVencer: 5, descricao: 'Farinha de trigo tipo 1 — 50 sacos', nossoNumero: '09123456789' },
  { arquivo: 'boleto-fibranet.pdf', titulo: 'Boleto · internet', fornecedor: 'FibraNet Telecom Ltda', cnpjBase: '33120987', banco: '341', valorCentavos: 14990, diasParaVencer: 12, descricao: 'Internet fibra 500 Mega — mensalidade', nossoNumero: '17900101043' },
];

const COR = { tinta: rgb(0.1, 0.1, 0.12), cinza: rgb(0.42, 0.42, 0.46), linha: rgb(0.78, 0.78, 0.8), aviso: rgb(0.75, 0.18, 0.12) };

/** Código de barras Intercalado 2 de 5 (padrão dos boletos brasileiros). */
function desenharBarras(pagina: PDFPage, codigo: string, x: number, y: number, altura: number) {
  const padroes = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];
  const fino = 0.95;
  const grosso = fino * 3;
  const larg = (c: string) => (c === 'w' ? grosso : fino);
  let cursor = x;
  const barra = (w: number) => {
    pagina.drawRectangle({ x: cursor, y, width: w, height: altura, color: COR.tinta });
    cursor += w;
  };
  // Início: barra-espaço-barra-espaço finos.
  barra(fino); cursor += fino; barra(fino); cursor += fino;
  for (let i = 0; i < codigo.length; i += 2) {
    const barras = padroes[Number(codigo[i])];
    const espacos = padroes[Number(codigo[i + 1])];
    for (let j = 0; j < 5; j += 1) {
      barra(larg(barras[j]));
      cursor += larg(espacos[j]);
    }
  }
  // Fim: barra grossa, espaço fino, barra fina.
  barra(grosso); cursor += fino; barra(fino);
}

function campo(pagina: PDFPage, fontes: { normal: PDFFont; negrito: PDFFont }, rotulo: string, valor: string, x: number, y: number, w: number) {
  pagina.drawRectangle({ x, y, width: w, height: 30, borderColor: COR.linha, borderWidth: 0.6 });
  pagina.drawText(rotulo, { x: x + 4, y: y + 20, size: 6.5, font: fontes.normal, color: COR.cinza });
  pagina.drawText(valor, { x: x + 4, y: y + 6, size: 9.5, font: fontes.negrito, color: COR.tinta });
}

const reaisBr = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const dataBr = (d: string) => d.split('-').reverse().join('/');

export async function pdfBoleto(modelo: ModeloBoleto, agora = Date.now()): Promise<{ bytes: Uint8Array; linha: string }> {
  const vencimento = somarDias(hojeBrasilia(agora), modelo.diasParaVencer);
  const linha = gerarLinhaDigitavel({ banco: modelo.banco, valorCentavos: modelo.valorCentavos, vencimento, campoLivre: `${modelo.nossoNumero}${modelo.cnpjBase}000` });
  const lido = lerBoleto(linha, agora);
  if (!lido.ok) throw new Error('linha digitável de exemplo inválida');

  const doc = await PDFDocument.create();
  doc.setTitle(`${modelo.titulo} (demonstração)`);
  const pagina = doc.addPage([595, 842]);
  const fontes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold) };
  const cnpj = cnpjFicticio(modelo.cnpjBase);
  const nomeBanco = lido.boleto.bancoNome;

  pagina.drawText('DOCUMENTO DE DEMONSTRAÇÃO — SEM VALOR — EMPRESAS FICTÍCIAS', { x: 40, y: 800, size: 8, font: fontes.negrito, color: COR.aviso });

  // Recibo do pagador
  pagina.drawText('Recibo do Pagador', { x: 40, y: 770, size: 13, font: fontes.negrito, color: COR.tinta });
  pagina.drawText(`Beneficiário: ${modelo.fornecedor}`, { x: 40, y: 748, size: 10, font: fontes.normal });
  pagina.drawText(`CNPJ: ${cnpjFormatado(cnpj)}`, { x: 40, y: 734, size: 10, font: fontes.normal });
  pagina.drawText(`Pagador: ${PAGADOR.nome} — CNPJ ${cnpjFormatado(PAGADOR.cnpj)}`, { x: 40, y: 718, size: 10, font: fontes.normal });
  pagina.drawText(`Referente a: ${modelo.descricao}`, { x: 40, y: 702, size: 10, font: fontes.normal });
  pagina.drawText(`Vencimento: ${dataBr(vencimento)}     Valor: R$ ${reaisBr(modelo.valorCentavos)}`, { x: 40, y: 686, size: 10, font: fontes.negrito });

  // Linha de corte
  for (let x = 40; x < 555; x += 8) pagina.drawLine({ start: { x, y: 660 }, end: { x: x + 4, y: 660 }, color: COR.linha, thickness: 0.8 });

  // Ficha de compensação
  pagina.drawText(`${nomeBanco}  |  ${modelo.banco}-9  |`, { x: 40, y: 630, size: 13, font: fontes.negrito });
  pagina.drawText(formatarLinhaDigitavel(linha), { x: 200, y: 630, size: 11.5, font: fontes.negrito });
  pagina.drawLine({ start: { x: 40, y: 622 }, end: { x: 555, y: 622 }, color: COR.tinta, thickness: 1.2 });

  campo(pagina, fontes, 'Local de pagamento', 'Pagável em qualquer banco até o vencimento', 40, 588, 380);
  campo(pagina, fontes, 'Vencimento', dataBr(vencimento), 420, 588, 135);
  campo(pagina, fontes, 'Beneficiário', `${modelo.fornecedor} — CNPJ ${cnpjFormatado(cnpj)}`, 40, 558, 380);
  campo(pagina, fontes, 'Nosso número', modelo.nossoNumero, 420, 558, 135);
  campo(pagina, fontes, 'Data do documento', dataBr(somarDias(hojeBrasilia(agora), -3)), 40, 528, 120);
  campo(pagina, fontes, 'Espécie', 'DM', 160, 528, 80);
  campo(pagina, fontes, 'Aceite', 'N', 240, 528, 60);
  campo(pagina, fontes, 'Carteira', '09', 300, 528, 120);
  campo(pagina, fontes, '(=) Valor do documento', `R$ ${reaisBr(modelo.valorCentavos)}`, 420, 528, 135);
  pagina.drawRectangle({ x: 40, y: 448, width: 515, height: 80, borderColor: COR.linha, borderWidth: 0.6 });
  pagina.drawText('Instruções', { x: 44, y: 516, size: 6.5, font: fontes.normal, color: COR.cinza });
  pagina.drawText('Após o vencimento, multa de 2% e juros de 1% ao mês.', { x: 44, y: 500, size: 9, font: fontes.normal });
  pagina.drawText(modelo.descricao, { x: 44, y: 486, size: 9, font: fontes.normal });
  campo(pagina, fontes, 'Pagador', `${PAGADOR.nome} — CNPJ ${cnpjFormatado(PAGADOR.cnpj)}`, 40, 418, 515);

  desenharBarras(pagina, lido.boleto.codigoBarras, 40, 355, 50);
  pagina.drawText('Autenticação mecânica — Ficha de Compensação', { x: 380, y: 340, size: 7, font: fontes.normal, color: COR.cinza });

  return { bytes: await doc.save(), linha };
}

export type ModeloConta = {
  empresa: string;
  cnpjBase: string;
  segmento: string;
  codigoEmpresa: string;
  valorCentavos: number;
  diasParaVencer: number;
  titulo: string;
  detalhes: Array<[string, string]>;
  complemento: string;
};

export const CONTA_ENERGIA: ModeloConta = {
  empresa: 'Energia Paulista Distribuidora S.A.',
  cnpjBase: '60912345',
  segmento: '3',
  codigoEmpresa: '0187',
  valorCentavos: 68734,
  diasParaVencer: 8,
  titulo: 'Conta de energia elétrica',
  detalhes: [
    ['Consumo do mês', '1.184 kWh'],
    ['Bandeira tarifária', 'Verde'],
  ],
  complemento: '00458712369',
};

/** Conta de consumo / tributo com código de arrecadação (48 dígitos). */
export async function pdfConta(modelo: ModeloConta, agora = Date.now()): Promise<{ bytes: Uint8Array; codigo: string }> {
  const vencimento = somarDias(hojeBrasilia(agora), modelo.diasParaVencer);
  const codigo = gerarArrecadacao({ segmento: modelo.segmento, valorCentavos: modelo.valorCentavos, empresa: modelo.codigoEmpresa, vencimento, complemento: modelo.complemento });

  const doc = await PDFDocument.create();
  doc.setTitle(`${modelo.titulo} (demonstração)`);
  const pagina = doc.addPage([595, 842]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  pagina.drawText('DOCUMENTO DE DEMONSTRAÇÃO — SEM VALOR — EMPRESA FICTÍCIA', { x: 40, y: 800, size: 8, font: negrito, color: COR.aviso });
  pagina.drawRectangle({ x: 40, y: 700, width: 515, height: 80, color: rgb(0.99, 0.94, 0.8) });
  pagina.drawText(modelo.empresa, { x: 56, y: 752, size: 16, font: negrito });
  pagina.drawText(`CNPJ ${cnpjFormatado(cnpjFicticio(modelo.cnpjBase))}  ·  ${modelo.titulo}`, { x: 56, y: 732, size: 9, font: normal });
  pagina.drawText(`Cliente: ${PAGADOR.nome}  ·  Código ${modelo.complemento}`, { x: 56, y: 714, size: 9, font: normal });

  const linhas: Array<[string, string]> = [...modelo.detalhes, ['Vencimento', dataBr(vencimento)], ['Total a pagar', `R$ ${reaisBr(modelo.valorCentavos)}`]];
  linhas.forEach(([rotulo, valorTexto], i) => {
    pagina.drawText(rotulo, { x: 56, y: 660 - i * 24, size: 11, font: normal, color: COR.cinza });
    pagina.drawText(valorTexto, { x: 300, y: 660 - i * 24, size: 11, font: negrito });
  });

  pagina.drawText('Código de barras para pagamento', { x: 56, y: 520, size: 9, font: normal, color: COR.cinza });
  pagina.drawText(formatarLinhaDigitavel(codigo), { x: 56, y: 502, size: 12, font: negrito });
  const barras = [0, 1, 2, 3].map((i) => codigo.slice(i * 12, i * 12 + 11)).join('');
  desenharBarras(pagina, barras, 56, 440, 48);

  return { bytes: await doc.save(), codigo };
}

/** XML de NF-e (nfeProc) com duas duplicatas — o formato que fornecedores enviam por e-mail. */
export function xmlNfeLaticinios(agora = Date.now(), numero = 48213, dias: [number, number] = [10, 40]): string {
  const hoje = hojeBrasilia(agora);
  const cnpj = cnpjFicticio('18273645');
  const chave = gerarChaveNfe({ uf: '35', aamm: `${hoje.slice(2, 4)}${hoje.slice(5, 7)}`, cnpj, serie: 1, numero, codigo: '73519264' });
  if (modulo11Padrao(chave.slice(0, 43)) !== Number(chave[43])) throw new Error('chave inválida');
  const d1 = somarDias(hoje, dias[0]);
  const d2 = somarDias(hoje, dias[1]);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DOCUMENTO DE DEMONSTRAÇÃO — SEM VALOR FISCAL — EMPRESAS FICTÍCIAS -->
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide><cUF>35</cUF><natOp>Venda de mercadoria</natOp><mod>55</mod><serie>1</serie><nNF>${numero}</nNF><dhEmi>${hoje}T09:14:00-03:00</dhEmi></ide>
      <emit><CNPJ>${cnpj}</CNPJ><xNome>Laticínios Serra Azul Ltda</xNome><xFant>Laticínios Serra Azul</xFant></emit>
      <dest><CNPJ>${PAGADOR.cnpj}</CNPJ><xNome>${PAGADOR.nome}</xNome></dest>
      <det nItem="1"><prod><xProd>Manteiga com sal 5 kg</xProd><qCom>12</qCom><vProd>1140.00</vProd></prod></det>
      <det nItem="2"><prod><xProd>Queijo muçarela peça 4 kg</xProd><qCom>20</qCom><vProd>1320.00</vProd></prod></det>
      <total><ICMSTot><vNF>2460.00</vNF></ICMSTot></total>
      <cobr>
        <fat><nFat>${numero}</nFat><vOrig>2460.00</vOrig><vLiq>2460.00</vLiq></fat>
        <dup><nDup>001</nDup><dVenc>${d1}</dVenc><vDup>1230.00</vDup></dup>
        <dup><nDup>002</nDup><dVenc>${d2}</dVenc><vDup>1230.00</vDup></dup>
      </cobr>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>
</nfeProc>
`;
}

export const EXEMPLOS = [
  { id: 'boleto-moinho', arquivo: 'boleto-moinho-bom-trigo.pdf', rotulo: 'Boleto do fornecedor de farinha', formato: 'PDF' },
  { id: 'conta-energia', arquivo: 'conta-energia.pdf', rotulo: 'Conta de energia', formato: 'PDF' },
  { id: 'nfe-laticinios', arquivo: 'nfe-laticinios-serra-azul.xml', rotulo: 'NF-e com 2 parcelas', formato: 'XML' },
  { id: 'boleto-internet', arquivo: 'boleto-fibranet.pdf', rotulo: 'Boleto da internet', formato: 'PDF' },
] as const;

export type IdExemplo = (typeof EXEMPLOS)[number]['id'];

/**
 * `variacao` muda o número do documento a cada clique na demonstração: cada
 * visitante vê o cadastro acontecer. Reenviar o mesmo arquivo baixado mostra o
 * bloqueio de duplicidade.
 */
export async function gerarExemplo(id: IdExemplo, agora = Date.now(), variacao = 0): Promise<{ nome: string; mime: string; bytes: Uint8Array }> {
  const sufixo = String(variacao).padStart(4, '0').slice(-4);
  switch (id) {
    case 'boleto-moinho':
    case 'boleto-internet': {
      const modelo = MODELOS_BOLETO[id === 'boleto-moinho' ? 0 : 1];
      const { bytes } = await pdfBoleto({ ...modelo, nossoNumero: `${modelo.nossoNumero.slice(0, 7)}${sufixo}` }, agora);
      return { nome: modelo.arquivo, mime: 'application/pdf', bytes };
    }
    case 'conta-energia':
      return { nome: 'conta-energia.pdf', mime: 'application/pdf', bytes: (await pdfConta({ ...CONTA_ENERGIA, complemento: `0045871${sufixo}` }, agora)).bytes };
    case 'nfe-laticinios':
      return {
        nome: 'nfe-laticinios-serra-azul.xml',
        mime: 'application/xml',
        bytes: new TextEncoder().encode(xmlNfeLaticinios(agora, 48000 + (variacao % 9999))),
      };
  }
}
