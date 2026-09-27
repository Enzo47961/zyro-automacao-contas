import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AguardarConexao, CopiarScript } from '@/components/conectar-gmail';
import { GuiaAutorizacao } from '@/components/guia-autorizacao';
import { IconeCheck, IconeEmail, IconeRaio, IconeSeta } from '@/components/icones';
import { resolverCarteira } from '@/lib/carteira';
import { scriptGmail } from '@/lib/script-gmail';

export const dynamic = 'force-dynamic';
// A página traz a chave do script: nunca indexar nem vazar no Referer.
export const metadata: Metadata = { title: 'Ligar no Gmail', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Props = { params: Promise<{ token: string }> };

const PASSOS = [
  <>
    Abra{' '}
    <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="font-semibold text-floresta-700 underline underline-offset-2">
      script.google.com
    </a>{' '}
    com a conta do Gmail que recebe as contas. Um projeto novo abre sozinho.
  </>,
  <>
    Clique em <b>Projeto sem título</b>, no topo, e renomeie para <b>ZYRO</b>. É o nome que vai aparecer nas telas de autorização.
  </>,
  <>Apague o que estiver no editor e cole o código abaixo. Clique no disquete para salvar.</>,
  <>
    No menu de cima, escolha a função <b>instalar</b> e clique em <b>Executar</b>.
  </>,
  <>
    O Google pede autorização e mostra um aviso de app não verificado. É esperado: faça o ensaio logo abaixo para ver cada tela e onde clicar.
  </>,
  <>
    Pronto. Quer ver funcionando na hora? Escolha a função <b>testar</b> e execute: chega um boleto de exemplo no seu Gmail e, logo depois, o aviso.
  </>,
];

export default async function PaginaGmail({ params }: Props) {
  const carteira = await resolverCarteira((await params).token);
  if (!carteira || carteira.demo || carteira.simulacao) notFound();

  const script = scriptGmail(process.env.APP_URL ?? 'https://quita-contas.vercel.app', carteira.chave_gmail);
  const conectado = Boolean(carteira.gmail_conectado_em);
  const ultima = carteira.gmail_verificado_em
    ? new Date(carteira.gmail_verificado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : null;

  return (
    <div className="min-h-dvh">
      <AguardarConexao conectado={conectado} />
      <header className="bg-floresta-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-limao-400 text-floresta-950">
              <IconeRaio size={18} />
            </span>
            ZYRO
          </Link>
          <Link href={`/p/${carteira.token_painel}`} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:border-limao-400">
            Meu painel <IconeSeta size={16} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-tinta-500">{carteira.nome}</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Ligar o ZYRO no seu Gmail</h1>

        <div
          className={`mt-6 flex items-center gap-3 rounded-2xl px-5 py-4 ${conectado ? 'bg-floresta-800 text-white' : 'border border-alerta-500/40 bg-alerta-100 text-alerta-700'}`}
          aria-live="polite"
        >
          {conectado ? <IconeCheck size={20} className="shrink-0 text-limao-400" /> : <IconeEmail size={20} className="shrink-0" />}
          <div className="text-sm">
            {conectado ? (
              <>
                <b>Gmail conectado</b>
                {carteira.gmail_email ? ` · ${carteira.gmail_email}` : ''}
                {ultima ? <span className="block text-tinta-200">Última conferência da caixa: {ultima}</span> : null}
              </>
            ) : (
              <>
                <b>Aguardando o Gmail…</b> Siga os passos abaixo. Esta página atualiza sozinha quando o script rodar pela primeira vez.
              </>
            )}
          </div>
        </div>

        <ol className="mt-8 space-y-4">
          {PASSOS.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-floresta-900 text-sm font-bold text-limao-400">{i + 1}</span>
              <p className="pt-0.5 text-tinta-700">{p}</p>
            </li>
          ))}
        </ol>

        <GuiaAutorizacao />

        <div className="mt-8">
          <CopiarScript script={script} />
          <p className="mt-2 text-xs text-tinta-500">
            O código tem a chave do seu painel. Não compartilhe. Se vazar, crie um painel novo e apague o script antigo.
          </p>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['A cada 10 minutos', 'O script procura e-mails novos com boleto, fatura ou nota fiscal e manda só esses para o ZYRO.'],
            ['Nunca em dobro', 'Cada e-mail é lido uma vez, e a mesma conta chegando em outro e-mail não vira outra conta.'],
            ['Aviso às 8h', 'Perto do vencimento, no dia e no dia seguinte, um e-mail seu para você. O Gmail notifica no celular.'],
          ].map(([titulo, texto]) => (
            <div key={titulo} className="rounded-2xl border border-tinta-200 bg-white p-4 shadow-suave">
              <p className="font-semibold">{titulo}</p>
              <p className="mt-1 text-sm text-tinta-600">{texto}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
