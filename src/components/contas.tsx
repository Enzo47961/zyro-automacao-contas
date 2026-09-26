'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import type { Documento, Execucao } from '@/lib/banco';
import { dataBr, dataCurta, formatarLinha, hoje, prazo, reais, TOM } from '@/lib/formato';
import { IconeCheck, IconeChevron, IconeCopiar, IconeDocumento, IconeEmail, IconeFluxo, IconeRelogio, IconeTelegram, IconeUpload } from './icones';

type Filtro = 'abertas' | 'vencidas' | 'pagas';

const ORIGEM: Record<Documento['origem'], { rotulo: string; icone: React.ReactNode }> = {
  gmail: { rotulo: 'Gmail', icone: <IconeEmail size={13} /> },
  telegram: { rotulo: 'Telegram', icone: <IconeTelegram size={13} /> },
  upload: { rotulo: 'Upload', icone: <IconeUpload size={13} /> },
  exemplo: { rotulo: 'Exemplo', icone: <IconeDocumento size={13} /> },
  texto: { rotulo: 'Código colado', icone: <IconeDocumento size={13} /> },
};

const TIPO: Record<Documento['tipo'], string> = { boleto: 'Boleto', arrecadacao: 'Conta/tributo', nfe: 'NF-e', outro: 'Outro' };

export function ListaContas({ documentos, carteira }: { documentos: Documento[]; carteira: string }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState<string | null>(null);
  const dia = hoje();

  const grupos = useMemo(
    () => ({
      abertas: documentos.filter((d) => d.status === 'a_pagar' && (!d.vencimento || d.vencimento >= dia)),
      vencidas: documentos.filter((d) => d.status === 'a_pagar' && d.vencimento && d.vencimento < dia),
      pagas: documentos.filter((d) => d.status === 'pago').sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? '')),
    }),
    [documentos, dia],
  );
  const lista = grupos[filtro];

  const mudar = (id: string, status: 'pago' | 'a_pagar') =>
    iniciar(async () => {
      await fetch(`/api/contas/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ carteira, status }) });
      router.refresh();
    });

  const copiar = async (d: Documento) => {
    if (!d.linha_digitavel) return;
    try {
      await navigator.clipboard.writeText(d.linha_digitavel);
      setCopiado(d.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setAberto(d.id);
    }
  };

  return (
    <section className="min-w-0 rounded-3xl border border-tinta-200 bg-white shadow-suave">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tinta-100 px-5 py-4">
        <h2 className="text-lg font-semibold">Contas</h2>
        <div className="flex gap-1.5 text-xs font-semibold">
          {(
            [
              ['abertas', 'A pagar', 'bg-tinta-900 text-white'],
              ['vencidas', 'Vencidas', 'bg-perigo-500 text-white'],
              ['pagas', 'Pagas', 'bg-floresta-600 text-white'],
            ] as const
          ).map(([id, rotulo, ativo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`rounded-full px-3 py-1.5 transition ${filtro === id ? ativo : 'bg-tinta-100 text-tinta-600 hover:bg-tinta-200'}`}
            >
              {rotulo} ({grupos[id].length})
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-tinta-500">
          {filtro === 'vencidas' ? 'Nada vencido. 🎉' : filtro === 'pagas' ? 'Nenhuma conta paga ainda.' : 'Nenhuma conta a pagar. Envie um boleto para começar.'}
        </p>
      ) : (
        <ul className="divide-y divide-tinta-100">
          {lista.map((d) => {
            const p = prazo(d.vencimento, dia);
            const expandido = aberto === d.id;
            return (
              <li key={d.id} className={pendente ? 'opacity-70' : ''}>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <button type="button" onClick={() => setAberto(expandido ? null : d.id)} className="min-w-0 flex-1 text-left" aria-expanded={expandido}>
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-tinta-900">{d.fornecedor}</span>
                      {d.confianca === 'baixa' ? <span className="shrink-0 rounded bg-alerta-100 px-1.5 text-[10px] font-bold uppercase text-alerta-700">conferir</span> : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-tinta-500">
                      <span>{d.categoria}</span>
                      <span className="text-tinta-300">·</span>
                      <span>{TIPO[d.tipo]}</span>
                      <span className="text-tinta-300">·</span>
                      <span className="inline-flex items-center gap-1">{ORIGEM[d.origem].icone} {ORIGEM[d.origem].rotulo}</span>
                    </span>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold">{reais(d.valor_centavos)}</p>
                    {d.status === 'pago' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-floresta-50 px-2 py-0.5 text-[11px] font-semibold text-floresta-700">
                        <IconeCheck size={12} /> paga {d.pago_em ? dataCurta(d.pago_em.slice(0, 10)) : ''}
                      </span>
                    ) : (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TOM[p.tom]}`}>{p.texto}</span>
                    )}
                  </div>
                  {d.status === 'a_pagar' ? (
                    <button
                      type="button"
                      onClick={() => mudar(d.id, 'pago')}
                      title="Clique quando esta conta já estiver paga: os avisos dela param."
                      className="hidden shrink-0 items-center rounded-xl border border-dashed border-tinta-300 px-2.5 py-2 text-xs font-semibold text-tinta-700 transition hover:border-solid hover:border-floresta-500 hover:bg-floresta-50 hover:text-floresta-700 sm:inline-flex"
                    >
                      Marcar como paga
                    </button>
                  ) : null}
                </div>

                {expandido ? (
                  <div className="animate-surgir space-y-3 bg-tinta-50 px-5 py-4 text-sm">
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-tinta-500">Vencimento</dt>
                        <dd className="font-medium">{dataBr(d.vencimento)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-tinta-500">Descrição</dt>
                        <dd className="font-medium">{d.descricao || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-tinta-500">Arquivo</dt>
                        <dd className="truncate font-medium">{d.arquivo_nome ?? '—'}</dd>
                      </div>
                    </dl>
                    {d.linha_digitavel ? (
                      <div>
                        <p className="text-xs text-tinta-500">Linha digitável</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <code className="break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs text-tinta-800 shadow-suave">{formatarLinha(d.linha_digitavel)}</code>
                          <button type="button" onClick={() => copiar(d)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-floresta-700 hover:bg-floresta-50">
                            {copiado === d.id ? <IconeCheck size={14} /> : <IconeCopiar size={14} />} {copiado === d.id ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    ) : d.chave_nfe ? (
                      <p className="text-xs text-tinta-500">
                        Chave da NF-e: <code className="break-all font-mono text-tinta-800">{d.chave_nfe}</code>
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      {d.status === 'a_pagar' ? (
                        <button type="button" onClick={() => mudar(d.id, 'pago')} className="rounded-xl bg-floresta-800 px-3 py-2 text-xs font-semibold text-white sm:hidden">
                          Marcar como paga
                        </button>
                      ) : (
                        <button type="button" onClick={() => mudar(d.id, 'a_pagar')} className="rounded-xl border border-tinta-200 bg-white px-3 py-2 text-xs font-semibold text-tinta-700">
                          Reabrir conta
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const STATUS_EXEC: Record<Execucao['status'], { rotulo: string; cor: string }> = {
  sucesso: { rotulo: 'Sucesso', cor: 'bg-floresta-500' },
  duplicado: { rotulo: 'Duplicado', cor: 'bg-tinta-400' },
  revisao: { rotulo: 'Revisão', cor: 'bg-alerta-500' },
  erro: { rotulo: 'Erro', cor: 'bg-perigo-500' },
  ignorado: { rotulo: 'Ignorado', cor: 'bg-tinta-300' },
};

const GATILHO: Record<Execucao['gatilho'], { rotulo: string; icone: React.ReactNode }> = {
  gmail: { rotulo: 'Gmail', icone: <IconeEmail size={14} /> },
  telegram: { rotulo: 'Telegram', icone: <IconeTelegram size={14} /> },
  upload: { rotulo: 'Upload no painel', icone: <IconeUpload size={14} /> },
  exemplo: { rotulo: 'Exemplo', icone: <IconeDocumento size={14} /> },
  texto: { rotulo: 'Código colado', icone: <IconeDocumento size={14} /> },
  agendador: { rotulo: 'Avisos', icone: <IconeRelogio size={14} /> },
};

export function ListaExecucoes({ execucoes }: { execucoes: Execucao[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <section className="min-w-0 rounded-3xl border border-tinta-200 bg-white shadow-suave">
      <div className="flex items-center gap-2 border-b border-tinta-100 px-5 py-4">
        <IconeFluxo size={18} className="text-floresta-600" />
        <h2 className="text-lg font-semibold">Execuções da automação</h2>
      </div>
      {execucoes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-tinta-500">Nenhuma execução ainda.</p>
      ) : (
        <ul className="divide-y divide-tinta-100">
          {execucoes.slice(0, 15).map((e) => {
            const aberto = aberta === e.id;
            const hora = new Date(e.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setAberta(aberto ? null : e.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-tinta-50" aria-expanded={aberto}>
                  <span className={`size-2.5 shrink-0 rounded-full ${STATUS_EXEC[e.status].cor}`} title={STATUS_EXEC[e.status].rotulo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.resumo || STATUS_EXEC[e.status].rotulo}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-tinta-500">
                      {GATILHO[e.gatilho].icone} {GATILHO[e.gatilho].rotulo} · {hora} · {e.duracao_ms} ms
                    </span>
                  </span>
                  <IconeChevron size={15} className={`shrink-0 text-tinta-400 transition ${aberto ? 'rotate-90' : ''}`} />
                </button>
                {aberto ? (
                  <ol className="animate-surgir space-y-1.5 bg-floresta-950 px-5 py-4 text-xs text-tinta-200">
                    {e.passos.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={p.status === 'ok' ? 'text-limao-400' : p.status === 'erro' ? 'text-perigo-500' : p.status === 'aviso' ? 'text-alerta-500' : 'text-tinta-500'}>●</span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-white">{p.nome}</span> <span className="font-mono text-tinta-400">{p.ms} ms</span>
                          <span className="block break-words text-tinta-300">{p.detalhe}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
