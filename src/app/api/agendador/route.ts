import { NextResponse } from 'next/server';
import { banco, type Passo } from '@/lib/banco';
import { regenerarDemo } from '@/lib/demo';
import { hojeBrasilia } from '@/lib/exemplos';
import { escapar } from '@/lib/pipeline';
import { botoesConta, enviar, resumoContas } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

const TITULOS = {
  antecedencia: (dias: number) => `⏰ Vence em ${dias} dia(s)`,
  vencimento: () => '🔔 <b>Vence hoje</b>',
  atraso: () => '⚠️ <b>Venceu ontem</b> — ainda dá tempo de pagar com multa pequena',
};

/**
 * GET /api/agendador — rodado todo dia às 8h (Vercel Cron, 11:00 UTC).
 * 1. envia os lembretes do dia (antecedência, vencimento, atraso) — nunca repete;
 * 2. às segundas, manda o resumo da semana;
 * 3. recria a carteira de demonstração.
 */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const inicio = Date.now();
  const hoje = hojeBrasilia();
  const relatorio = { lembretes: 0, falhas: 0, resumos: 0, demo: null as null | { contas: number } };

  const pendentes = await banco.lembretesPendentes(hoje);
  const porCarteira = new Map<string, Passo[]>();
  for (const l of pendentes) {
    const d = l.documento;
    const t0 = Date.now();
    const titulo = l.tipo === 'antecedencia' ? TITULOS.antecedencia(Math.round((Date.parse(d.vencimento ?? hoje) - Date.parse(hoje)) / 86_400_000)) : TITULOS[l.tipo]();
    try {
      await enviar(
        l.chat_id,
        `${titulo}\n\n<b>${escapar(d.fornecedor)}</b>\n${reais(d.valor_centavos)} · vencimento ${dataBr(d.vencimento)}${d.descricao ? `\n${escapar(d.descricao)}` : ''}`,
        botoesConta(d, { token_painel: l.token_painel }),
      );
      await banco.lembreteEnviado(d.id, l.tipo);
      relatorio.lembretes += 1;
      porCarteira.set(l.carteira_id, [...(porCarteira.get(l.carteira_id) ?? []), { nome: `Lembrete ${l.tipo}`, status: 'ok', ms: Date.now() - t0, detalhe: `${d.fornecedor} · ${reais(d.valor_centavos)}` }]);
    } catch (erro) {
      relatorio.falhas += 1;
      porCarteira.set(l.carteira_id, [...(porCarteira.get(l.carteira_id) ?? []), { nome: `Lembrete ${l.tipo}`, status: 'erro', ms: Date.now() - t0, detalhe: String(erro).slice(0, 120) }]);
    }
  }
  for (const [carteira, passos] of porCarteira) {
    await banco.registrarExecucao({
      carteira_id: carteira,
      documento_id: null,
      gatilho: 'agendador',
      status: passos.some((p) => p.status === 'erro') ? 'erro' : 'sucesso',
      resumo: `${passos.length} lembrete(s) enviado(s) no Telegram`,
      passos,
      duracao_ms: passos.reduce((t, p) => t + p.ms, 0),
    });
  }

  // Segunda-feira: resumo da semana para quem usa o bot.
  if (new Date(`${hoje}T12:00:00Z`).getUTCDay() === 1) {
    for (const carteira of await banco.carteirasTelegram()) {
      try {
        await enviar(carteira.telegram_chat_id!, `☀️ <b>Bom dia! Resumo da semana</b>\n\n${await resumoContas(carteira)}`);
        relatorio.resumos += 1;
      } catch {
        relatorio.falhas += 1;
      }
    }
  }

  relatorio.demo = await regenerarDemo();
  return NextResponse.json({ ok: true, hoje, ...relatorio, duracao_ms: Date.now() - inicio });
}
