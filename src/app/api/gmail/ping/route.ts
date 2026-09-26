import { NextResponse } from 'next/server';
import { banco } from '@/lib/banco';
import { carteiraDoScript } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

/** POST /api/gmail/ping { email? } — o script avisa que está instalado e rodando. */
export async function POST(request: Request) {
  const carteira = await carteiraDoScript(request);
  if (!carteira) return NextResponse.json({ erro: 'Chave inválida.' }, { status: 401 });
  const corpo = (await request.json().catch(() => ({}))) as { email?: string };
  const email = typeof corpo.email === 'string' && /^[^\s@]+@[^\s@]+$/.test(corpo.email) ? corpo.email : null;
  await banco.gmailPing(carteira.id, email);
  return NextResponse.json({ ok: true, carteira: carteira.nome });
}
