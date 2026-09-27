'use client';

/**
 * Ensaio interativo das telas de autorização do Google. Script do Gmail sem a
 * verificação (paga) do Google sempre mostra o aviso de "app não verificado";
 * aqui a pessoa passa pelas telas antes, clicando no lugar certo de cada uma.
 * São ilustrações simplificadas e marcadas como simulação, nunca uma cópia da
 * interface do Google.
 */
import { useState } from 'react';
import { IconeCheck, IconeSeta, IconeVoltar } from './icones';

type Etapa = {
  janela: string;
  explicacao: React.ReactNode;
  /** Texto do botão certo; clicar nele avança. */
  alvo: string;
  tela: (alvo: React.ReactNode, errado: (dica: string) => void) => React.ReactNode;
};

function Alvo({ children, onClick, estilo }: { children: React.ReactNode; onClick: () => void; estilo: string }) {
  return (
    <button type="button" onClick={onClick} className={`relative rounded-md ring-2 ring-limao-500 ring-offset-2 transition hover:ring-4 ${estilo}`}>
      <span className="pointer-events-none absolute -inset-1.5 animate-ping rounded-lg ring-2 ring-limao-400/70" />
      {children}
    </button>
  );
}

const ETAPAS: Etapa[] = [
  {
    janela: 'script.google.com · Editor',
    alvo: 'Executar',
    explicacao: (
      <>
        Com o código colado e salvo, confira se a função <b>instalar</b> está escolhida no menu de cima e clique em <b>Executar</b>.
      </>
    ),
    tela: (alvo) => (
      <div>
        <div className="flex flex-wrap items-center gap-2 border-b border-tinta-100 pb-3 text-xs">
          <span className="rounded border border-tinta-200 px-2 py-1 text-tinta-500">↶ ↷</span>
          <span className="rounded border border-tinta-200 px-2 py-1 text-tinta-500">💾</span>
          {alvo}
          <span className="rounded border border-tinta-200 px-2 py-1 text-tinta-500">Depurar</span>
          <span className="rounded border border-floresta-500 bg-floresta-50 px-2 py-1 font-semibold text-floresta-800">instalar ▾</span>
        </div>
        <pre className="mt-3 overflow-hidden font-mono text-[11px] leading-relaxed text-tinta-500">
          {`const ZYRO_URL = 'https://quita-contas…';\nconst ZYRO_CHAVE = '••••••••';\n\nfunction instalar() {\n  …`}
        </pre>
      </div>
    ),
  },
  {
    janela: 'Autorização necessária',
    alvo: 'Revisar permissões',
    explicacao: (
      <>
        O Google avisa que o script precisa de permissão. Clique em <b>Revisar permissões</b> e, na janela que abre, escolha a sua conta do Gmail.
      </>
    ),
    tela: (alvo, errado) => (
      <div>
        <p className="font-semibold text-tinta-900">Autorização necessária</p>
        <p className="mt-2">Este app pode não funcionar como esperado sem todas as permissões solicitadas.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => errado('“Cancelar” interrompe a instalação. Clique em “Revisar permissões”.')} className="px-2 py-1 text-xs font-semibold text-tinta-500">
            Cancelar
          </button>
          {alvo}
        </div>
      </div>
    ),
  },
  {
    janela: 'O Google não verificou este app',
    alvo: 'Avançado',
    explicacao: (
      <>
        <b>Esta é a tela que assusta, e ela é esperada.</b> O “desenvolvedor” citado é <b>o seu próprio e-mail</b>: o script foi criado por você, na
        sua conta. O Google mostra o aviso porque esse script não passou pela verificação paga dele. Clique em <b>Avançado</b>, pequeno, no canto de
        baixo.
      </>
    ),
    tela: (alvo, errado) => (
      <div>
        <p className="text-base font-semibold text-tinta-900">O Google não verificou este app</p>
        <p className="mt-2 text-xs">
          O app está solicitando acesso a informações confidenciais na sua Conta do Google. Não é recomendado usá-lo até que o desenvolvedor (
          <b>você@gmail.com</b>) faça a verificação com o Google.
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          {alvo}
          <button
            type="button"
            onClick={() => errado('“Voltar à segurança” cancela a instalação. O caminho é “Avançado”, no canto esquerdo.')}
            className="rounded-lg bg-info-700 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Voltar à segurança
          </button>
        </div>
      </div>
    ),
  },
  {
    janela: 'O Google não verificou este app · Avançado',
    alvo: 'Acessar ZYRO (não seguro)',
    explicacao: (
      <>
        Abre um texto a mais embaixo. Clique no link <b>Acessar ZYRO (não seguro)</b>. Se você não renomeou o projeto, ele aparece como “Acessar
        Projeto sem título”: é o mesmo link.
      </>
    ),
    tela: (alvo) => (
      <div>
        <p className="text-base font-semibold text-tinta-900">O Google não verificou este app</p>
        <p className="mt-2 text-xs text-tinta-500">…até que o desenvolvedor (você@gmail.com) faça a verificação com o Google.</p>
        <div className="mt-3 rounded-lg bg-tinta-50 p-3 text-xs">
          <p>Continue somente se você conhece e confia no desenvolvedor (você@gmail.com).</p>
          <p className="mt-3">{alvo}</p>
        </div>
      </div>
    ),
  },
  {
    janela: 'ZYRO quer acessar sua Conta do Google',
    alvo: 'Permitir',
    explicacao: (
      <>
        A lista de permissões. O Google descreve o acesso completo ao Gmail, mas o script só <b>lê</b>, marca as conversas com o rótulo ZYRO e{' '}
        <b>envia o aviso para você</b>. Ele nunca apaga nada, e o código está nesta página para conferir. Role até o fim e clique em{' '}
        <b>Permitir</b>.
      </>
    ),
    tela: (alvo, errado) => (
      <div>
        <p className="text-base font-semibold text-tinta-900">ZYRO quer acessar sua Conta do Google</p>
        <ul className="mt-3 space-y-1.5 text-xs">
          <li>✉️ Ler, escrever, enviar e excluir permanentemente todos os seus e-mails do Gmail</li>
          <li>🔗 Conectar a um serviço externo</li>
          <li>⏱️ Permitir que este aplicativo seja executado quando você não estiver presente</li>
        </ul>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => errado('“Cancelar” desfaz tudo. Clique em “Permitir”.')} className="px-2 py-1 text-xs font-semibold text-tinta-500">
            Cancelar
          </button>
          {alvo}
        </div>
      </div>
    ),
  },
];

export function GuiaAutorizacao() {
  const [etapa, setEtapa] = useState(0);
  const [dica, setDica] = useState<string | null>(null);
  const fim = etapa >= ETAPAS.length;
  const atual = ETAPAS[Math.min(etapa, ETAPAS.length - 1)];

  const ir = (n: number) => {
    setDica(null);
    setEtapa(Math.max(0, Math.min(ETAPAS.length, n)));
  };

  const alvo = (
    <Alvo
      onClick={() => ir(etapa + 1)}
      estilo={
        atual.alvo === 'Permitir' || atual.alvo === 'Executar'
          ? 'bg-info-700 px-3 py-1.5 text-xs font-semibold text-white'
          : atual.alvo === 'Revisar permissões'
            ? 'px-2 py-1 text-xs font-semibold text-info-700'
            : 'px-1 py-0.5 text-xs font-semibold text-info-700 underline'
      }
    >
      {atual.alvo === 'Executar' ? '▶ Executar' : atual.alvo}
    </Alvo>
  );

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-tinta-200 bg-white shadow-suave" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tinta-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Ensaie a autorização antes</h2>
          <p className="text-xs text-tinta-500">Uma simulação das telas do Google, para você saber onde clicar. Leva 1 minuto.</p>
        </div>
        <div className="flex gap-1.5" aria-label={`Etapa ${Math.min(etapa + 1, ETAPAS.length + 1)} de ${ETAPAS.length + 1}`}>
          {[...ETAPAS, null].map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i < etapa ? 'bg-floresta-600' : i === etapa ? 'bg-limao-500' : 'bg-tinta-200'}`} />
          ))}
        </div>
      </div>

      {fim ? (
        <div className="p-6 text-center sm:p-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-floresta-800 text-limao-400">
            <IconeCheck size={24} />
          </span>
          <p className="mt-4 text-xl font-bold">Pronto, é só isso.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-tinta-600">
            Depois do “Permitir”, o editor mostra “Execução concluída” e esta página muda para <b>Gmail conectado</b>. Agora copie o código logo abaixo e
            faça de verdade: as telas vão ser essas, na mesma ordem.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="https://script.google.com/home/projects/create"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-floresta-900 px-5 py-3 font-semibold text-white hover:bg-floresta-800"
            >
              Abrir o script.google.com <IconeSeta size={18} />
            </a>
            <button type="button" onClick={() => ir(0)} className="rounded-2xl border border-tinta-200 px-5 py-3 font-semibold text-tinta-700 hover:border-floresta-500">
              Ver de novo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <p className="font-mono text-xs text-tinta-400">
              Tela {etapa + 1} de {ETAPAS.length}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tinta-700">{atual.explicacao}</p>
            {dica ? <p className="mt-3 rounded-xl bg-alerta-100 px-3 py-2 text-sm font-medium text-alerta-700">{dica}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={etapa === 0}
                onClick={() => ir(etapa - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-tinta-200 px-3 py-2 text-sm font-semibold text-tinta-600 disabled:opacity-40"
              >
                <IconeVoltar size={16} /> Anterior
              </button>
              <button type="button" onClick={() => ir(etapa + 1)} className="inline-flex items-center gap-1 rounded-xl bg-floresta-900 px-4 py-2 text-sm font-semibold text-white hover:bg-floresta-800">
                Próxima <IconeSeta size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-tinta-200 bg-white shadow-alta">
            <div className="flex items-center gap-1.5 border-b border-tinta-100 bg-tinta-50 px-3 py-2">
              <i className="size-2 rounded-full bg-tinta-200" />
              <i className="size-2 rounded-full bg-tinta-200" />
              <i className="size-2 rounded-full bg-tinta-200" />
              <span className="ml-2 min-w-0 flex-1 truncate text-[11px] text-tinta-500">{atual.janela}</span>
              <span className="rounded bg-alerta-100 px-1.5 text-[10px] font-bold uppercase text-alerta-700">simulação</span>
            </div>
            <div key={etapa} className="animate-surgir p-5 text-[13px] leading-relaxed text-tinta-700">
              {atual.tela(alvo, setDica)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
