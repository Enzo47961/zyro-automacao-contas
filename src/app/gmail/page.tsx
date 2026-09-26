import type { Metadata } from 'next';
import Link from 'next/link';
import { IconeEmail, IconeEscudo, IconeRaio, IconeSeta, IconeSino } from '@/components/icones';
import { SimulacaoGmail } from '@/components/simulacao-gmail';
import { hoje } from '@/lib/formato';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Simulação no Gmail' };

const ETAPAS = [
  { icone: IconeEmail, titulo: 'Chega a conta no Gmail', texto: 'Boleto, conta de luz ou nota fiscal, em anexo ou com o código no texto.' },
  { icone: IconeRaio, titulo: 'O ZYRO lê e agenda', texto: 'Confere o código, lê valor e vencimento e marca os avisos na agenda.' },
  { icone: IconeEscudo, titulo: 'Repetida não conta', texto: 'Se a mesma conta chegar de novo, ele reconhece e não agenda em dobro.' },
  { icone: IconeSino, titulo: 'Aviso perto do vencimento', texto: 'Um e-mail para você mesmo: o Gmail notifica no celular e no computador.' },
];

export default function PaginaSimulacao() {
  return (
    <div className="min-h-dvh pb-16">
      <header className="relative overflow-hidden bg-floresta-950 text-white">
        <div className="grade-pontos pointer-events-none absolute inset-0" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-limao-400 text-floresta-950">
              <IconeRaio size={20} />
            </span>
            ZYRO
          </Link>
          <Link href="/conectar" className="inline-flex items-center gap-2 rounded-xl bg-limao-400 px-4 py-2 text-sm font-semibold text-floresta-950 hover:bg-limao-300">
            Ligar no meu Gmail <IconeSeta size={16} />
          </Link>
        </nav>
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-limao-300">Simulação</p>
          <h1 className="texto-equilibrado mt-2 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Chegou a conta no Gmail. <span className="text-limao-400">O aviso já está agendado.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-tinta-300">
            Faça e-mails chegarem nesta caixa de entrada e veja o robô trabalhar. Os anexos são gerados agora e passam pela mesma leitura do Gmail de
            verdade. Depois, avance o relógio para ver os avisos chegando.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS.map((e, i) => {
              const Icone = e.icone;
              return (
                <li key={e.titulo} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span className="flex items-center gap-2 text-limao-400">
                    <Icone size={18} /> <span className="font-mono text-xs text-tinta-400">0{i + 1}</span>
                  </span>
                  <p className="mt-2 font-semibold">{e.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-tinta-300">{e.texto}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <main className="-mt-4 pt-10">
        <SimulacaoGmail hojeInicial={hoje()} />

        <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-floresta-950 p-6 text-white sm:p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Quer isso no seu Gmail de verdade?</h2>
              <p className="mt-1 max-w-xl text-sm text-tinta-300">
                Você cola um script pronto no Google (2 minutos). Ele confere a caixa a cada 10 minutos e manda os avisos do seu próprio Gmail para você.
                Sem senha, sem instalar nada.
              </p>
            </div>
            <Link href="/conectar" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-limao-400 px-6 py-3.5 font-semibold text-floresta-950 hover:bg-limao-300">
              Ligar no meu Gmail <IconeSeta size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
