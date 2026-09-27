import type { Metadata } from 'next';
import Link from 'next/link';
import { FormConectar } from '@/components/conectar-gmail';
import { IconeRaio } from '@/components/icones';

export const metadata: Metadata = { title: 'Ligar no Gmail' };

export default function PaginaConectar() {
  return (
    <div className="min-h-dvh bg-floresta-950 text-white">
      <div className="grade-pontos pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-lg px-4 py-10 sm:py-16">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-limao-400 text-floresta-950">
            <IconeRaio size={20} />
          </span>
          ZYRO
        </Link>
        <h1 className="mt-10 text-4xl font-bold leading-tight">Ligar o ZYRO no seu Gmail</h1>
        <p className="mt-3 text-tinta-300">
          Primeiro criamos o seu painel. Na próxima tela você recebe um script pronto para colar no Google. Ele roda na sua conta: o ZYRO nunca vê a sua
          senha.
        </p>
        <FormConectar />
        <ul className="mt-8 space-y-2 text-sm text-tinta-300">
          <li>• Só e-mails com cara de conta são lidos (boleto, fatura, nota fiscal).</li>
          <li>• O texto do e-mail não fica guardado: só valor, vencimento e fornecedor.</li>
          <li>• Para desligar, basta apagar o script no Google.</li>
          <li>• Na instalação, o Google mostra um aviso de “app não verificado”. É normal para scripts pessoais: a próxima tela mostra onde clicar.</li>
        </ul>
        <p className="mt-8 text-sm text-tinta-400">
          Só quer ver como funciona?{' '}
          <Link href="/gmail" className="font-semibold text-limao-400 underline underline-offset-2">
            Abra a simulação
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
