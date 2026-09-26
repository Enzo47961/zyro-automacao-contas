import Link from 'next/link';
import {
  IconeCalendario,
  IconeCelular,
  IconeCheck,
  IconeCodigoBarras,
  IconeDocumento,
  IconeEmail,
  IconeEscudo,
  IconeFluxo,
  IconeGrafico,
  IconeRaio,
  IconeRelogio,
  IconeSeta,
  IconeSino,
  IconeTelegram,
} from '@/components/icones';

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? 'kdjdabot';

const PASSOS = [
  { nome: 'Chega', texto: 'A conta cai no Gmail: boleto, conta de luz ou nota fiscal' },
  { nome: 'Lê', texto: 'Anexo em PDF, XML da NF-e ou o código no texto do e-mail' },
  { nome: 'Confere', texto: 'Dígitos verificadores: código errado é recusado' },
  { nome: 'Barra repetida', texto: 'A mesma conta em outro e-mail não entra de novo' },
  { nome: 'Agenda', texto: 'Avisos antes, no dia e no dia seguinte ao vencimento' },
  { nome: 'Avisa', texto: 'E-mail para você: o Gmail notifica no celular e no PC' },
];

const TECNICO = [
  { icone: IconeEmail, titulo: 'Direto do seu Gmail', texto: 'Um script do Google roda na sua própria conta, confere a caixa a cada 10 minutos e manda ao ZYRO só os e-mails com cara de conta. Nenhuma senha passa por aqui.' },
  { icone: IconeEscudo, titulo: 'Nunca em dobro', texto: 'Cada e-mail é lido uma vez. E se a mesma conta chegar de novo (reenvio, lembrete da empresa), a impressão digital do código reconhece e não agenda outra vez.' },
  { icone: IconeCodigoBarras, titulo: 'Leitura matemática do boleto', texto: 'Valor, banco e vencimento saem da própria linha digitável, conferida por módulo 10 e 11, inclusive o reinício do fator de vencimento de fevereiro de 2025.' },
  { icone: IconeDocumento, titulo: 'NF-e vira parcelas', texto: 'Do XML da nota saem emitente, CNPJ e cada duplicata com o seu vencimento. Uma nota de 3 parcelas vira 3 contas, cada uma com os seus avisos.' },
  { icone: IconeSino, titulo: 'Aviso no celular sem app novo', texto: 'O aviso é um e-mail do seu Gmail para você mesmo, às 8h. O app do Gmail já notifica no celular e no computador. Sem domínio, sem SMS.' },
  { icone: IconeFluxo, titulo: 'Execuções auditáveis', texto: 'Cada e-mail gera um registro passo a passo, com tempo e resultado, como uma execução de n8n. Dá para ver por que cada conta entrou ou não.' },
];

export default function Inicio() {
  return (
    <div className="min-h-dvh">
      <header className="relative overflow-hidden bg-floresta-950 text-white">
        <div className="grade-pontos pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-limao-400/10 blur-3xl" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-limao-400 text-floresta-950">
              <IconeRaio size={20} />
            </span>
            ZYRO
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-tinta-200 hover:text-white sm:block">
              Painel demo
            </Link>
            <Link href="/conectar" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:border-limao-400">
              Ligar no Gmail
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-14">
          <div className="animate-surgir">
            <p className="inline-flex items-center gap-2 rounded-full bg-limao-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-limao-300">
              <IconeEmail size={14} /> Contas a pagar no automático
            </p>
            <h1 className="texto-equilibrado mt-6 text-5xl font-bold leading-[1.02] sm:text-6xl">
              Chegou a conta no Gmail. <span className="text-limao-400">O aviso já está marcado.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-tinta-300">
              O ZYRO fica de olho no seu Gmail. Quando chega um boleto, uma conta de luz ou uma nota fiscal, ele lê valor e vencimento e agenda o aviso
              sozinho. Perto de vencer, o celular apita. Se a mesma conta chegar duas vezes, ele percebe e não avisa em dobro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/gmail" className="inline-flex items-center gap-2 rounded-2xl bg-limao-400 px-6 py-4 font-semibold text-floresta-950 transition hover:bg-limao-300">
                <IconeRaio size={18} /> Ver a simulação
              </Link>
              <Link href="/conectar" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-semibold transition hover:border-limao-400">
                Ligar no meu Gmail <IconeSeta size={18} />
              </Link>
            </div>
            <p className="mt-4 text-xs text-tinta-400">A simulação não pede cadastro: você faz e-mails chegarem e vê os avisos saindo.</p>
          </div>

          {/* Ilustração: caixa de entrada + notificação */}
          <div className="relative mx-auto w-full max-w-sm animate-surgir">
            <div className="rounded-[1.6rem] border border-white/10 bg-white p-2 text-tinta-900 shadow-alta">
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold">
                <IconeEmail size={16} className="text-perigo-500" /> Caixa de entrada
              </div>
              {[
                { de: 'Energia Paulista', assunto: 'Sua conta de energia chegou', selo: 'aviso agendado', cor: 'bg-floresta-50 text-floresta-700' },
                { de: 'Moinho Bom Trigo', assunto: 'Boleto do pedido 4471', selo: 'aviso agendado', cor: 'bg-floresta-50 text-floresta-700' },
                { de: 'Moinho Bom Trigo', assunto: 'RE: Boleto do pedido 4471 (reenvio)', selo: 'repetida · ignorada', cor: 'bg-alerta-100 text-alerta-700' },
                { de: 'Loja do Confeiteiro', assunto: 'Só hoje: 20% de desconto', selo: 'não é conta', cor: 'bg-tinta-100 text-tinta-500' },
              ].map((e) => (
                <div key={e.assunto} className="flex items-center gap-3 border-t border-tinta-100 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tinta-200 text-xs font-bold text-tinta-700">{e.de[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{e.de}</span>
                    <span className="block truncate text-xs text-tinta-500">{e.assunto}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.cor}`}>{e.selo}</span>
                </div>
              ))}
            </div>
            <div className="absolute -bottom-10 -left-4 w-64 rounded-2xl border border-tinta-200 bg-white p-3 text-tinta-900 shadow-alta sm:-left-10">
              <div className="flex gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-floresta-900 text-limao-400">
                  <IconeCelular size={16} />
                </span>
                <div className="min-w-0 text-xs">
                  <p className="text-[10px] text-tinta-500">Gmail · 08:00</p>
                  <p className="font-semibold">Vence em 3 dias · R$ 687,34</p>
                  <p className="truncate text-tinta-600">Energia Paulista</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Fluxo */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floresta-600">O fluxo</p>
        <h2 className="mt-2 text-4xl font-bold">Do e-mail ao aviso, sem digitar nada.</h2>
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PASSOS.map((p, i) => (
            <li key={p.nome} className="relative rounded-2xl border border-tinta-200 bg-white p-4 shadow-suave">
              <span className="font-mono text-xs text-tinta-400">0{i + 1}</span>
              <p className="mt-1 font-display text-lg font-bold">{p.nome}</p>
              <p className="mt-1 text-xs leading-relaxed text-tinta-500">{p.texto}</p>
              {i < PASSOS.length - 1 ? <IconeSeta size={16} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-floresta-500 lg:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Duas formas de testar */}
      <section className="border-y border-tinta-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl bg-floresta-950 p-7 text-white">
            <IconeRaio size={24} className="text-limao-400" />
            <h2 className="mt-4 text-3xl font-bold">Simulação no navegador</h2>
            <p className="mt-2 flex-1 text-tinta-300">
              Uma caixa de entrada de mentira com e-mails de verdade: conta de luz, boleto, nota fiscal, propaganda e reenvios. Você vê o robô ler cada
              um, barrar as repetidas e, avançando o relógio, os avisos chegando no celular.
            </p>
            <Link href="/gmail" className="mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-limao-400 px-5 py-3 font-semibold text-floresta-950 hover:bg-limao-300">
              Abrir a simulação <IconeSeta size={18} />
            </Link>
          </div>
          <div className="flex flex-col rounded-3xl border border-tinta-200 p-7">
            <IconeEmail size={24} className="text-floresta-600" />
            <h2 className="mt-4 text-3xl font-bold">No seu Gmail de verdade</h2>
            <ol className="mt-3 flex-1 space-y-2 text-tinta-600">
              {['Crie o seu painel (só o nome).', 'Cole o script pronto em script.google.com e clique em Executar.', 'Rode “testar”: chega um boleto de exemplo e, logo depois, o aviso.'].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-floresta-900 text-xs font-bold text-limao-400">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <Link href="/conectar" className="mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-floresta-900 px-5 py-3 font-semibold text-white hover:bg-floresta-800">
              Ligar no meu Gmail <IconeSeta size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Técnico */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floresta-600">Por dentro</p>
        <h2 className="mt-2 max-w-2xl text-4xl font-bold">Nada é adivinhado. Tudo é conferido.</h2>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {TECNICO.map((t) => {
            const Icone = t.icone;
            return (
              <div key={t.titulo}>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-limao-400 text-floresta-950">
                  <Icone size={20} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{t.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-tinta-600">{t.texto}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-14 flex flex-col gap-4 rounded-3xl border border-tinta-200 bg-white p-6 shadow-suave sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <IconeTelegram size={22} className="mt-0.5 shrink-0 text-floresta-600" />
            <div>
              <p className="font-semibold">Prefere o Telegram?</p>
              <p className="text-sm text-tinta-600">O mesmo robô também recebe contas encaminhadas para o bot e manda os avisos por lá, com botão “Marcar como paga”.</p>
            </div>
          </div>
          <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-tinta-200 px-4 py-2.5 text-sm font-semibold hover:border-floresta-500">
            Abrir @{BOT} <IconeSeta size={16} />
          </a>
        </div>
      </section>

      <section className="bg-floresta-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Para quem recebe conta por e-mail e paga multa por esquecer.</h2>
            <p className="mt-2 max-w-xl text-tinta-300">Padarias, restaurantes, oficinas, clínicas, lojas e também a conta de casa.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['Sem multa por esquecimento', 'Sem planilha', 'Sem aviso repetido'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                <IconeCheck size={14} className="text-limao-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-tinta-500">
        <p className="inline-flex items-center gap-1.5">
          <IconeCalendario size={14} /> ZYRO · projeto de portfólio · Next.js, Supabase, Google Apps Script, Telegram Bot API e Vercel Cron
        </p>
        <p className="mt-2 inline-flex items-center gap-3">
          <Link href="/demo" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            <IconeGrafico size={13} /> painel demo
          </Link>
          <span className="inline-flex items-center gap-1">
            <IconeRelogio size={13} /> avisos às 8h (Brasília)
          </span>
        </p>
      </footer>
    </div>
  );
}
