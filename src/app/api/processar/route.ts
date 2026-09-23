import { NextResponse } from 'next/server';
import { resolverCarteira } from '@/lib/carteira';
import { EXEMPLOS, gerarExemplo, type IdExemplo } from '@/lib/exemplos';
import { processar, type Entrada } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LIMITE = 8 * 1024 * 1024;

/**
 * POST /api/processar (multipart) — roda a automação sobre um documento vindo
 * do site: arquivo enviado, linha digitável colada ou um exemplo gerado na hora.
 * Campos: carteira ("demo" ou token), e um de: arquivo | texto | exemplo.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 });

  const carteira = await resolverCarteira(String(form.get('carteira') ?? ''));
  if (!carteira) return NextResponse.json({ erro: 'Carteira não encontrada.' }, { status: 404 });

  let entrada: Entrada;
  let gatilho: 'upload' | 'exemplo' | 'texto' = 'upload';
  const arquivo = form.get('arquivo');
  const texto = String(form.get('texto') ?? '').trim();
  const exemplo = String(form.get('exemplo') ?? '');

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > LIMITE) return NextResponse.json({ erro: 'Arquivo maior que 8 MB.' }, { status: 413 });
    entrada = { tipo: 'arquivo', nome: arquivo.name, mime: arquivo.type, bytes: new Uint8Array(await arquivo.arrayBuffer()) };
  } else if (EXEMPLOS.some((e) => e.id === exemplo)) {
    entrada = { tipo: 'arquivo', ...(await gerarExemplo(exemplo as IdExemplo, Date.now(), Math.floor(Math.random() * 9999))) };
    gatilho = 'exemplo';
  } else if (texto) {
    entrada = { tipo: 'texto', texto: texto.slice(0, 2000) };
    gatilho = 'texto';
  } else {
    return NextResponse.json({ erro: 'Envie um arquivo, um exemplo ou a linha digitável.' }, { status: 400 });
  }

  const resultado = await processar(entrada, { carteira, gatilho, origem: gatilho });
  return NextResponse.json(resultado);
}
