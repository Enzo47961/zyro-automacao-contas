/**
 * Categoria da conta a partir do fornecedor e do texto do documento.
 * Regras simples e auditáveis; a IA (quando configurada) só entra para
 * refinar fornecedor e descrição — nunca para inventar valor ou data.
 */
const REGRAS: Array<{ categoria: string; termos: RegExp }> = [
  { categoria: 'Energia', termos: /\b(energia|eletric|enel|cemig|light|copel|cpfl|coelba|celesc|equatorial|neoenergia|kwh)\b/i },
  { categoria: 'Água', termos: /\b(sabesp|saneamento|[aá]gua|esgoto|cedae|copasa|embasa|sanepar|compesa)\b/i },
  { categoria: 'Internet e telefone', termos: /\b(vivo|claro|internet|telecom|fibra|banda larga|telefonia)\b/i },
  { categoria: 'Aluguel e condomínio', termos: /\b(aluguel|loca[cç][aã]o|imobili[aá]ria|condom[ií]nio)\b/i },
  { categoria: 'Impostos e taxas', termos: /\b(simples nacional|documento de arrecada[cç][aã]o|darf|gps|inss|iptu|ipva|icms|prefeitura|receita federal|sefaz)\b/i },
  { categoria: 'Serviços', termos: /\b(contabilidade|honor[aá]rios|consultoria|software|sistema|assinatura|licen[cç]a|manuten[cç][aã]o|servi[cç]os?)\b/i },
  { categoria: 'Fornecedores', termos: /\b(ltda|distribuidora|comercio|com[eé]rcio|ind[uú]stria|atacad|mercadoria|latic[ií]nios|embalagens|moinho)\b/i },
];

export function categorizar(...textos: string[]): string {
  const alvo = textos.join(' ');
  return REGRAS.find((r) => r.termos.test(alvo))?.categoria ?? 'Outros';
}

export const CATEGORIAS = ['Fornecedores', 'Energia', 'Água', 'Internet e telefone', 'Aluguel e condomínio', 'Impostos e taxas', 'Serviços', 'Outros'];

/**
 * Provedor de IA compatível com a API da OpenAI. Groq (camada gratuita) tem
 * prioridade; DeepSeek fica como alternativa. Sem chave, a IA é simplesmente pulada.
 */
function provedorIa(): { url: string; chave: string; modelo: string } | null {
  if (process.env.GROQ_API_KEY) {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', chave: process.env.GROQ_API_KEY, modelo: process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b' };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { url: 'https://api.deepseek.com/chat/completions', chave: process.env.DEEPSEEK_API_KEY, modelo: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat' };
  }
  return null;
}

/** Refinamento opcional com IA: fornecedor e descrição curta. Falha silenciosamente. */
export async function refinarComIa(texto: string): Promise<{ fornecedor?: string; descricao?: string; categoria?: string } | null> {
  const ia = provedorIa();
  if (!ia) return null;
  try {
    const res = await fetch(ia.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ia.chave}` },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: ia.modelo,
        temperature: 0,
        // Modelos de raciocínio gastam parte dos tokens pensando: folga para o JSON caber.
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você lê documentos de cobrança brasileiros. Responda só JSON: {"fornecedor": nome de quem recebe o pagamento (beneficiário), "descricao": o que está sendo cobrado em até 8 palavras, "categoria": uma de ' +
              JSON.stringify(CATEGORIAS) +
              '}. Se não souber um campo, use string vazia. Nunca invente valores ou datas.',
          },
          { role: 'user', content: texto.slice(0, 4000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const corpo = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const dados = JSON.parse(corpo.choices?.[0]?.message?.content ?? '{}') as Record<string, string>;
    return {
      fornecedor: dados.fornecedor?.trim() || undefined,
      descricao: dados.descricao?.trim() || undefined,
      categoria: CATEGORIAS.includes(dados.categoria) ? dados.categoria : undefined,
    };
  } catch {
    return null;
  }
}
