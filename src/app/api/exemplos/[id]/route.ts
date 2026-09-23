import { EXEMPLOS, gerarExemplo, type IdExemplo } from '@/lib/exemplos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/exemplos/{id} — baixa um documento de exemplo (para mandar ao bot). */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  if (!EXEMPLOS.some((e) => e.id === id)) return new Response('Exemplo não encontrado.', { status: 404 });
  const arquivo = await gerarExemplo(id as IdExemplo, Date.now(), Math.floor(Math.random() * 9999));
  return new Response(Buffer.from(arquivo.bytes), {
    headers: {
      'content-type': arquivo.mime,
      'content-disposition': `attachment; filename="${arquivo.nome}"`,
      'cache-control': 'no-store',
    },
  });
}
