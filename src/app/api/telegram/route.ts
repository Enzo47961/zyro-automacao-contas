import { NextResponse } from 'next/server';
import { tratarAtualizacao, type Atualizacao } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/telegram — webhook do bot. O Telegram envia o segredo definido no
 * setWebhook no cabeçalho X-Telegram-Bot-Api-Secret-Token; sem ele, recusamos.
 * Sempre respondemos 200 para o Telegram não reenviar a mesma mensagem em loop.
 */
export async function POST(request: Request) {
  const esperado = process.env.TELEGRAM_WEBHOOK_SEGREDO;
  if (!esperado || request.headers.get('x-telegram-bot-api-secret-token') !== esperado) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const atualizacao = (await request.json().catch(() => null)) as Atualizacao | null;
  if (atualizacao) {
    try {
      await tratarAtualizacao(atualizacao);
    } catch (erro) {
      console.error('[quita] telegram:', erro);
    }
  }
  return NextResponse.json({ ok: true });
}
