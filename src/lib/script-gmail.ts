/**
 * Script do Google (Apps Script) que a pessoa cola em script.google.com.
 * Roda na conta Google dela: nenhum login do Google passa pelo ZYRO, e o aviso
 * sai do próprio Gmail para ela mesma — o app do Gmail notifica no celular e no
 * computador, sem precisar de domínio nem de serviço de e-mail.
 */
export function scriptGmail(url: string, chave: string, painel: string): string {
  return `/**
 * ZYRO no Gmail
 * 1. Cole este código em script.google.com (Novo projeto), no lugar do que já existe.
 * 2. Salve, escolha a função "instalar" no menu de cima e clique em Executar.
 * 3. Autorize o acesso ao Gmail. O Google avisa que o app não foi verificado (o script é seu, roda só na sua
 *    conta): clique em Avançado → Acessar ZYRO → Permitir. Pronto: o ZYRO confere a caixa a cada 10 minutos.
 * Para testar na hora, rode a função "testar": ela manda um boleto de exemplo para você.
 */
const ZYRO_URL = '${url}';
const ZYRO_CHAVE = '${chave}';
const ROTULO = 'ZYRO';
// Só e-mails com cara de conta. Os avisos do próprio ZYRO ficam de fora.
const BUSCA = 'in:inbox newer_than:15d -label:' + ROTULO + ' -subject:"Aviso ZYRO" ' +
  '(filename:pdf OR filename:xml OR boleto OR fatura OR "linha digitável" OR "código de barras" OR "nota fiscal")';

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('verificarContas').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('enviarAvisos').timeBased().everyHours(1).create();
  chamar_('post', '/api/gmail/ping', { email: Session.getEffectiveUser().getEmail() });
  confirmarInstalacao_();
  verificarContas();
  enviarAvisos_(true);
  Logger.log('✅ ZYRO instalado! Volte para a aba do ZYRO (ela mostra "Gmail conectado") ou abra o seu painel: ${painel}');
}

/** E-mail para você mesmo confirmando a instalação: o Gmail notifica no celular e no computador. */
function confirmarInstalacao_() {
  const painel = '${painel}';
  GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Aviso ZYRO · ✅ ZYRO instalado no seu Gmail',
    'O ZYRO está conectado e confere a sua caixa de entrada a cada 10 minutos. Abra o seu painel: ' + painel, {
      name: 'ZYRO',
      htmlBody: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #d0d8d1;border-radius:14px;overflow:hidden">' +
        '<div style="background:#061b11;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">⚡ ZYRO</div>' +
        '<div style="padding:20px;color:#141b16"><p style="margin:0;font-size:20px;font-weight:bold">✅ ZYRO instalado!</p>' +
        '<p style="color:#46554a">Seu Gmail está conectado. A cada 10 minutos o ZYRO confere a caixa de entrada; as contas aparecem no painel e os avisos chegam aqui às 8h.</p>' +
        '<p style="margin:20px 0 0"><a href="' + painel + '" style="background:#c8f04d;color:#061b11;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:bold">Meu painel →</a></p></div></div>',
    });
}

/** Lê os e-mails novos com cara de conta e manda para o ZYRO. Cada conversa é marcada com o rótulo ZYRO. */
function verificarContas() {
  const rotulo = GmailApp.getUserLabelByName(ROTULO) || GmailApp.createLabel(ROTULO);
  const conversas = GmailApp.search(BUSCA, 0, 15);
  conversas.forEach(function (conversa) {
    let ok = true;
    conversa.getMessages().forEach(function (msg) {
      let total = 0;
      const anexos = msg.getAttachments({ includeInlineImages: false })
        .filter(function (a) { return /\\.(pdf|xml)$/i.test(a.getName()); })
        .filter(function (a) { total += a.getSize(); return total < 3000000; })
        .slice(0, 5)
        .map(function (a) { return { nome: a.getName(), mime: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) }; });
      const r = chamar_('post', '/api/gmail/receber', {
        id: msg.getId(), de: msg.getFrom(), assunto: msg.getSubject(),
        corpo: msg.getPlainBody().slice(0, 20000), anexos: anexos,
      });
      if (!r) ok = false;
    });
    if (ok) conversa.addLabel(rotulo);
  });
  if (!conversas.length) chamar_('post', '/api/gmail/ping', {});
}

/** De hora em hora: manda para você os avisos de vencimento do dia (cada um sai uma vez só). */
function enviarAvisos() { enviarAvisos_(false); }

function enviarAvisos_(agora) {
  const r = chamar_('get', '/api/gmail/avisos' + (agora ? '?agora=1' : ''));
  if (!r || !r.avisos || !r.avisos.length) return;
  const eu = Session.getEffectiveUser().getEmail();
  const enviados = [];
  r.avisos.forEach(function (a) {
    GmailApp.sendEmail(eu, a.assunto, a.texto, { htmlBody: a.html, name: 'ZYRO' });
    enviados.push({ documento: a.documento, tipo: a.tipo });
  });
  chamar_('post', '/api/gmail/avisos', { enviados: enviados });
}

/** Manda para você um boleto de exemplo (empresa fictícia, vence em 2 dias), lê e já dispara o aviso. */
function testar() {
  const boleto = UrlFetchApp.fetch(ZYRO_URL + '/api/exemplos/boleto-moinho?dias=2').getBlob().setName('boleto-exemplo.pdf');
  GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Boleto de exemplo — Moinho Bom Trigo',
    'Boleto de demonstração gerado pelo ZYRO (empresa fictícia, sem valor).', { attachments: [boleto] });
  Utilities.sleep(10000);
  verificarContas();
  enviarAvisos_(true);
}

function chamar_(metodo, caminho, dados) {
  const opcoes = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ZYRO_CHAVE } };
  if (dados) { opcoes.contentType = 'application/json'; opcoes.payload = JSON.stringify(dados); }
  const res = UrlFetchApp.fetch(ZYRO_URL + caminho, opcoes);
  if (res.getResponseCode() !== 200) { Logger.log('ZYRO ' + caminho + ': ' + res.getResponseCode() + ' ' + res.getContentText()); return null; }
  return JSON.parse(res.getContentText());
}
`;
}
