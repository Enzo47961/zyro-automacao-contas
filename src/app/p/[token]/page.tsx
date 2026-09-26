import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Painel } from '@/components/painel';
import { banco } from '@/lib/banco';
import { resolverCarteira } from '@/lib/carteira';

export const dynamic = 'force-dynamic';
// Link pessoal enviado pelo bot: nunca indexar nem vazar no Referer.
export const metadata: Metadata = { title: 'Minhas contas', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Props = { params: Promise<{ token: string }> };

export default async function PaginaCarteira({ params }: Props) {
  const carteira = await resolverCarteira((await params).token);
  if (!carteira || carteira.demo) notFound();
  const dados = await banco.painel(carteira.id);
  return <Painel carteira={carteira} {...dados} chave={carteira.token_painel} />;
}
