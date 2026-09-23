import { NextResponse } from 'next/server';
import { banco, type StatusConta } from '@/lib/banco';
import { resolverCarteira } from '@/lib/carteira';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** PATCH /api/contas/{id} { carteira, status } — marcar como paga, reabrir ou ignorar. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;
  const corpo = (await request.json().catch(() => ({}))) as { carteira?: string; status?: StatusConta };
  const carteira = await resolverCarteira(corpo.carteira);
  if (!carteira || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  if (!corpo.status || !['a_pagar', 'pago', 'ignorado'].includes(corpo.status)) {
    return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await banco.mudarStatus(carteira.id, id, corpo.status));
  } catch {
    return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 });
  }
}
