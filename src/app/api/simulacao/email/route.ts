import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolverCarteira } from '@/lib/carteira';
import { receberEmail } from '@/lib/gmail';
import { CENARIOS, emailSimulado, type Cenario } from '@/lib/simulacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/simulacao/email { token, cenario, semente } — "chega" um e-mail na
 * caixa simulada. Cada chegada é um e-mail novo (id novo); se a conta dentro
 * dele já existe, quem barra é a impressão digital do documento.
 */
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as { token?: string; cenario?: string; semente?: number };
  const carteira = await resolverCarteira(corpo.token);
  if (!carteira?.simulacao) return NextResponse.json({ erro: 'Simulação expirada. Recarregue a página.' }, { status: 404 });
  if (!CENARIOS.includes(corpo.cenario as Cenario)) return NextResponse.json({ erro: 'Cenário inválido.' }, { status: 400 });

  const semente = Math.abs(Math.trunc(Number(corpo.semente) || 0)) % 10_000;
  const email = await emailSimulado(corpo.cenario as Cenario, semente);
  const r = await receberEmail(carteira, { id: `sim-${randomUUID()}`, ...email });
  return NextResponse.json({ email: { de: email.de, assunto: email.assunto, anexos: email.anexos.map((a) => a.nome) }, ...r });
}
