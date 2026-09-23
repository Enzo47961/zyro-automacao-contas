import 'server-only';
import { createHash } from 'node:crypto';
import { banco, type Carteira, type Execucao, type NovoDocumento, type Passo } from './banco';
import { categorizar, refinarComIa } from './classificar';
import { BANCOS, encontrarCodigos, type Arrecadacao, type Boleto } from './codigos';
import { extrairBeneficiario, extrairEmpresa, lerConteudo, type ConteudoLido, type NfeXml } from './leitura';

/**
 * O fluxo da automação, passo a passo:
 *
 *   Receber → Ler conteúdo → Encontrar códigos → Validar → Enriquecer → Evitar duplicidade → Salvar e agendar
 *
 * Cada passo é cronometrado e registrado (como uma execução no n8n): o painel
 * mostra exatamente o que aconteceu com cada documento, inclusive quando falha.
 */

export type Entrada =
  | { tipo: 'arquivo'; nome: string; mime: string; bytes: Uint8Array }
  | { tipo: 'texto'; texto: string };

export type Resultado = {
  execucao: Omit<Execucao, 'id' | 'criado_em'>;
  documentos: Array<NovoDocumento & { id: string; duplicado: boolean }>;
  /** Mensagem pronta para o usuário (Telegram / tela). */
  mensagem: string;
};

class Registro {
  passos: Passo[] = [];
  private inicio = performance.now();
  private marco = performance.now();
  add(nome: string, status: Passo['status'], detalhe: string) {
    const agora = performance.now();
    this.passos.push({ nome, status, ms: Math.round(agora - this.marco), detalhe });
    this.marco = agora;
  }
  get total() {
    return Math.round(performance.now() - this.inicio);
  }
}

const hash = (texto: string) => createHash('sha256').update(texto).digest('hex').slice(0, 32);
const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'sem vencimento');

type Candidato = NovoDocumento;

function deBoleto(b: Boleto, contexto: { texto: string; origem: NovoDocumento['origem']; arquivo: string | null }): Candidato {
  const beneficiario = extrairBeneficiario(contexto.texto);
  return {
    tipo: 'boleto',
    origem: contexto.origem,
    fornecedor: beneficiario?.nome ?? '',
    documento_fornecedor: beneficiario?.cnpj ?? '',
    descricao: '',
    categoria: categorizar(beneficiario?.nome ?? '', contexto.texto),
    valor_centavos: b.valorCentavos,
    vencimento: b.vencimento,
    linha_digitavel: b.linhaDigitavel,
    chave_nfe: null,
    confianca: beneficiario ? 'alta' : 'media',
    detalhes: { banco: b.banco, banco_nome: b.bancoNome, codigo_barras: b.codigoBarras },
    arquivo_nome: contexto.arquivo,
    impressao: hash(`boleto:${b.linhaDigitavel}`),
  };
}

function deArrecadacao(a: Arrecadacao, contexto: { texto: string; origem: NovoDocumento['origem']; arquivo: string | null }): Candidato {
  const beneficiario = extrairBeneficiario(contexto.texto);
  const empresa =
    beneficiario?.nome ??
    (a.segmento === '5' && /simples nacional/i.test(contexto.texto) ? 'Simples Nacional (DAS)' : extrairEmpresa(contexto.texto));
  return {
    tipo: 'arrecadacao',
    origem: contexto.origem,
    fornecedor: empresa ?? a.segmentoNome,
    documento_fornecedor: beneficiario?.cnpj ?? '',
    descricao: a.segmentoNome,
    categoria: a.categoria !== 'Outros' ? a.categoria : categorizar(contexto.texto),
    valor_centavos: a.valorCentavos,
    vencimento: a.vencimento,
    linha_digitavel: a.linhaDigitavel,
    chave_nfe: null,
    // Arrecadação não tem campo oficial de vencimento: sem ele, a conta pede conferência.
    confianca: a.vencimento ? 'alta' : 'baixa',
    detalhes: { segmento: a.segmento, empresa: a.empresa, codigo_barras: a.codigoBarras },
    arquivo_nome: contexto.arquivo,
    impressao: hash(`arrecadacao:${a.linhaDigitavel}`),
  };
}

function deNfe(nfe: NfeXml, origem: NovoDocumento['origem'], arquivo: string | null): Candidato[] {
  const base = {
    tipo: 'nfe' as const,
    origem,
    fornecedor: nfe.emitente,
    documento_fornecedor: nfe.cnpjEmitente,
    categoria: categorizar(nfe.emitente, nfe.itens.join(' ')) === 'Outros' ? 'Fornecedores' : categorizar(nfe.emitente, nfe.itens.join(' ')),
    linha_digitavel: null,
    chave_nfe: nfe.chave,
    arquivo_nome: arquivo,
  };
  if (nfe.duplicatas.length === 0) {
    return [
      {
        ...base,
        descricao: `NF-e ${nfe.numero} (sem duplicatas)`,
        valor_centavos: nfe.valorTotalCentavos,
        vencimento: null,
        confianca: 'baixa',
        detalhes: { numero: nfe.numero, emissao: nfe.emissao, itens: nfe.itens },
        impressao: hash(`nfe:${nfe.chave}`),
      },
    ];
  }
  return nfe.duplicatas.map((dup, i) => ({
    ...base,
    descricao: `NF-e ${nfe.numero} · parcela ${i + 1}/${nfe.duplicatas.length}`,
    valor_centavos: dup.valorCentavos,
    vencimento: dup.vencimento,
    confianca: 'alta' as const,
    detalhes: { numero: nfe.numero, emissao: nfe.emissao, duplicata: dup.numero, itens: nfe.itens },
    impressao: hash(`nfe:${nfe.chave}:${dup.numero || i}`),
  }));
}

export async function processar(
  entrada: Entrada,
  opcoes: { carteira: Carteira; gatilho: Execucao['gatilho']; origem: NovoDocumento['origem']; agora?: number; criadoEm?: string },
): Promise<Resultado> {
  const reg = new Registro();
  const agora = opcoes.agora ?? Date.now();
  const nomeArquivo = entrada.tipo === 'arquivo' ? entrada.nome : null;

  const finalizar = async (status: Execucao['status'], resumo: string, mensagem: string, documentos: Resultado['documentos'] = []): Promise<Resultado> => {
    const execucao = {
      carteira_id: opcoes.carteira.id,
      documento_id: documentos[0]?.id ?? null,
      gatilho: opcoes.gatilho,
      status,
      resumo,
      passos: reg.passos,
      duracao_ms: reg.total,
      ...(opcoes.criadoEm ? { criado_em: opcoes.criadoEm } : {}),
    };
    await banco.registrarExecucao(execucao);
    return { execucao, documentos, mensagem };
  };

  // 1. Receber
  reg.add(
    'Receber',
    'ok',
    entrada.tipo === 'arquivo' ? `${entrada.nome} · ${(entrada.bytes.byteLength / 1024).toFixed(1).replace('.', ',')} KB` : `mensagem de texto (${entrada.texto.length} caracteres)`,
  );

  // 2. Ler conteúdo
  let conteudo: ConteudoLido;
  try {
    conteudo = entrada.tipo === 'arquivo' ? await lerConteudo(entrada) : { formato: 'texto', texto: entrada.texto };
  } catch (erro) {
    reg.add('Ler conteúdo', 'erro', 'não foi possível abrir o arquivo (PDF protegido ou corrompido?)');
    console.error('[quita] leitura:', erro);
    return finalizar('erro', 'Arquivo ilegível', 'Não consegui abrir esse arquivo. Se for PDF, veja se não está protegido por senha.');
  }

  if (conteudo.formato === 'imagem') {
    reg.add('Ler conteúdo', 'aviso', 'foto recebida — leitura de imagem não habilitada');
    return finalizar(
      'revisao',
      'Foto de boleto',
      'Recebi uma foto. Para ler com 100% de precisão, envie o <b>PDF</b> do boleto ou cole aqui a <b>linha digitável</b> (os números do boleto).',
    );
  }
  if (conteudo.formato === 'desconhecido') {
    reg.add('Ler conteúdo', 'erro', conteudo.motivo);
    return finalizar('ignorado', 'Formato não suportado', `Não reconheci esse arquivo: ${conteudo.motivo}.`);
  }
  reg.add(
    'Ler conteúdo',
    'ok',
    conteudo.formato === 'pdf'
      ? `PDF com ${conteudo.paginas} página(s), ${conteudo.texto.length.toLocaleString('pt-BR')} caracteres`
      : conteudo.formato === 'xml-nfe'
        ? `XML de NF-e nº ${conteudo.nfe.numero} de ${conteudo.nfe.emitente}`
        : 'texto recebido',
  );

  // 3 e 4. Encontrar e validar códigos
  const texto = conteudo.formato === 'xml-nfe' ? '' : conteudo.texto;
  let candidatos: Candidato[] = [];
  if (conteudo.formato === 'xml-nfe') {
    candidatos = deNfe(conteudo.nfe, opcoes.origem, nomeArquivo);
    reg.add('Encontrar códigos', 'ok', `chave de acesso ${conteudo.nfe.chave.slice(0, 6)}… · ${conteudo.nfe.duplicatas.length} duplicata(s)`);
    reg.add(
      'Validar',
      conteudo.nfe.duplicatas.length ? 'ok' : 'aviso',
      conteudo.nfe.duplicatas.length ? 'duplicatas com vencimento e valor lidos do XML' : 'nota sem duplicatas: confira a forma de pagamento',
    );
  } else {
    const achados = encontrarCodigos(texto, agora);
    const total = achados.boletos.length + achados.contas.length;
    if (total === 0) {
      reg.add('Encontrar códigos', 'erro', achados.chaves.length ? 'só a chave de uma NF-e (sem linha de pagamento)' : 'nenhuma linha digitável válida');
      return finalizar(
        'revisao',
        'Nenhum código de pagamento',
        achados.chaves.length
          ? 'Encontrei a chave de uma NF-e, mas não a cobrança. Envie o <b>XML</b> da nota ou o boleto dela.'
          : 'Não achei uma linha digitável válida. Confira se o documento é um boleto ou cole os números aqui.',
      );
    }
    reg.add('Encontrar códigos', 'ok', `${achados.boletos.length} boleto(s) e ${achados.contas.length} conta(s) de consumo/tributo`);
    reg.add('Validar', 'ok', 'dígitos verificadores conferidos (módulos 10 e 11); valor e vencimento lidos do próprio código');
    candidatos = [
      ...achados.boletos.map((b) => deBoleto(b, { texto, origem: opcoes.origem, arquivo: nomeArquivo })),
      ...achados.contas.map((a) => deArrecadacao(a, { texto, origem: opcoes.origem, arquivo: nomeArquivo })),
    ];
  }

  // 5. Enriquecer (fornecedor, categoria, descrição)
  const semNome = candidatos.filter((c) => !c.fornecedor);
  const ia = semNome.length && texto ? await refinarComIa(texto) : null;
  for (const c of candidatos) {
    if (!c.fornecedor) c.fornecedor = ia?.fornecedor ?? (c.tipo === 'boleto' ? `Boleto ${BANCOS[String(c.detalhes.banco)] ?? ''}`.trim() : 'Fornecedor não identificado');
    if (!c.descricao && ia?.descricao) c.descricao = ia.descricao;
    if (ia?.categoria && c.categoria === 'Outros') c.categoria = ia.categoria;
  }
  reg.add(
    'Enriquecer',
    semNome.length && !ia ? 'aviso' : 'ok',
    candidatos.map((c) => `${c.fornecedor} → ${c.categoria}`).join(' · ') + (ia ? ' (IA)' : ''),
  );

  // 6 e 7. Evitar duplicidade + salvar
  const salvos: Resultado['documentos'] = [];
  for (const c of candidatos) {
    const r = await banco.salvarDocumento(opcoes.carteira.id, { ...c, ...(opcoes.criadoEm ? { criado_em: opcoes.criadoEm } : {}) });
    salvos.push({ ...c, id: r.id, duplicado: r.duplicado });
  }
  const novos = salvos.filter((d) => !d.duplicado);
  reg.add('Evitar duplicidade', novos.length === salvos.length ? 'ok' : 'aviso', `${salvos.length - novos.length} já cadastrado(s)`);

  if (novos.length === 0) {
    reg.add('Salvar e agendar', 'pulado', 'nada novo');
    return finalizar('duplicado', `${salvos[0].fornecedor} já cadastrado`, `Esse documento já estava cadastrado (${salvos[0].fornecedor}, ${reais(salvos[0].valor_centavos)}). Não lancei de novo.`, salvos);
  }

  const antecedencia = opcoes.carteira.antecedencia_dias;
  reg.add(
    'Salvar e agendar',
    'ok',
    `${novos.length} conta(s) salvas · lembretes ${antecedencia ? `${antecedencia} dia(s) antes, ` : ''}no dia e 1 dia após o vencimento`,
  );

  const precisaRevisao = novos.some((d) => d.confianca === 'baixa');
  const linhas = novos.map(
    (d) => `• <b>${escapar(d.fornecedor)}</b> — ${reais(d.valor_centavos)} · vence ${dataBr(d.vencimento)}${d.confianca === 'baixa' ? ' ⚠️ confira' : ''}`,
  );
  const mensagem = `✅ ${novos.length === 1 ? 'Conta cadastrada' : `${novos.length} contas cadastradas`}:\n${linhas.join('\n')}${
    antecedencia ? `\n\n⏰ Vou te lembrar ${antecedencia} dia(s) antes e no dia do vencimento.` : ''
  }`;

  return finalizar(
    precisaRevisao ? 'revisao' : 'sucesso',
    novos.length === 1 ? `${novos[0].fornecedor} · ${reais(novos[0].valor_centavos)}` : `${novos.length} contas de ${novos[0].fornecedor}`,
    mensagem,
    salvos,
  );
}

export const escapar = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
