import Link from 'next/link';
import type { Carteira, Documento, Execucao } from '@/lib/banco';
import { dataCurta, hoje, reais } from '@/lib/formato';
import { ListaContas, ListaExecucoes } from './contas';
import { IconeRaio, IconeTelegram } from './icones';
import { TestarAutomacao } from './testar';

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? 'kdjdabot';

/** Soma por semana das contas em aberto nas próximas 4 semanas (inclui vencidas na 1ª barra). */
function previsao(documentos: Documento[], dia: string) {
  const inicio = Date.parse(`${dia}T12:00:00Z`);
  const semanas = [0, 1, 2, 3].map((i) => ({
    de: new Date(inicio + i * 7 * 86_400_000).toISOString().slice(0, 10),
    ate: new Date(inicio + (i * 7 + 6) * 86_400_000).toISOString().slice(0, 10),
    total: 0,
    contas: 0,
  }));
  for (const d of documentos) {
    if (d.status !== 'a_pagar' || !d.vencimento) continue;
    const alvo = d.vencimento < dia ? semanas[0] : semanas.find((s) => d.vencimento! >= s.de && d.vencimento! <= s.ate);
    if (alvo) {
      alvo.total += d.valor_centavos;
      alvo.contas += 1;
    }
  }
  return semanas;
}

export function Painel({ carteira, documentos, execucoes, chave }: { carteira: Carteira; documentos: Documento[]; execucoes: Execucao[]; chave: string }) {
  const dia = hoje();
  const mes = dia.slice(0, 7);
  const abertas = documentos.filter((d) => d.status === 'a_pagar');
  const vencidas = abertas.filter((d) => d.vencimento && d.vencimento < dia);
  const semana = abertas.filter((d) => d.vencimento && d.vencimento >= dia && d.vencimento <= new Date(Date.parse(`${dia}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10));
  const pagasMes = documentos.filter((d) => d.status === 'pago' && (d.pago_em ?? '').slice(0, 7) === mes);
  const soma = (lista: Documento[]) => lista.reduce((t, d) => t + d.valor_centavos, 0);

  const semanas = previsao(documentos, dia);
  const maiorSemana = Math.max(1, ...semanas.map((s) => s.total));

  const doMes = documentos.filter((d) => (d.vencimento ?? '').slice(0, 7) === mes);
  const porCategoria = [...doMes.reduce((m, d) => m.set(d.categoria, (m.get(d.categoria) ?? 0) + d.valor_centavos), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const totalMes = porCategoria.reduce((t, [, v]) => t + v, 0);
  const automaticos = execucoes.filter((e) => e.gatilho !== 'agendador');
  const taxaAuto = automaticos.length ? automaticos.filter((e) => e.status === 'sucesso' || e.status === 'duplicado').length / automaticos.length : 0;

  return (
    <div className="min-h-dvh">
      <header className="bg-floresta-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-limao-400 text-floresta-950">
                <IconeRaio size={18} />
              </span>
              ZYRO
            </Link>
            <span className="hidden text-tinta-400 sm:inline">/</span>
            <span className="max-w-[40vw] truncate text-sm font-medium text-tinta-100 sm:max-w-none">{carteira.nome}</span>
            {carteira.demo ? <span className="rounded-full bg-limao-400/15 px-2.5 py-1 text-[11px] font-semibold text-limao-300">demonstração</span> : null}
          </div>
          <a
            href={`https://t.me/${BOT}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-limao-400 px-4 py-2 text-sm font-semibold text-floresta-950 transition hover:bg-limao-300"
          >
            <IconeTelegram size={16} /> {carteira.telegram_chat_id ? 'Abrir o bot' : 'Testar no Telegram'}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {carteira.demo ? (
          <p className="mb-5 rounded-2xl border border-floresta-100 bg-floresta-50 px-4 py-3 text-sm text-floresta-800">
            Esta é a carteira de uma <strong>padaria fictícia</strong>. As contas chegaram pelo mesmo fluxo do bot e são recriadas todo dia. Teste a automação logo abaixo ou mande um boleto para{' '}
            <a href={`https://t.me/${BOT}`} className="font-semibold underline underline-offset-2" target="_blank" rel="noreferrer">
              @{BOT}
            </a>{' '}
            e ganhe o seu painel.
          </p>
        ) : null}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { rotulo: 'Vencidas', valor: reais(soma(vencidas), true), detalhe: `${vencidas.length} conta(s)`, destaque: vencidas.length > 0 ? 'text-perigo-500' : '' },
            { rotulo: 'Próximos 7 dias', valor: reais(soma(semana), true), detalhe: `${semana.length} conta(s)`, destaque: '' },
            { rotulo: 'Em aberto (total)', valor: reais(soma(abertas), true), detalhe: `${abertas.length} conta(s)`, destaque: '' },
            { rotulo: 'Pago no mês', valor: reais(soma(pagasMes), true), detalhe: `${pagasMes.length} conta(s)`, destaque: 'text-floresta-600' },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-2xl border border-tinta-200 bg-white p-4 shadow-suave sm:p-5">
              <p className="text-sm text-tinta-500">{k.rotulo}</p>
              <p className={`mt-1 truncate font-display text-2xl font-bold sm:text-3xl ${k.destaque}`}>{k.valor}</p>
              <p className="text-xs text-tinta-500">{k.detalhe}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <TestarAutomacao carteira={chave} />
            <ListaContas documentos={documentos} carteira={chave} />
          </div>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
              <h2 className="text-lg font-semibold">Saídas previstas</h2>
              <p className="text-xs text-tinta-500">Contas em aberto por semana (vencidas somam na primeira)</p>
              <div className="mt-5 flex h-40 items-end gap-3" role="img" aria-label="Saídas previstas por semana">
                {semanas.map((s, i) => (
                  <div key={s.de} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${reais(s.total)} · ${s.contas} conta(s)`}>
                    <span className="font-mono text-[11px] text-tinta-600">{s.total ? reais(s.total, true) : '—'}</span>
                    <div
                      className={`w-full rounded-t-md ${i === 0 ? 'bg-floresta-700' : 'bg-floresta-500'}`}
                      style={{ height: `${Math.max(s.total ? 6 : 2, (s.total / maiorSemana) * 100)}%`, opacity: s.total ? 1 : 0.25 }}
                    />
                    <span className="text-[11px] text-tinta-500">{i === 0 ? 'Esta semana' : dataCurta(s.de)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
              <h2 className="text-lg font-semibold">Por categoria</h2>
              <p className="text-xs text-tinta-500">Contas com vencimento neste mês · {reais(totalMes, true)}</p>
              <ul className="mt-4 space-y-3">
                {porCategoria.map(([categoria, valor]) => (
                  <li key={categoria}>
                    <div className="flex justify-between text-sm">
                      <span>{categoria}</span>
                      <span className="font-mono text-tinta-600">{reais(valor, true)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-tinta-100">
                      <div className="h-full rounded-full bg-floresta-600" style={{ width: `${(valor / totalMes) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {porCategoria.length === 0 ? <li className="text-sm text-tinta-500">Sem contas neste mês.</li> : null}
              </ul>
            </section>

            <div className="rounded-3xl bg-floresta-950 p-5 text-white">
              <p className="text-sm text-tinta-300">Documentos lidos sem intervenção</p>
              <p className="mt-1 font-display text-4xl font-bold text-limao-400">{Math.round(taxaAuto * 100)}%</p>
              <p className="mt-1 text-xs text-tinta-400">das últimas {automaticos.length} execuções terminaram sem precisar de revisão manual</p>
            </div>

            <ListaExecucoes execucoes={execucoes} />
          </aside>
        </div>
      </main>
    </div>
  );
}
