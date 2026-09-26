import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Painel } from '@/components/painel';
import { banco } from '@/lib/banco';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Painel de demonstração' };

export default async function PaginaDemo() {
  const carteira = await banco.carteiraDemo();
  if (!carteira) notFound();
  const dados = await banco.painel(carteira.id);
  return <Painel carteira={carteira} {...dados} chave="demo" />;
}
