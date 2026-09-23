import Link from 'next/link';
import {
  IconeCalendario,
  IconeCheck,
  IconeCodigoBarras,
  IconeDocumento,
  IconeDownload,
  IconeEscudo,
  IconeFluxo,
  IconeGrafico,
  IconeRaio,
  IconeRelogio,
  IconeSeta,
  IconeTelegram,
} from '@/components/icones';

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? 'kdjdabot';

const PASSOS = [
  { nome: 'Receber', texto: 'PDF, XML ou código colado no Telegram ou no painel' },
  { nome: 'Ler', texto: 'Texto do PDF e campos do XML da NF-e' },
  { nome: 'Validar', texto: 'Dígitos verificadores: código errado é recusado' },
  { nome: 'Enriquecer', texto: 'Fornecedor, CNPJ e categoria' },
  { nome: 'Deduplicar', texto: 'O mesmo boleto nunca entra duas vezes' },
  { nome: 'Agendar', texto: 'Lembretes antes, no dia e depois do vencimento' },
];

const EXEMPLOS = [
  { id: 'boleto-moinho', rotulo: 'Boleto de fornecedor', formato: 'PDF' },
  { id: 'conta-energia', rotulo: 'Conta de energia', formato: 'PDF' },
  { id: 'nfe-laticinios', rotulo: 'NF-e com 2 parcelas', formato: 'XML' },
  { id: 'boleto-internet', rotulo: 'Boleto da internet', formato: 'PDF' },
];

const TECNICO = [
  { icone: IconeCodigoBarras, titulo: 'Leitura matemática do boleto', texto: 'Valor, banco e vencimento saem da própria linha digitável, conferida por módulo 10 e 11 — inclusive o reinício do fator de vencimento de fevereiro de 2025.' },
  { icone: IconeDocumento, titulo: 'NF-e vira parcelas', texto: 'Do XML da nota saem emitente, CNPJ e cada duplicata com o seu vencimento. Uma nota de 3 parcelas vira 3 contas.' },
  { icone: IconeEscudo, titulo: 'Sem lançamento duplo', texto: 'Cada documento tem uma impressão digital. Reenviou o mesmo boleto? O Quita avisa e não lança de novo.' },
  { icone: IconeRelogio, titulo: 'Agendador diário', texto: 'Todo dia às 8h: lembrete X dias antes, no dia e no dia seguinte — nunca repetido. Às segundas, o resumo da semana.' },
  { icone: IconeFluxo, titulo: 'Execuções auditáveis', texto: 'Cada documento gera um registro passo a passo, com tempo e resultado, como uma execução de n8n.' },
  { icone: IconeGrafico, titulo: 'Painel pessoal', texto: 'Cada conversa no bot ganha um painel próprio com contas, previsão de saídas e gastos por categoria.' },
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
            Quita
          </Link>
          <Link href="/demo" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:border-limao-400">
            Painel demo
          </Link>
        </nav>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-14">
          <div className="animate-surgir">
            <p className="inline-flex items-center gap-2 rounded-full bg-limao-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-limao-300">
              <IconeTelegram size={14} /> Automação de contas a pagar
            </p>
            <h1 className="texto-equilibrado mt-6 text-5xl font-bold leading-[1.02] sm:text-6xl">
              Encaminhou o boleto. <span className="text-limao-400">Esqueceu a preocupação.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-tinta-300">
              Mande o boleto, a conta de consumo ou o XML da nota fiscal para o bot. O Quita confere o código, lê valor e
              vencimento, organiza por fornecedor e te chama no Telegram antes de vencer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-limao-400 px-6 py-4 font-semibold text-floresta-950 transition hover:bg-limao-300">
                <IconeTelegram size={18} /> Testar no Telegram
              </a>
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-semibold transition hover:border-limao-400">
                Ver o painel <IconeSeta size={18} />
              </Link>
            </div>
            <p className="mt-4 text-xs text-tinta-400">Sem cadastro: o /start no bot já cria o seu painel. Use os documentos de exemplo abaixo.</p>
          </div>

          {/* Conversa ilustrativa */}
          <div className="mx-auto w-full max-w-sm animate-surgir rounded-[2rem] border border-white/10 bg-floresta-900 p-4 shadow-alta">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-limao-400 text-floresta-950">
                <IconeRaio size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold">Quita</p>
                <p className="text-[11px] text-tinta-400">bot</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 text-sm">
              <div className="ml-auto flex w-fit max-w-[85%] items-center gap-2 rounded-2xl rounded-br-md bg-floresta-600 px-3 py-2">
                <IconeDocumento size={16} /> boleto-moinho.pdf
              </div>
              <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2.5 leading-relaxed">
                ✅ Conta cadastrada:
                <br />• <b>Moinho Bom Trigo Ltda</b> — R$ 1.842,50 · vence em 5 dias
                <br />
                <br />⏰ Vou te lembrar 3 dias antes e no dia.
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-xs font-semibold">
                  <span className="rounded-lg bg-white/10 py-1.5">✅ Paguei</span>
                  <span className="rounded-lg bg-white/10 py-1.5">📋 Linha digitável</span>
                </div>
              </div>
              <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-limao-400 px-3 py-2.5 font-medium leading-relaxed text-floresta-950">
                🔔 <b>Vence hoje</b>
                <br />
                Energia Paulista · R$ 687,34
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Fluxo */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floresta-600">O fluxo</p>
        <h2 className="mt-2 text-4xl font-bold">Seis passos, zero digitação.</h2>
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

      {/* Exemplos */}
      <section id="exemplos" className="scroll-mt-6 border-y border-tinta-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-4xl font-bold">Teste com um documento de exemplo</h2>
            <ol className="mt-6 space-y-3 text-tinta-600">
              {['Baixe um dos arquivos ao lado (boletos gerados agora, com vencimento nos próximos dias).', `Abra o @${BOT} no Telegram e toque em Iniciar.`, 'Encaminhe o arquivo para o bot e veja a resposta com os botões.'].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-floresta-900 text-sm font-bold text-limao-400">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-tinta-500">Documentos de demonstração com empresas e CNPJs fictícios, mas com códigos matematicamente válidos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXEMPLOS.map((ex) => (
              <a
                key={ex.id}
                href={`/api/exemplos/${ex.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-tinta-200 p-4 transition hover:border-floresta-500 hover:bg-floresta-50"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-floresta-900 text-xs font-bold text-limao-400">{ex.formato}</span>
                <span className="flex-1 font-semibold">{ex.rotulo}</span>
                <IconeDownload size={18} className="text-tinta-400 group-hover:text-floresta-600" />
              </a>
            ))}
            <Link href="/demo" className="flex items-center justify-center gap-2 rounded-2xl bg-floresta-900 p-4 font-semibold text-white transition hover:bg-floresta-800 sm:col-span-2">
              Sem Telegram? Teste direto no painel <IconeSeta size={18} />
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
      </section>

      <section className="bg-floresta-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Para quem paga fornecedor toda semana.</h2>
            <p className="mt-2 max-w-xl text-tinta-300">Padarias, restaurantes, oficinas, clínicas, lojas: quem recebe boleto por e-mail e WhatsApp e paga multa por esquecer.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['Sem multa por esquecimento', 'Sem planilha', 'Sem digitar código'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                <IconeCheck size={14} className="text-limao-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-tinta-500">
        <p className="inline-flex items-center gap-1.5">
          <IconeCalendario size={14} /> Quita · projeto de portfólio · Next.js, Supabase, Telegram Bot API e Vercel Cron
        </p>
      </footer>
    </div>
  );
}
