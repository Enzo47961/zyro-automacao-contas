/**
 * Passo a passo ilustrado das telas de autorização do Google. Script do Gmail
 * sem verificação do Google sempre mostra o aviso de "app não verificado";
 * aqui a pessoa vê antes o que vai aparecer e onde clicar.
 * As telas são ilustrações simplificadas, não cópias da interface do Google.
 */

function Alvo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex">
      <span className="rounded-md px-1.5 py-0.5 ring-2 ring-limao-500 ring-offset-2">{children}</span>
      <span className="absolute -right-3 -top-3 flex size-5 items-center justify-center rounded-full bg-floresta-900 text-[10px] font-bold text-limao-400">{n}</span>
    </span>
  );
}

function Tela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-tinta-200 bg-white shadow-suave">
      <div className="flex items-center gap-1.5 border-b border-tinta-100 bg-tinta-50 px-3 py-2">
        <i className="size-2 rounded-full bg-tinta-200" />
        <i className="size-2 rounded-full bg-tinta-200" />
        <i className="size-2 rounded-full bg-tinta-200" />
        <span className="ml-2 truncate text-[11px] text-tinta-500">{titulo}</span>
      </div>
      <div className="flex-1 p-4 text-[13px] leading-relaxed text-tinta-700">{children}</div>
    </div>
  );
}

export function GuiaAutorizacao() {
  return (
    <div className="mt-4 rounded-3xl border border-tinta-200 bg-tinta-50 p-4 sm:p-5">
      <p className="text-sm text-tinta-700">
        O Google mostra um aviso de <b>“app não verificado”</b> para todo script que lê o Gmail e ainda não passou pela verificação paga do Google.
        Repare que o “desenvolvedor” que aparece é <b>o seu próprio e-mail</b>: o script foi criado na sua conta, roda só nela e ninguém mais tem
        acesso a ele. São 4 telas:
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Tela titulo="Autorização necessária">
          <p className="font-semibold text-tinta-900">Este app pode não funcionar como esperado sem todas as permissões solicitadas.</p>
          <p className="mt-4 text-right">
            <Alvo n={1}>
              <span className="font-semibold text-info-700">Revisar permissões</span>
            </Alvo>
          </p>
          <p className="mt-4 text-xs text-tinta-500">Depois disso, escolha a sua conta do Gmail na lista.</p>
        </Tela>

        <Tela titulo="O Google não verificou este app">
          <p className="font-semibold text-tinta-900">O Google não verificou este app</p>
          <p className="mt-1 text-xs text-tinta-500">
            …até que o desenvolvedor (<b>você@gmail.com</b>) faça a verificação com o Google.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Alvo n={2}>
              <span className="text-xs font-semibold text-info-700">Avançado</span>
            </Alvo>
            <span className="rounded-lg bg-info-700 px-3 py-1.5 text-xs font-semibold text-white opacity-60">Voltar à segurança</span>
          </div>
          <p className="mt-3 text-xs text-tinta-500">Não clique em “Voltar à segurança”: isso cancela a instalação.</p>
        </Tela>

        <Tela titulo="O Google não verificou este app · Avançado">
          <p className="text-xs text-tinta-500">Continue somente se você conhece e confia no desenvolvedor.</p>
          <p className="mt-4">
            <Alvo n={3}>
              <span className="text-xs font-semibold text-info-700 underline">Acessar ZYRO (não seguro)</span>
            </Alvo>
          </p>
          <p className="mt-4 text-xs text-tinta-500">Se aparecer “Projeto sem título”, é o mesmo link: é só o nome do projeto (passo 2).</p>
        </Tela>

        <Tela titulo="ZYRO quer acessar sua Conta do Google">
          <ul className="space-y-1 text-xs text-tinta-600">
            <li>• Ler, escrever, enviar e excluir permanentemente todos os seus e-mails do Gmail</li>
            <li>• Conectar a um serviço externo</li>
            <li>• Executar quando você não estiver presente</li>
          </ul>
          <p className="mt-4 text-right">
            <Alvo n={4}>
              <span className="rounded-lg bg-info-700 px-3 py-1.5 text-xs font-semibold text-white">Permitir</span>
            </Alvo>
          </p>
        </Tela>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-tinta-600 sm:grid-cols-3">
        <p>
          <b className="text-tinta-900">Acesso ao Gmail:</b> o Google descreve o acesso completo, mas o script só lê, marca as conversas com o rótulo
          ZYRO e nunca apaga nada. O código está logo abaixo para quem quiser conferir.
        </p>
        <p>
          <b className="text-tinta-900">Enviar e-mails:</b> o aviso de vencimento sai do seu Gmail para você mesmo.
        </p>
        <p>
          <b className="text-tinta-900">Serviço externo:</b> é o ZYRO, que lê valor e vencimento e guarda só esses dados.
        </p>
      </div>
      <p className="mt-3 text-xs text-tinta-500">
        Para desligar a qualquer hora: apague o projeto em script.google.com ou remova o acesso em myaccount.google.com → Segurança → Apps de terceiros.
      </p>
    </div>
  );
}
