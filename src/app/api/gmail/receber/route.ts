import { NextResponse } from 'next/server';
import { carteiraDoScript, receberEmail, type EmailRecebido } from '@/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/gmail/receber — chamado pelo script do Google no Gmail da pessoa,
 * um e-mail por vez: { id, de, assunto, corpo, anexos: [{ nome, mime, base64 }] }.
 * Autorização: "Bearer <chave do Gmail>" (aparece só na página de conexão).
 */
export async function POST(request: Request) {
  const carteira = await carteiraDoScript(request);
  if (!carteira) return NextResponse.json({ erro: 'Chave inválida.' }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Partial<EmailRecebido> | null;
  if (!corpo || typeof corpo.id !== 'string' || !corpo.id) return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });

  const email: EmailRecebido = {
    id: corpo.id,
    de: String(corpo.de ?? ''),
    assunto: String(corpo.assunto ?? ''),
    corpo: String(corpo.corpo ?? ''),
    anexos: (Array.isArray(corpo.anexos) ? corpo.anexos : [])
      .filter((a) => a && typeof a.base64 === 'string')
      .map((a) => ({ nome: String(a.nome ?? 'anexo'), mime: String(a.mime ?? ''), base64: a.base64 })),
  };
  const r = await receberEmail(carteira, email);
  return NextResponse.json({ resultado: r.resultado, contas: r.documentos.length });
}
