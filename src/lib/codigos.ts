/**
 * Códigos de pagamento brasileiros — leitura, validação e geração.
 *
 * - Boleto bancário: linha digitável de 47 dígitos (padrão Febraban/Bacen).
 *   O próprio código carrega banco, valor e vencimento, protegidos por
 *   dígitos verificadores (módulo 10 nos campos, módulo 11 no geral).
 * - Arrecadação (contas de consumo, tributos): 48 dígitos, começa com 8.
 * - Chave de acesso da NF-e: 44 dígitos com DV em módulo 11.
 *
 * Tudo aqui é determinístico: nenhum valor é "adivinhado". Se o dígito
 * verificador não bate, o código é recusado.
 */

export const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** Módulo 10 (pesos 2,1 da direita para a esquerda, somando os algarismos do produto). */
export function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i -= 1) {
    const produto = Number(numero[i]) * peso;
    soma += produto > 9 ? Math.floor(produto / 10) + (produto % 10) : produto;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Soma ponderada do módulo 11 (pesos 2..9 da direita para a esquerda). */
function somaModulo11(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i -= 1) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return soma;
}

/** DV geral do boleto bancário: 0, 10 e 11 viram 1. */
export function modulo11Boleto(numero: string): number {
  const dv = 11 - (somaModulo11(numero) % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** DV de arrecadação e da chave NF-e: restos 0 e 1 viram 0. */
export function modulo11Padrao(numero: string): number {
  const resto = somaModulo11(numero) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/* --------------------------------- Datas --------------------------------- */

const DIA_MS = 86_400_000;
const BASE_ANTIGA = Date.UTC(1997, 9, 7); // fator 0
const BASE_NOVA = Date.UTC(2025, 1, 22); // fator 1000 após o reinício de 22/02/2025

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * O fator de vencimento chegou a 9999 em 21/02/2025 e recomeçou em 1000.
 * O mesmo fator vale para duas datas ~25 anos distantes; usamos a mais
 * próxima da data de referência (hoje).
 */
export function fatorParaData(fator: number, referencia = Date.now()): string | null {
  if (!fator) return null;
  const candidatas = [BASE_ANTIGA + fator * DIA_MS];
  if (fator >= 1000) candidatas.push(BASE_NOVA + (fator - 1000) * DIA_MS);
  candidatas.sort((a, b) => Math.abs(a - referencia) - Math.abs(b - referencia));
  return iso(candidatas[0]);
}

export function dataParaFator(data: string): number {
  const ms = Date.parse(`${data}T00:00:00Z`);
  if (ms >= BASE_NOVA) return 1000 + Math.round((ms - BASE_NOVA) / DIA_MS);
  return Math.round((ms - BASE_ANTIGA) / DIA_MS);
}

/* ------------------------------ Boleto bancário ------------------------------ */

export const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '041': 'Banrisul',
  '070': 'BRB',
  '077': 'Banco Inter',
  '104': 'Caixa Econômica Federal',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagSeguro',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '380': 'PicPay',
  '403': 'Cora',
  '422': 'Safra',
  '748': 'Sicredi',
  '756': 'Sicoob',
};

export type Boleto = {
  tipo: 'boleto';
  linhaDigitavel: string;
  codigoBarras: string;
  banco: string;
  bancoNome: string;
  valorCentavos: number;
  vencimento: string | null;
};

export type Falha = { ok: false; motivo: string };

export function lerBoleto(entrada: string, referencia = Date.now()): { ok: true; boleto: Boleto } | Falha {
  const l = soDigitos(entrada);
  if (l.length !== 47) return { ok: false, motivo: `linha digitável tem ${l.length} dígitos (esperado 47)` };

  const campos = [
    [l.slice(0, 9), Number(l[9])],
    [l.slice(10, 20), Number(l[20])],
    [l.slice(21, 31), Number(l[31])],
  ] as const;
  for (const [indice, [numero, dv]] of campos.entries()) {
    if (modulo10(numero) !== dv) return { ok: false, motivo: `dígito verificador do campo ${indice + 1} não confere` };
  }

  const codigoBarras = l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
  if (modulo11Boleto(codigoBarras.slice(0, 4) + codigoBarras.slice(5)) !== Number(codigoBarras[4])) {
    return { ok: false, motivo: 'dígito verificador geral não confere' };
  }

  const banco = l.slice(0, 3);
  return {
    ok: true,
    boleto: {
      tipo: 'boleto',
      linhaDigitavel: l,
      codigoBarras,
      banco,
      bancoNome: BANCOS[banco] ?? `Banco ${banco}`,
      valorCentavos: Number(l.slice(37, 47)),
      vencimento: fatorParaData(Number(l.slice(33, 37)), referencia),
    },
  };
}

/** Monta uma linha digitável válida — usada nos documentos de exemplo e nos testes. */
export function gerarLinhaDigitavel(opcoes: { banco: string; valorCentavos: number; vencimento: string | null; campoLivre: string }): string {
  const campoLivre = soDigitos(opcoes.campoLivre).padEnd(25, '0').slice(0, 25);
  const fator = opcoes.vencimento ? String(dataParaFator(opcoes.vencimento)).padStart(4, '0') : '0000';
  const valor = String(opcoes.valorCentavos).padStart(10, '0');
  const semDv = `${opcoes.banco}9${fator}${valor}${campoLivre}`;
  const dv = modulo11Boleto(semDv);
  const barras = `${semDv.slice(0, 4)}${dv}${semDv.slice(4)}`;

  const c1 = barras.slice(0, 4) + barras.slice(19, 24);
  const c2 = barras.slice(24, 34);
  const c3 = barras.slice(34, 44);
  return `${c1}${modulo10(c1)}${c2}${modulo10(c2)}${c3}${modulo10(c3)}${dv}${barras.slice(5, 19)}`;
}

export function formatarLinhaDigitavel(l: string): string {
  if (l.length === 47) {
    return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
  }
  if (l.length === 48) return l.match(/.{12}/g)!.map((b) => `${b.slice(0, 11)}-${b[11]}`).join(' ');
  return l;
}

/* ------------------------------- Arrecadação ------------------------------- */

export const SEGMENTOS: Record<string, { nome: string; categoria: string }> = {
  '1': { nome: 'Prefeitura', categoria: 'Impostos e taxas' },
  '2': { nome: 'Saneamento', categoria: 'Água' },
  '3': { nome: 'Energia elétrica e gás', categoria: 'Energia' },
  '4': { nome: 'Telecomunicações', categoria: 'Internet e telefone' },
  '5': { nome: 'Órgão governamental', categoria: 'Impostos e taxas' },
  '6': { nome: 'Carnê / convênio', categoria: 'Outros' },
  '7': { nome: 'Multa de trânsito', categoria: 'Impostos e taxas' },
  '9': { nome: 'Uso exclusivo do banco', categoria: 'Outros' },
};

export type Arrecadacao = {
  tipo: 'arrecadacao';
  linhaDigitavel: string;
  codigoBarras: string;
  segmento: string;
  segmentoNome: string;
  categoria: string;
  valorCentavos: number;
  vencimento: string | null;
  empresa: string;
};

function dvArrecadacao(numero: string, identificador: string): number {
  return identificador === '6' || identificador === '7' ? modulo10(numero) : modulo11Padrao(numero);
}

export function lerArrecadacao(entrada: string, referencia = Date.now()): { ok: true; conta: Arrecadacao } | Falha {
  const l = soDigitos(entrada);
  if (l.length !== 48 || l[0] !== '8') return { ok: false, motivo: 'não é um código de arrecadação (48 dígitos iniciando em 8)' };
  const identificador = l[2];
  if (!['6', '7', '8', '9'].includes(identificador)) return { ok: false, motivo: 'identificador de valor inválido' };

  const blocos = [0, 1, 2, 3].map((i) => l.slice(i * 12, i * 12 + 12));
  for (const [i, bloco] of blocos.entries()) {
    if (dvArrecadacao(bloco.slice(0, 11), identificador) !== Number(bloco[11])) {
      return { ok: false, motivo: `dígito verificador do bloco ${i + 1} não confere` };
    }
  }
  const codigoBarras = blocos.map((b) => b.slice(0, 11)).join('');
  if (dvArrecadacao(codigoBarras.slice(0, 3) + codigoBarras.slice(4), identificador) !== Number(codigoBarras[3])) {
    return { ok: false, motivo: 'dígito verificador geral não confere' };
  }

  // Vencimento não tem posição oficial; muitas concessionárias usam AAAAMMDD logo após a empresa.
  let vencimento: string | null = null;
  const candidato = codigoBarras.slice(19, 27);
  const m = /^(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.exec(candidato);
  if (m) {
    const data = `${m[1]}-${m[2]}-${m[3]}`;
    if (Math.abs(Date.parse(`${data}T12:00:00Z`) - referencia) < 400 * DIA_MS) vencimento = data;
  }

  const segmento = SEGMENTOS[l[1]] ?? { nome: 'Outros', categoria: 'Outros' };
  return {
    ok: true,
    conta: {
      tipo: 'arrecadacao',
      linhaDigitavel: l,
      codigoBarras,
      segmento: l[1],
      segmentoNome: segmento.nome,
      categoria: segmento.categoria,
      valorCentavos: identificador === '6' || identificador === '8' ? Number(codigoBarras.slice(4, 15)) : 0,
      vencimento,
      empresa: codigoBarras.slice(15, 19),
    },
  };
}

export function gerarArrecadacao(opcoes: { segmento: string; valorCentavos: number; empresa: string; vencimento: string; complemento: string }): string {
  const vencimento = opcoes.vencimento.replace(/-/g, '');
  const semDv = `8${opcoes.segmento}6${String(opcoes.valorCentavos).padStart(11, '0')}${opcoes.empresa.padStart(4, '0')}${vencimento}${soDigitos(opcoes.complemento).padEnd(17, '0').slice(0, 17)}`;
  const barras = `${semDv.slice(0, 3)}${modulo10(semDv)}${semDv.slice(3)}`;
  return [0, 1, 2, 3].map((i) => barras.slice(i * 11, i * 11 + 11)).map((b) => `${b}${modulo10(b)}`).join('');
}

/* ------------------------------ Chave da NF-e ------------------------------ */

const UF: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export type ChaveNfe = { chave: string; uf: string; emissao: string; cnpjEmitente: string; modelo: string; serie: string; numero: string };

export function lerChaveNfe(entrada: string): { ok: true; nfe: ChaveNfe } | Falha {
  const c = soDigitos(entrada);
  if (c.length !== 44) return { ok: false, motivo: 'chave de acesso deve ter 44 dígitos' };
  if (modulo11Padrao(c.slice(0, 43)) !== Number(c[43])) return { ok: false, motivo: 'dígito verificador da chave não confere' };
  if (!UF[c.slice(0, 2)]) return { ok: false, motivo: 'código de UF inválido' };
  return {
    ok: true,
    nfe: {
      chave: c,
      uf: UF[c.slice(0, 2)],
      emissao: `20${c.slice(2, 4)}-${c.slice(4, 6)}`,
      cnpjEmitente: c.slice(6, 20),
      modelo: c.slice(20, 22),
      serie: String(Number(c.slice(22, 25))),
      numero: String(Number(c.slice(25, 34))),
    },
  };
}

export function gerarChaveNfe(opcoes: { uf: string; aamm: string; cnpj: string; serie: number; numero: number; codigo: string }): string {
  const semDv = `${opcoes.uf}${opcoes.aamm}${opcoes.cnpj}55${String(opcoes.serie).padStart(3, '0')}${String(opcoes.numero).padStart(9, '0')}1${opcoes.codigo.padStart(8, '0')}`;
  return `${semDv}${modulo11Padrao(semDv)}`;
}

/* --------------------------- Busca dentro de texto --------------------------- */

/**
 * Procura códigos válidos num texto livre (PDF extraído ou mensagem). Aceita
 * espaços, pontos e hífens no meio — do jeito que aparecem impressos.
 */
export function encontrarCodigos(texto: string, referencia = Date.now()) {
  const boletos: Boleto[] = [];
  const contas: Arrecadacao[] = [];
  const chaves: ChaveNfe[] = [];
  const vistos = new Set<string>();

  const trechos = texto.match(/\d[\d.\s-]{38,80}\d/g) ?? [];
  for (const trecho of trechos) {
    const d = soDigitos(trecho);
    // Um trecho pode juntar o código com números vizinhos: testamos as janelas possíveis.
    let achou = false;
    for (const tamanho of [48, 47]) {
      for (let i = 0; i + tamanho <= d.length; i += 1) {
        const janela = d.slice(i, i + tamanho);
        if (vistos.has(janela)) continue;
        if (tamanho === 48) {
          const r = lerArrecadacao(janela, referencia);
          if (r.ok) (vistos.add(janela), contas.push(r.conta), (achou = true));
        } else {
          const r = lerBoleto(janela, referencia);
          if (r.ok) (vistos.add(janela), boletos.push(r.boleto), (achou = true));
        }
      }
    }
    // Chave de NF-e só num trecho do tamanho de uma chave: uma janela de 44 dentro de
    // uma linha de boleto passaria no módulo 11 por coincidência em ~1 a cada 40 casos.
    if (!achou && d.length >= 44 && d.length <= 45) {
      for (let i = 0; i + 44 <= d.length; i += 1) {
        const janela = d.slice(i, i + 44);
        const r = lerChaveNfe(janela);
        if (r.ok && !vistos.has(janela)) (vistos.add(janela), chaves.push(r.nfe));
      }
    }
  }
  return { boletos, contas, chaves };
}

export function cnpjFormatado(valor: string): string {
  const d = soDigitos(valor);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : valor;
}
