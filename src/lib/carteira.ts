import 'server-only';
import { banco, type Carteira } from './banco';

/** "demo" → carteira de demonstração; token de 36 hex → carteira pessoal (link enviado pelo bot). */
export async function resolverCarteira(chave: string | null | undefined): Promise<Carteira | null> {
  if (chave === 'demo') return banco.carteiraDemo();
  if (chave && /^[a-f0-9]{36}$/.test(chave)) return banco.carteiraPorToken(chave);
  return null;
}
