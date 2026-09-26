import { NextResponse } from 'next/server';
import { banco, type TipoLembrete } from '@/lib/banco';
import { hojeBrasilia } from '@/lib/exemplos';
import { carteiraDoScript, montarAviso } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

const TIPOS: TipoLembrete[] = ['antecedencia', 'vencimento', 'atraso'];

/**
 * GET /api/gmail/avisos — avisos que o script deve mandar por e-mail agora.
 * O script roda de hora em hora; só entregamos a partir das 8h (Brasília),
 * a não ser no teste da instalação (?agora=1).
 * POST /api/gmail/avisos { enviados: [{ documento, tipo }] } — confirma o envio:
 * a partir daí, esse aviso nunca mais sai.
 */
export async function GET(request: Request) {
  const carteira = await carteiraDoScript(request);
  if (!carteira) return NextResponse.json({ erro: 'Chave inválida.' }, { status: 401 });
  await banco.gmailPing(carteira.id, null);

  const hora = new Date(Date.now() - 3 * 3_600_000).getUTCHours();
  const agora = new URL(request.url).searchParams.get('agora') === '1';
  if (hora < 8 && !agora) return NextResponse.json({ avisos: [], motivo: 'os avisos saem a partir das 8h' });

  const hoje = hojeBrasilia();
  const avisos = (await banco.avisosEmail(carteira.id, hoje)).map((a) => ({
    documento: a.documento.id,
    tipo: a.tipo,
    ...montarAviso(a.tipo, a.documento, carteira, hoje),
  }));
  return NextResponse.json({ avisos });
}

export async function POST(request: Request) {
  const carteira = await carteiraDoScript(request);
  if (!carteira) return NextResponse.json({ erro: 'Chave inválida.' }, { status: 401 });
  const corpo = (await request.json().catch(() => ({}))) as { enviados?: Array<{ documento?: string; tipo?: string }> };
  const enviados = (corpo.enviados ?? []).filter(
    (e): e is { documento: string; tipo: TipoLembrete } => /^[0-9a-f-]{36}$/.test(e.documento ?? '') && TIPOS.includes(e.tipo as TipoLembrete),
  );
  for (const e of enviados.slice(0, 50)) await banco.avisoEmailEnviado(carteira.id, e.documento, e.tipo);
  if (enviados.length) {
    await banco.registrarExecucao({
      carteira_id: carteira.id,
      documento_id: null,
      gatilho: 'agendador',
      status: 'sucesso',
      resumo: `${enviados.length} aviso(s) enviado(s) por e-mail`,
      passos: enviados.map((e) => ({
        nome: `Aviso ${e.tipo} por e-mail`,
        status: 'ok' as const,
        ms: 0,
        detalhe: `enviado pelo Gmail para ${carteira.gmail_email ?? 'a própria conta'}`,
      })),
      duracao_ms: 0,
    });
  }
  return NextResponse.json({ ok: true, confirmados: enviados.length });
}
