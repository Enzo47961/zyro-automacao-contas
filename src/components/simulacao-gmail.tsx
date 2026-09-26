'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Passo } from '@/lib/banco';
import { agendaDeAvisos, ROTULO_AVISO, tituloAviso, type AvisoAgendado } from '@/lib/avisos';
import { dataBr, dataCurta, reais, somarDias } from '@/lib/formato';
import {
  IconeAlerta,
  IconeCelular,
  IconeCheck,
  IconeComputador,
  IconeDocumento,
  IconeEmail,
  IconeRaio,
  IconeSeta,
  IconeSino,
  IconeX,
} from './icones';

type Cenario = 'energia' | 'moinho' | 'nfe' | 'internet' | 'energia-lembrete' | 'moinho-reenvio' | 'newsletter';

const CENARIOS: Array<{ id: Cenario; rotulo: string; detalhe: string; repetido?: boolean }> = [
  { id: 'energia', rotulo: 'Conta de luz', detalhe: 'PDF anexo' },
  { id: 'moinho', rotulo: 'Boleto do fornecedor', detalhe: 'PDF anexo' },
  { id: 'nfe', rotulo: 'Nota fiscal em 2 parcelas', detalhe: 'XML anexo' },
  { id: 'internet', rotulo: 'Boleto da internet', detalhe: 'PDF anexo' },
  { id: 'energia-lembrete', rotulo: 'Lembrete da mesma conta de luz', detalhe: 'código no texto', repetido: true },
  { id: 'moinho-reenvio', rotulo: 'Mesmo boleto reenviado', detalhe: 'PDF igual', repetido: true },
  { id: 'newsletter', rotulo: 'Propaganda', detalhe: 'sem conta' },
];

const ROTEIRO: Cenario[] = ['energia', 'moinho', 'newsletter', 'moinho-reenvio', 'nfe', 'energia-lembrete'];

type Sessao = { token: string; antecedencia: number; semente: number };
type Execucao = { status: string; resumo: string; passos: Passo[]; duracao_ms: number };
type DocResposta = { id: string; fornecedor: string; valor_centavos: number; vencimento: string | null; categoria: string; descricao: string; duplicado: boolean };

type Email = {
  uid: number;
  tipo: 'entrada' | 'aviso';
  de: string;
  assunto: string;
  anexos: string[];
  dia: string;
  estado: 'lendo' | 'conta' | 'duplicado' | 'sem_conta' | 'erro' | 'aviso';
  documentos: DocResposta[];
  execucoes: Execucao[];
  erro?: string;
};

type Conta = {
  id: string;
  fornecedor: string;
  valor_centavos: number;
  vencimento: string | null;
  categoria: string;
  descricao: string;
  chegada: string;
  avisos: AvisoAgendado[];
  paga: boolean;
  repeticoes: number;
};

type Notificacao = { uid: number; titulo: string; texto: string };

const chaveAviso = (conta: string, tipo: string) => `${conta}:${tipo}`;
const remetente = (de: string) => de.replace(/<[^>]*>/, '').trim();
const inicial = (de: string) => remetente(de).slice(0, 1).toUpperCase();

const ESTADO: Record<Email['estado'], { rotulo: string; classe: string }> = {
  lendo: { rotulo: 'lendo…', classe: 'bg-tinta-100 text-tinta-600' },
  conta: { rotulo: 'aviso agendado', classe: 'bg-floresta-50 text-floresta-700' },
  duplicado: { rotulo: 'repetida · ignorada', classe: 'bg-alerta-100 text-alerta-700' },
  sem_conta: { rotulo: 'não é conta', classe: 'bg-tinta-100 text-tinta-500' },
  erro: { rotulo: 'erro', classe: 'bg-perigo-100 text-perigo-700' },
  aviso: { rotulo: 'aviso do ZYRO', classe: 'bg-limao-300 text-floresta-950' },
};

export function SimulacaoGmail({ hojeInicial }: { hojeInicial: string }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [dia, setDia] = useState(hojeInicial);
  const [emails, setEmails] = useState<Email[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [toast, setToast] = useState<Notificacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [roteiro, setRoteiro] = useState(false);
  const [passosVisiveis, setPassosVisiveis] = useState(0);
  const uid = useRef(0);
  const contasRef = useRef<Conta[]>([]);
  contasRef.current = contas;

  // Uma carteira de simulação por aba: recarregar a página começa do zero.
  useEffect(() => {
    let ativo = true;
    fetch('/api/simulacao', { method: 'POST' })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo.erro ?? 'Simulação indisponível.');
        if (ativo) setSessao(corpo);
      })
      .catch((e: Error) => ativo && setFalha(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  const email = emails.find((e) => e.uid === selecionado) ?? null;
  const passos = email?.execucoes.flatMap((e) => e.passos) ?? [];

  useEffect(() => {
    setPassosVisiveis(0);
    if (!passos.length) return;
    const t = setInterval(() => setPassosVisiveis((v) => (v >= passos.length ? (clearInterval(t), v) : v + 1)), 140);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, passos.length]);

  const receber = useCallback(
    async (cenario: Cenario) => {
      if (!sessao) return;
      setOcupado(true);
      const id = ++uid.current;
      const info = CENARIOS.find((c) => c.id === cenario)!;
      setEmails((lista) => [{ uid: id, tipo: 'entrada', de: '…', assunto: info.rotulo, anexos: [], dia, estado: 'lendo', documentos: [], execucoes: [] }, ...lista]);
      setSelecionado(id);
      try {
        const res = await fetch('/api/simulacao/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: sessao.token, cenario, semente: sessao.semente }),
        });
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo.erro ?? 'Falha ao ler o e-mail.');
        const docs = corpo.documentos as DocResposta[];
        setEmails((lista) =>
          lista.map((e) =>
            e.uid === id
              ? { ...e, de: corpo.email.de, assunto: corpo.email.assunto, anexos: corpo.email.anexos, estado: corpo.resultado, documentos: docs, execucoes: corpo.execucoes }
              : e,
          ),
        );
        setContas((lista) => {
          let nova = [...lista];
          for (const d of docs) {
            const existente = nova.find((c) => c.id === d.id);
            if (existente) nova = nova.map((c) => (c.id === d.id ? { ...c, repeticoes: c.repeticoes + 1 } : c));
            else if (!d.duplicado)
              nova.push({ ...d, chegada: dia, avisos: agendaDeAvisos(d.vencimento, sessao.antecedencia, dia), paga: false, repeticoes: 0 });
          }
          return nova.sort((a, b) => (a.vencimento ?? '9').localeCompare(b.vencimento ?? '9'));
        });
      } catch (erro) {
        setEmails((lista) => lista.map((e) => (e.uid === id ? { ...e, estado: 'erro', erro: erro instanceof Error ? erro.message : 'Falha.' } : e)));
      } finally {
        setOcupado(false);
      }
    },
    [sessao, dia],
  );

  // Aviso de antecedência que cai no mesmo dia da chegada sai na hora (como no script real).
  useEffect(() => {
    dispararAvisos(dia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas.length]);

  function dispararAvisos(ateDia: string) {
    const novos: Array<{ conta: Conta; aviso: AvisoAgendado }> = [];
    for (const conta of contasRef.current) {
      if (conta.paga) continue;
      for (const aviso of conta.avisos) {
        if (aviso.dia === ateDia && !enviados.has(chaveAviso(conta.id, aviso.tipo))) novos.push({ conta, aviso });
      }
    }
    if (!novos.length) return;
    setEnviados((s) => new Set([...s, ...novos.map((n) => chaveAviso(n.conta.id, n.aviso.tipo))]));
    const lote = novos.map(({ conta, aviso }) => {
      const titulo = tituloAviso(aviso.tipo, conta.vencimento!, ateDia);
      return {
        email: {
          uid: ++uid.current,
          tipo: 'aviso' as const,
          de: 'ZYRO <você mesmo>',
          assunto: `Aviso ZYRO · ${titulo}: ${conta.fornecedor} · ${reais(conta.valor_centavos)}`,
          anexos: [],
          dia: ateDia,
          estado: 'aviso' as const,
          documentos: [],
          execucoes: [],
        },
        notificacao: { uid: uid.current, titulo: `${titulo} · ${reais(conta.valor_centavos)}`, texto: conta.fornecedor },
      };
    });
    setEmails((lista) => [...lote.map((l) => l.email).reverse(), ...lista]);
    setNotificacoes((lista) => [...lote.map((l) => l.notificacao).reverse(), ...lista].slice(0, 6));
    setToast(lote[lote.length - 1].notificacao);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const proximoAviso = contas
    .filter((c) => !c.paga)
    .flatMap((c) => c.avisos.filter((a) => a.dia > dia && !enviados.has(chaveAviso(c.id, a.tipo))))
    .map((a) => a.dia)
    .sort()[0];

  const avancar = (ate: string) => {
    let d = dia;
    while (d < ate) {
      d = somarDias(d, 1);
      dispararAvisos(d);
    }
    setDia(ate);
  };

  const pagar = async (conta: Conta) => {
    setContas((lista) => lista.map((c) => (c.id === conta.id ? { ...c, paga: true } : c)));
    if (sessao) {
      await fetch(`/api/contas/${conta.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ carteira: sessao.token, status: 'pago' }),
      }).catch(() => null);
    }
  };

  // Demonstração automática: um e-mail a cada poucos segundos.
  useEffect(() => {
    if (!roteiro || ocupado) return;
    const recebidos = emails.filter((e) => e.tipo === 'entrada').length;
    if (recebidos >= ROTEIRO.length) {
      setRoteiro(false);
      return;
    }
    const t = setTimeout(() => void receber(ROTEIRO[recebidos]), recebidos === 0 ? 200 : 2600);
    return () => clearTimeout(t);
  }, [roteiro, ocupado, emails, receber]);

  const entradas = emails.filter((e) => e.tipo === 'entrada' && e.estado !== 'lendo');
  const contadores = [
    { rotulo: 'e-mails lidos', valor: entradas.length },
    { rotulo: 'contas agendadas', valor: contas.length },
    { rotulo: 'repetidas barradas', valor: entradas.filter((e) => e.estado === 'duplicado').length },
    { rotulo: 'avisos enviados', valor: enviados.size },
  ];

  if (falha) {
    return <p className="mx-auto max-w-xl rounded-2xl bg-perigo-100 px-5 py-4 text-sm text-perigo-700">{falha}</p>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Notificação de desktop */}
      {toast ? (
        <div role="status" className="fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] animate-surgir rounded-2xl border border-tinta-200 bg-white p-3.5 shadow-alta">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-floresta-900 text-limao-400">
              <IconeRaio size={18} />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-[11px] text-tinta-500">Gmail · agora</p>
              <p className="font-semibold text-tinta-900">{toast.titulo}</p>
              <p className="truncate text-tinta-600">{toast.texto}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {contadores.map((c) => (
          <div key={c.rotulo} className="rounded-2xl border border-tinta-200 bg-white px-4 py-3 shadow-suave">
            <p className="font-display text-3xl font-bold text-floresta-800">{c.valor}</p>
            <p className="text-xs text-tinta-500">{c.rotulo}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Coluna 1: caixa de entrada + robô */}
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-3xl border border-tinta-200 bg-white shadow-suave">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tinta-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <IconeEmail size={20} className="text-perigo-500" />
                <h2 className="text-lg font-semibold">Caixa de entrada</h2>
                <span className="text-xs text-tinta-400">simulada</span>
              </div>
              <button
                type="button"
                disabled={!sessao || roteiro}
                onClick={() => setRoteiro(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-floresta-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-floresta-800 disabled:opacity-50"
              >
                <IconeRaio size={15} className="text-limao-400" /> {roteiro ? 'Chegando e-mails…' : 'Rodar demonstração'}
              </button>
            </div>

            <div className="border-b border-tinta-100 bg-tinta-50 px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-500">Fazer chegar um e-mail</p>
              <div className="flex flex-wrap gap-2">
                {CENARIOS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!sessao || ocupado || roteiro}
                    onClick={() => void receber(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      c.repetido ? 'border-alerta-500/40 bg-alerta-100 text-alerta-700 hover:border-alerta-500' : 'border-tinta-200 bg-white text-tinta-700 hover:border-floresta-500'
                    }`}
                  >
                    {c.rotulo} <span className="font-normal opacity-70">· {c.detalhe}</span>
                  </button>
                ))}
              </div>
            </div>

            {emails.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <IconeEmail size={30} className="mx-auto text-tinta-300" />
                <p className="mt-3 font-semibold text-tinta-800">{sessao ? 'Nenhum e-mail ainda' : 'Preparando a simulação…'}</p>
                <p className="mt-1 text-sm text-tinta-500">Clique em “Rodar demonstração” ou escolha um e-mail acima.</p>
              </div>
            ) : (
              <ul className="rolagem-fina max-h-[420px] divide-y divide-tinta-100 overflow-y-auto">
                {emails.map((e) => {
                  const est = ESTADO[e.estado];
                  const ativo = e.uid === selecionado;
                  return (
                    <li key={e.uid}>
                      <button
                        type="button"
                        onClick={() => e.tipo === 'entrada' && setSelecionado(e.uid)}
                        className={`flex w-full animate-surgir items-center gap-3 px-5 py-3 text-left transition ${ativo ? 'bg-floresta-50' : e.tipo === 'aviso' ? 'bg-limao-200/40' : 'hover:bg-tinta-50'}`}
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            e.tipo === 'aviso' ? 'bg-floresta-900 text-limao-400' : 'bg-tinta-200 text-tinta-700'
                          }`}
                        >
                          {e.tipo === 'aviso' ? <IconeRaio size={16} /> : inicial(e.de)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-tinta-900">{e.de === '…' ? 'Chegando…' : remetente(e.de)}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-tinta-400">{dataCurta(e.dia)}</span>
                          </span>
                          <span className="block truncate text-sm text-tinta-600">{e.assunto}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {e.anexos.map((a) => (
                              <span key={a} className="inline-flex items-center gap-1 rounded-md border border-tinta-200 px-1.5 py-0.5 text-[11px] text-tinta-600">
                                <IconeDocumento size={11} /> {a}
                              </span>
                            ))}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${est.classe}`}>{est.rotulo}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Robô */}
          <section className="rounded-3xl bg-floresta-950 p-5 text-white" aria-live="polite">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-limao-400">O que o robô fez com este e-mail</span>
              {email?.execucoes.length ? <span className="font-mono text-tinta-300">{email.execucoes.reduce((t, x) => t + x.duracao_ms, 0)} ms</span> : null}
            </div>
            {!email ? (
              <p className="mt-4 text-sm text-tinta-300">Quando um e-mail chegar, você vê aqui cada passo: leitura do anexo, conferência do código, bloqueio de repetição e agendamento.</p>
            ) : email.estado === 'lendo' ? (
              <p className="mt-4 text-sm text-tinta-300">Lendo o e-mail e os anexos…</p>
            ) : email.estado === 'sem_conta' ? (
              <div className="mt-4 flex gap-3 text-sm">
                <IconeX size={18} className="mt-0.5 shrink-0 text-tinta-400" />
                <p className="text-tinta-200">
                  <b className="text-white">Não é uma conta.</b> O e-mail não tem boleto, conta de consumo nem nota fiscal. Nada foi salvo e ele não aparece no histórico.
                </p>
              </div>
            ) : email.estado === 'erro' ? (
              <p className="mt-4 text-sm text-perigo-100">{email.erro}</p>
            ) : (
              <>
                <ol className="mt-4 space-y-2">
                  {passos.map((p, i) => {
                    const mostrar = i < passosVisiveis;
                    return (
                      <li key={i} className={`flex gap-3 transition-opacity ${mostrar ? 'opacity-100' : 'opacity-30'}`}>
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                            !mostrar ? 'bg-white/10' : p.status === 'ok' ? 'bg-floresta-500' : p.status === 'aviso' ? 'bg-alerta-500' : p.status === 'erro' ? 'bg-perigo-500' : 'bg-tinta-600'
                          }`}
                        >
                          {mostrar ? p.status === 'ok' ? <IconeCheck size={12} /> : p.status === 'aviso' ? <IconeAlerta size={11} /> : <span className="text-[10px]">–</span> : null}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{p.nome}</span>
                          {mostrar && p.detalhe ? <span className="block break-words text-xs text-tinta-300">{p.detalhe}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {passosVisiveis >= passos.length ? (
                  <div
                    className={`mt-4 animate-surgir rounded-xl p-4 text-sm leading-relaxed ${
                      email.estado === 'duplicado' ? 'bg-alerta-100 text-alerta-700' : 'bg-limao-400 text-floresta-950'
                    }`}
                  >
                    {email.estado === 'duplicado' ? (
                      <>
                        <b>Essa conta já estava agendada.</b> Chegou de novo em outro e-mail, mas é o mesmo código de pagamento. O ZYRO não cria outra conta e não manda aviso em dobro.
                      </>
                    ) : (
                      <>
                        <b>{email.documentos.length === 1 ? 'Conta agendada' : `${email.documentos.length} contas agendadas`}:</b>{' '}
                        {email.documentos.map((d) => `${d.fornecedor}, ${reais(d.valor_centavos)}, vence ${dataBr(d.vencimento)}`).join(' · ')}. Os avisos estão na agenda ao lado.
                      </>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>

        {/* Coluna 2: relógio, agenda e onde chega */}
        <div className="min-w-0 space-y-5">
          <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
            <p className="text-xs font-semibold uppercase tracking-wider text-tinta-500">Relógio da simulação</p>
            <p className="mt-1 font-display text-2xl font-bold capitalize">
              {new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })}
            </p>
            <p className="text-xs text-tinta-500">{dia === hojeInicial ? 'hoje' : `${Math.round((Date.parse(dia) - Date.parse(hojeInicial)) / 86_400_000)} dia(s) no futuro`} · os avisos saem às 8h</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!proximoAviso}
                onClick={() => proximoAviso && avancar(proximoAviso)}
                className="inline-flex items-center gap-2 rounded-xl bg-limao-400 px-4 py-2.5 text-sm font-semibold text-floresta-950 transition hover:bg-limao-300 disabled:opacity-40"
              >
                <IconeSino size={16} /> Pular para o próximo aviso
              </button>
              <button
                type="button"
                onClick={() => avancar(somarDias(dia, 1))}
                className="rounded-xl border border-tinta-200 px-4 py-2.5 text-sm font-semibold text-tinta-700 transition hover:border-floresta-500"
              >
                +1 dia
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-tinta-200 bg-white shadow-suave">
            <div className="border-b border-tinta-100 px-5 py-4">
              <h2 className="text-lg font-semibold">Avisos agendados</h2>
              <p className="text-xs text-tinta-500">{sessao ? `${sessao.antecedencia} dias antes, no dia e no dia seguinte. Cada aviso sai uma vez só.` : ''}</p>
            </div>
            {contas.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-tinta-500">Nenhuma conta ainda. Os avisos aparecem aqui assim que uma conta chegar.</p>
            ) : (
              <ul className="divide-y divide-tinta-100">
                {contas.map((c) => (
                  <li key={c.id} className={`px-5 py-3.5 ${c.paga ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.fornecedor}</p>
                        <p className="text-xs text-tinta-500">
                          {reais(c.valor_centavos)} · vence {dataCurta(c.vencimento ?? dia)}
                          {c.repeticoes ? <span className="ml-1.5 rounded bg-alerta-100 px-1.5 text-[10px] font-bold text-alerta-700">chegou {c.repeticoes + 1}x · 1 conta</span> : null}
                        </p>
                      </div>
                      {c.paga ? (
                        <span className="shrink-0 rounded-full bg-floresta-50 px-2 py-0.5 text-[11px] font-semibold text-floresta-700">paga</span>
                      ) : (
                        <button type="button" onClick={() => void pagar(c)} className="shrink-0 rounded-lg border border-tinta-200 px-2 py-1 text-[11px] font-semibold text-tinta-600 hover:border-floresta-500">
                          Paguei
                        </button>
                      )}
                    </div>
                    <ol className="mt-2.5 grid grid-cols-3 gap-1.5">
                      {c.avisos.map((a) => {
                        const foi = enviados.has(chaveAviso(c.id, a.tipo));
                        const cancelado = c.paga && !foi;
                        return (
                          <li
                            key={a.tipo}
                            className={`rounded-lg px-2 py-1.5 text-[11px] leading-tight ${
                              foi ? 'bg-floresta-800 text-white' : cancelado ? 'bg-tinta-100 text-tinta-400 line-through' : 'bg-tinta-50 text-tinta-600 ring-1 ring-tinta-200'
                            }`}
                          >
                            <span className="block font-semibold">{dataCurta(a.dia)}</span>
                            <span className="block">{ROTULO_AVISO[a.tipo]}</span>
                            <span className="block opacity-80">{foi ? '✓ enviado' : cancelado ? 'cancelado' : 'agendado'}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Onde o aviso chega */}
          <section className="rounded-3xl border border-tinta-200 bg-white p-5 shadow-suave">
            <h2 className="text-lg font-semibold">Onde o aviso aparece</h2>
            <p className="text-xs text-tinta-500">O aviso é um e-mail do seu próprio Gmail para você: o app notifica no celular e no computador.</p>
            <div className="mt-4 grid grid-cols-[120px_1fr] items-start gap-4">
              <div className="rounded-[1.6rem] border-4 border-tinta-900 bg-gradient-to-b from-floresta-800 to-floresta-950 p-2 pb-4 text-white">
                <p className="text-center font-display text-xl font-bold">08:00</p>
                <p className="mb-2 text-center text-[9px] text-tinta-300">{dataCurta(dia)}</p>
                <div className="space-y-1.5">
                  {notificacoes.slice(0, 3).map((n) => (
                    <div key={n.uid} className="animate-surgir rounded-lg bg-white/90 p-1.5 text-[9px] leading-tight text-tinta-900">
                      <p className="font-semibold">{n.titulo}</p>
                      <p className="truncate text-tinta-600">{n.texto}</p>
                    </div>
                  ))}
                  {notificacoes.length === 0 ? <p className="py-6 text-center text-[9px] text-tinta-400">sem avisos</p> : null}
                </div>
              </div>
              <div className="space-y-2 text-sm text-tinta-600">
                <p className="flex items-center gap-2">
                  <IconeCelular size={16} className="text-floresta-600" /> Notificação do app do Gmail
                </p>
                <p className="flex items-center gap-2">
                  <IconeComputador size={16} className="text-floresta-600" /> Alerta no navegador do computador
                </p>
                <p className="flex items-center gap-2">
                  <IconeEmail size={16} className="text-floresta-600" /> E-mail com valor e linha digitável
                </p>
                <p className="pt-1 text-xs text-tinta-500">Na simulação, use “Pular para o próximo aviso” para ver os avisos chegando.</p>
              </div>
            </div>
          </section>

          {sessao ? (
            <Link
              href={`/p/${sessao.token}`}
              target="_blank"
              className="flex items-center justify-between rounded-3xl bg-floresta-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-floresta-900"
            >
              Ver estas contas no painel completo <IconeSeta size={18} className="text-limao-400" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
