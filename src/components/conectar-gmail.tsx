'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconeCheck, IconeCopiar, IconeSeta } from './icones';

export function FormConectar() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="mt-8 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        setErro(null);
        try {
          const res = await fetch('/api/carteiras', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome }) });
          const corpo = await res.json();
          if (!res.ok) throw new Error(corpo.erro ?? 'Falha ao criar o painel.');
          router.push(corpo.destino);
        } catch (falha) {
          setErro(falha instanceof Error ? falha.message : 'Falha ao criar o painel.');
          setEnviando(false);
        }
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="nome">
        Nome da empresa ou da casa
      </label>
      <input
        id="nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={60}
        placeholder="Ex.: Padaria do Centro"
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-tinta-500 focus:border-limao-400"
      />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-limao-400 px-6 py-4 font-semibold text-floresta-950 transition hover:bg-limao-300 disabled:opacity-60"
      >
        {enviando ? 'Criando…' : 'Criar meu painel e continuar'} <IconeSeta size={18} />
      </button>
      {erro ? <p className="text-sm text-perigo-100">{erro}</p> : null}
    </form>
  );
}

export function CopiarScript({ script }: { script: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-tinta-200 bg-white">
      <div className="flex items-center justify-between border-b border-tinta-100 bg-tinta-50 px-4 py-2.5">
        <span className="font-mono text-xs text-tinta-500">Código.gs</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(script);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              setCopiado(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-floresta-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-floresta-800"
        >
          {copiado ? <IconeCheck size={14} /> : <IconeCopiar size={14} />} {copiado ? 'Copiado' : 'Copiar código'}
        </button>
      </div>
      <pre className="rolagem-fina max-h-72 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-tinta-700">{script}</pre>
    </div>
  );
}

/** Enquanto o Gmail não se conecta, recarrega o status a cada 5 segundos. */
export function AguardarConexao({ conectado }: { conectado: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (conectado) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [conectado, router]);
  return null;
}
