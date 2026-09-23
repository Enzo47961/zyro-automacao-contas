import 'server-only';
import { banco } from './banco';
import { hojeBrasilia, pdfBoleto, pdfConta, somarDias, xmlNfeLaticinios, type ModeloBoleto, type ModeloConta } from './exemplos';
import { processar } from './pipeline';

/**
 * Carteira de demonstração ("Padaria Pão de Ontem"): recriada todo dia pelo
 * agendador. Cada conta passa pelo MESMO pipeline de produção — as execuções
 * mostradas no painel são reais, só os documentos é que são fictícios.
 */

type Item =
  | { tipo: 'boleto'; modelo: Omit<ModeloBoleto, 'arquivo' | 'titulo' | 'diasParaVencer'>; dias: number; pago?: boolean }
  | { tipo: 'conta'; modelo: Omit<ModeloConta, 'diasParaVencer'>; dias: number; pago?: boolean }
  | { tipo: 'nfe'; numero: number; dias: [number, number]; pagoPrimeira?: boolean };

const boleto = (fornecedor: string, cnpjBase: string, banco: string, valorCentavos: number, descricao: string, nossoNumero: string) => ({
  fornecedor, cnpjBase, banco, valorCentavos, descricao, nossoNumero,
});
const conta = (empresa: string, cnpjBase: string, segmento: string, codigoEmpresa: string, valorCentavos: number, titulo: string, complemento: string): Omit<ModeloConta, 'diasParaVencer'> => ({
  empresa, cnpjBase, segmento, codigoEmpresa, valorCentavos, titulo, detalhes: [], complemento,
});

const ITENS: Item[] = [
  // Já pagas (últimas semanas)
  { tipo: 'boleto', modelo: boleto('Moinho Bom Trigo Ltda', '27463819', '237', 176300, 'Farinha de trigo tipo 1 — 48 sacos', '09123450001'), dias: -24, pago: true },
  { tipo: 'conta', modelo: conta('Energia Paulista Distribuidora S.A.', '60912345', '3', '0187', 71288, 'Conta de energia elétrica', '00458710001'), dias: -21, pago: true },
  { tipo: 'boleto', modelo: boleto('Imobiliária Centro Imóveis Ltda', '11839204', '104', 420000, 'Aluguel do ponto comercial', '24000000101'), dias: -17, pago: true },
  { tipo: 'boleto', modelo: boleto('Contabilidade Exata Ltda', '30847561', '756', 65000, 'Honorários contábeis mensais', '31000000201'), dias: -12, pago: true },
  { tipo: 'conta', modelo: conta('Águas do Vale Saneamento S.A.', '43987012', '2', '0045', 23870, 'Conta de água e esgoto', '00991200001'), dias: -9, pago: true },
  { tipo: 'conta', modelo: conta('Receita Federal — Simples Nacional (DAS)', '00394460', '5', '0328', 128455, 'Documento de Arrecadação do Simples Nacional', '07202600001'), dias: -4, pago: true },
  { tipo: 'nfe', numero: 47102, dias: [-6, 24], pagoPrimeira: true },
  // Vencida e ainda aberta
  { tipo: 'boleto', modelo: boleto('Embalagens Rápidas Ltda', '52190837', '033', 38790, 'Sacos kraft e caixas de bolo', '45000000301'), dias: -2 },
  // Hoje e próximos dias
  { tipo: 'boleto', modelo: boleto('Sistema PDV Nuvem Ltda', '37712648', '077', 18900, 'Assinatura do sistema de caixa', '52000000401'), dias: 0 },
  { tipo: 'boleto', modelo: boleto('Moinho Bom Trigo Ltda', '27463819', '237', 184250, 'Farinha de trigo tipo 1 — 50 sacos', '09123450002'), dias: 2 },
  { tipo: 'boleto', modelo: boleto('Açúcar Doce Vale Distribuidora Ltda', '61528374', '001', 92600, 'Açúcar refinado e cristal', '63000000501'), dias: 6 },
  { tipo: 'boleto', modelo: boleto('Imobiliária Centro Imóveis Ltda', '11839204', '104', 420000, 'Aluguel do ponto comercial', '24000000102'), dias: 13 },
  { tipo: 'boleto', modelo: boleto('Contabilidade Exata Ltda', '30847561', '756', 65000, 'Honorários contábeis mensais', '31000000202'), dias: 18 },
];

export async function regenerarDemo(agora = Date.now()): Promise<{ contas: number; execucoes: number }> {
  await banco.limparDemo();
  const carteira = await banco.carteiraDemo();
  if (!carteira) throw new Error('carteira de demonstração não encontrada');

  const hoje = hojeBrasilia(agora);
  let contas = 0;
  let execucoes = 0;

  for (const item of ITENS) {
    const dias = item.tipo === 'nfe' ? item.dias[0] : item.dias;
    // O documento "chegou" alguns dias antes do vencimento, às 8h e pouco.
    const chegada = new Date(`${somarDias(hoje, Math.min(dias - 6, -1))}T11:${String(10 + (execucoes * 7) % 45).padStart(2, '0')}:00Z`).toISOString();

    let arquivo: { nome: string; mime: string; bytes: Uint8Array };
    if (item.tipo === 'boleto') {
      const { bytes } = await pdfBoleto({ ...item.modelo, arquivo: '', titulo: 'Boleto', diasParaVencer: dias }, agora);
      arquivo = { nome: `boleto-${item.modelo.fornecedor.split(' ')[0].toLowerCase()}.pdf`, mime: 'application/pdf', bytes };
    } else if (item.tipo === 'conta') {
      const { bytes } = await pdfConta({ ...item.modelo, diasParaVencer: dias }, agora);
      arquivo = { nome: `conta-${item.modelo.titulo.split(' ').at(-1)?.toLowerCase()}.pdf`, mime: 'application/pdf', bytes };
    } else {
      arquivo = { nome: `nfe-${item.numero}.xml`, mime: 'application/xml', bytes: new TextEncoder().encode(xmlNfeLaticinios(agora, item.numero, item.dias)) };
    }

    const resultado = await processar(
      { tipo: 'arquivo', ...arquivo },
      { carteira, gatilho: execucoes % 3 === 2 ? 'upload' : 'telegram', origem: execucoes % 3 === 2 ? 'upload' : 'telegram', agora, criadoEm: chegada },
    );
    execucoes += 1;
    contas += resultado.documentos.filter((d) => !d.duplicado).length;

    const pagos = item.tipo === 'nfe' ? (item.pagoPrimeira ? resultado.documentos.slice(0, 1) : []) : item.pago ? resultado.documentos : [];
    for (const doc of pagos) await banco.mudarStatus(carteira.id, doc.id, 'pago');
  }
  return { contas, execucoes };
}
