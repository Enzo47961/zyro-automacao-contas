import { NextResponse } from 'next/server';
import { banco } from '@/lib/banco';

export const dynamic = 'force-dynamic';

/** POST /api/simulacao — carteira de simulação do /gmail (apagada depois de um dia). */
export async function POST() {
  try {
    const carteira = await banco.criarCarteira('Simulação no Gmail', true);
    return NextResponse.json({ token: carteira.token_painel, antecedencia: carteira.antecedencia_dias, semente: Math.floor(Math.random() * 9999) });
  } catch {
    return NextResponse.json({ erro: 'Simulação indisponível no momento. Tente de novo mais tarde.' }, { status: 429 });
  }
}
