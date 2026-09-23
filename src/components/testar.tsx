'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Execucao, Passo } from '@/lib/banco';
import { htmlSeguro } from '@/lib/formato';
import { IconeAlerta, IconeCheck, IconeDocumento, IconeRaio, IconeUpload, IconeX } from './icones';

const EXEMPLOS = [
  { id: 'boleto-moinho', rotulo: 'Boleto de fornecedor', detalhe: 'PDF · Bradesco' },
  { id: 'conta-energia', rotulo: 'Conta de energia', detalhe: 'PDF · código de 48 dígitos' },
  { id: 'nfe-laticinios', rotulo: 'NF-e com 2 parcelas', detalhe: 'XML' },
  { id: 'boleto-internet', rotulo: 'Boleto da internet', detalhe: 'PDF · Itaú' },
];

const NOMES_PASSOS = ['Receber', 'Ler conteúdo', 'Encontrar códigos', 'Validar', 'Enriquecer', 'Evitar duplicidade', 'Salvar e agendar'];

type Resposta = { execucao: Omit<Execucao, 'id' | 'criado_em'>; mensagem: string; erro?: string };

const ICONE_PASSO: Record<Passo['status'], { cor: string; icone: React.ReactNode }> = {
  ok: { cor: 'bg-floresta-500 text-white', icone: <IconeCheck size={13} /> },
  aviso: { cor: 'bg-alerta-500 text-white', icone: <IconeAlerta size={12} /> },
  erro: { cor: 'bg-perigo-500 text-white', icone: <IconeX size={12} /> },
  pulado: { cor: 'bg-tinta-200 text-tinta-500', icone: <span className="text-[10px]">–</span> },
};

export function TestarAutomacao({ carteira }: { carteira: string }) {
  const router = useRouter();
  const [aba, setAba] = useState<'exemplos' | 'arquivo' | 'texto'>('exemplos');
  const [rodando, setRodando] = useState(false);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [visiveis, setVisiveis] = useState(0);
  const [texto, setTexto] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  // Revela os passos um a um: o tempo real de cada passo está no rótulo, a animação é só leitura.
  useEffect(() => {
    if (!resposta) return;
    setVisiveis(0);
    const total = resposta.execucao.passos.length;
    const timer = setInterval(() => setVisiveis((v) => (v >= total ? (clearInterval(timer), v) : v + 1)), 170);
    return () => clearInterval(timer);
  }, [resposta]);

  const enviar = async (dados: FormData) => {
    setRodando(true);
    setResposta(null);
    dados.set('carteira', carteira);
    try {
      const res = await fetch('/api/processar', { method: 'POST', body: dados });
      const corpo = (await res.json()) as Resposta;
      if (!res.ok) throw new Error(corpo.erro ?? 'Falha ao processar.');
      setResposta(corpo);
      router.refresh();
    } catch (erro) {
      setResposta({
        execucao: { carteira_id: '', documento_id: null, gatilho: 'upload', status: 'erro', resumo: '', passos: [], duracao_ms: 0 },
        mensagem: erro instanceof Error ? erro.message : 'Falha ao processar.',
      });
    } finally {
      setRodando(false);
    }
  };

  const porCampo = (campo: string, valor: string | File) => {
    const f = new FormData();
    f.set(campo, valor);
    void enviar(f);
  };

  const concluido = resposta && visiveis >= resposta.execucao.passos.length;
  const status = resposta?.execucao.status;

  return (
    <section className="rounded-3xl border border-tinta-200 bg-white shadow-suave">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tinta-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-tinta-900">Testar a automação</h2>
          <p className="text-xs text-tinta-500">O mesmo fluxo que roda quando alguém manda um documento para o bot.</p>
        </div>
        <div className="flex rounded-xl bg-tinta-100 p-1 text-xs font-semibold" role="tablist">
          {(
            [
              ['exemplos', 'Exemplos'],
              ['arquivo', 'Enviar arquivo'],
              ['texto', 'Colar código'],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`rounded-lg px-3 py-1.5 transition ${aba === id ? 'bg-white text-tinta-900 shadow-suave' : 'text-tinta-500 hover:text-tinta-800'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {aba === 'exemplos' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex.id}
                type="button"
                disabled={rodando}
                onClick={() => porCampo('exemplo', ex.id)}
                className="group flex items-center gap-3 rounded-2xl border border-tinta-200 p-3.5 text-left transition hover:border-floresta-500 hover:bg-floresta-50 disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-floresta-900 text-limao-400">
                  <IconeDocumento size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-tinta-900">{ex.rotulo}</span>
                  <span className="block text-xs text-tinta-500">{ex.detalhe}</span>
                </span>
                <IconeRaio size={16} className="ml-auto text-tinta-300 transition group-hover:text-floresta-500" />
              </button>
            ))}
          </div>
        ) : null}

        {aba === 'arquivo' ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => entrada.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const f = e.dataTransfer.files?.[0];
              if (f) porCampo('arquivo', f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              arrastando ? 'border-floresta-500 bg-floresta-50' : 'border-tinta-200 hover:border-floresta-500'
            }`}
          >
            <input
              ref={entrada}
              type="file"
              accept="application/pdf,.pdf,.xml,text/xml,application/xml,image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) porCampo('arquivo', f);
                e.target.value = '';
              }}
            />
            <IconeUpload size={26} className="text-floresta-600" />
            <p className="mt-3 font-semibold text-tinta-900">Arraste um boleto, conta ou XML de NF-e</p>
            <p className="mt-1 text-xs text-tinta-500">PDF ou XML até 8 MB. Vale um boleto seu de verdade: nada é enviado para fora.</p>
          </div>
        ) : null}

        {aba === 'texto' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) porCampo('texto', texto);
            }}
            className="space-y-3"
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="Cole a linha digitável do boleto (47 ou 48 dígitos) ou a chave da NF-e"
              className="w-full rounded-2xl border border-tinta-200 px-4 py-3 font-mono text-sm outline-none focus:border-floresta-500"
            />
            <button type="submit" disabled={rodando || !texto.trim()} className="rounded-xl bg-floresta-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-floresta-700 disabled:opacity-50">
              Processar
            </button>
          </form>
        ) : null}

        {/* Execução */}
        {rodando || resposta ? (
          <div className="mt-6 rounded-2xl bg-floresta-950 p-5 text-white" aria-live="polite">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-limao-400">Execução</span>
              {resposta ? <span className="font-mono text-tinta-300">{resposta.execucao.duracao_ms} ms no total</span> : <span className="text-tinta-300">processando…</span>}
            </div>
            <ol className="mt-4 space-y-2.5">
              {(resposta?.execucao.passos.length ? resposta.execucao.passos : NOMES_PASSOS.map((nome) => ({ nome, status: 'pulado' as const, ms: 0, detalhe: '' }))).map((passo, i) => {
                const mostrar = resposta ? i < visiveis : false;
                const estilo = ICONE_PASSO[passo.status];
                return (
                  <li key={passo.nome} className={`flex gap-3 transition-opacity ${mostrar ? 'opacity-100' : 'opacity-35'}`}>
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${mostrar ? estilo.cor : 'bg-white/10 text-transparent'}`}>
                      {mostrar ? estilo.icone : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{passo.nome}</span>
                        {mostrar ? <span className="shrink-0 font-mono text-[11px] text-tinta-400">{passo.ms} ms</span> : null}
                      </p>
                      {mostrar && passo.detalhe ? <p className="mt-0.5 break-words text-xs text-tinta-300">{passo.detalhe}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            {concluido ? (
              <div
                className={`mt-5 animate-surgir rounded-xl p-4 text-sm leading-relaxed ${
                  status === 'sucesso' ? 'bg-limao-400 text-floresta-950' : status === 'duplicado' ? 'bg-white/10 text-white' : 'bg-alerta-100 text-alerta-700'
                }`}
                dangerouslySetInnerHTML={{ __html: htmlSeguro(resposta.mensagem) }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
