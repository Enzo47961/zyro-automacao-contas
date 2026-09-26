import Link from 'next/link';
import type { Carteira, Documento, EmailLido, Execucao, Lembrete } from '@/lib/banco';
import { agendaDeAvisos, tituloAviso } from '@/lib/avisos';
import { dataCurta, hoje, reais } from '@/lib/formato';
import { ListaContas, ListaExecucoes } from './contas';
import { IconeCheck, IconeEmail, IconeRaio, IconeSino } from './icones';
import { TestarAutomacao } from './testar';

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

/** Próximos avisos das contas em aberto (e os que já saíram hoje), pela mesma regra do envio. */
function proximosAvisos(documentos: Documento[], lembretes: Lembrete[], antecedencia: number, dia: string) {
  const enviados = new Set(lembretes.map((l) => `${l.documento_id}:${l.tipo}`));
  return documentos
    .filter((d) => d.status === 'a_pagar' && d.vencimento)
    .flatMap((d) =>
      agendaDeAvisos(d.vencimento, antecedencia, hoje(Date.parse(d.criado_em))).map((a) => ({ ...a, documento: d, enviado: enviados.has(`${d.id}:${a.tipo}`) })),
    )
    .filter((a) => a.dia >= dia)
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .slice(0, 7);
}

type Props = { carteira: Carteira; documentos: Documento[]; execucoes: Execucao[]; lembretes: Lembrete[]; emails: EmailLido[]; chave: string };

export function Painel({ carteira, documentos, execucoes, lembretes, emails, chave }: Props) {
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
  const avisos = proximosAvisos(documentos, lembretes, carteira.antecedencia_dias, dia);
  const gmailAtivo = carteira.demo || carteira.simulacao || Boolean(carteira.gmail_conectado_em);
  const canais = [gmailAtivo ? 'e-mail' : null, carteira.telegram_chat_id ? 'Telegram' : null].filter(Boolean).join(' e ') || 'nenhum canal ligado ainda';
  const verificado = carteira.gmail_verificado_em
    ? new Date(carteira.gmail_verificado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : null;

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
          {carteira.demo || carteira.simulacao ? (
            <Link href="/gmail" className="inline-flex items-center gap-2 rounded-xl bg-limao-400 px-4 py-2 text-sm font-semibold text-floresta-950 transition hover:bg-limao-300">
              <IconeEmail size={16} /> Simulação no Gmail
            </Link>
          ) : (
            <Link
              href={`/p/${carteira.token_painel}/gmail`}
              className="inline-flex items-center gap-2 rounded-xl bg-limao-400 px-4 py-2 text-sm font-semibold text-floresta-950 transition hover:bg-limao-300"
            >
              <IconeEmail size={16} /> {carteira.gmail_conectado_em ? 'Gmail conectado' : 'Ligar no Gmail'}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {carteira.demo ? (
          <p className="mb-5 rounded-2xl border border-floresta-100 bg-floresta-50 px-4 py-3 text-sm text-floresta-800">
            Esta é a carteira de uma <strong>padaria fictícia</strong>. As contas chegaram pelo Gmail (e algumas pelo Telegram) e passaram pelo mesmo fluxo de
            verdade; tudo é recriado todo dia. Para ver o robô trabalhando e os avisos saindo, abra a{' '}
            <Link href="/gmail" className="font-semibold underline underline-offset-2">
              simulação no Gmail
            </Link>
            .
          </p>
        ) : carteira.simulacao ? (
          <p className="mb-5 rounded-2xl border border-floresta-100 bg-floresta-50 px-4 py-3 text-sm text-floresta-800">
            Carteira da sua <strong>simulação no Gmail</strong>. Ela é apagada em até um dia.
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

            <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
              <div className="flex items-center gap-2">
                <IconeSino size={18} className="text-floresta-600" />
                <h2 className="text-lg font-semibold">Próximos avisos</h2>
              </div>
              <p className="text-xs text-tinta-500">
                {carteira.antecedencia_dias} dias antes, no dia e no dia seguinte, às 8h · por {canais}
              </p>
              <ul className="mt-4 space-y-2.5">
                {avisos.map((a) => (
                  <li key={`${a.documento.id}:${a.tipo}`} className="flex items-center gap-3">
                    <span className={`w-14 shrink-0 rounded-lg px-1.5 py-1 text-center text-[11px] font-semibold ${a.dia === dia ? 'bg-limao-400 text-floresta-950' : 'bg-tinta-100 text-tinta-600'}`}>
                      {a.dia === dia ? 'hoje' : dataCurta(a.dia)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{a.documento.fornecedor}</span>
                      <span className="text-xs text-tinta-500">
                        {tituloAviso(a.tipo, a.documento.vencimento!, a.dia)} · {reais(a.documento.valor_centavos)}
                      </span>
                    </span>
                    {a.enviado ? <IconeCheck size={16} className="shrink-0 text-floresta-600" aria-label="enviado" /> : null}
                  </li>
                ))}
                {avisos.length === 0 ? <li className="text-sm text-tinta-500">Nenhum aviso agendado.</li> : null}
              </ul>
            </section>

            {!carteira.demo && !carteira.simulacao ? (
              <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
                <div className="flex items-center gap-2">
                  <IconeEmail size={18} className="text-floresta-600" />
                  <h2 className="text-lg font-semibold">Gmail</h2>
                </div>
                {carteira.gmail_conectado_em ? (
                  <>
                    <p className="mt-1 text-sm text-tinta-600">
                      Conectado{carteira.gmail_email ? ` · ${carteira.gmail_email}` : ''}
                      {verificado ? <span className="block text-xs text-tinta-500">última conferência: {verificado}</span> : null}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {emails
                        .filter((e) => e.resultado !== 'sem_conta')
                        .slice(0, 5)
                        .map((e) => (
                          <li key={e.mensagem_id} className="flex gap-2">
                            <span className={e.resultado === 'conta' ? 'text-floresta-600' : 'text-alerta-500'}>●</span>
                            <span className="min-w-0 flex-1 truncate">
                              {e.assunto || '(sem assunto)'} <span className="text-tinta-400">· {e.resultado === 'conta' ? 'agendada' : 'repetida'}</span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-tinta-600">
                    Ainda não ligado.{' '}
                    <Link href={`/p/${carteira.token_painel}/gmail`} className="font-semibold text-floresta-700 underline underline-offset-2">
                      Ligar agora
                    </Link>
                  </p>
                )}
              </section>
            ) : null}

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
