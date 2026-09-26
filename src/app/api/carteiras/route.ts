import { NextResponse } from 'next/server';
import { banco } from '@/lib/banco';

export const dynamic = 'force-dynamic';

/** POST /api/carteiras { nome } — cria uma carteira para ligar ao Gmail (sem Telegram). */
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as { nome?: string };
  try {
    const carteira = await banco.criarCarteira(String(corpo.nome ?? '').slice(0, 60), false);
    return NextResponse.json({ destino: `/p/${carteira.token_painel}/gmail` });
  } catch (erro) {
    const limite = String(erro).includes('LIMITE_DIARIO');
    return NextResponse.json(
      { erro: limite ? 'Muitas carteiras criadas hoje. Tente amanhã.' : 'Não foi possível criar a carteira.' },
      { status: limite ? 429 : 500 },
    );
  }
}
