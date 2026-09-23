/**
 * Configura o bot do Telegram para o ambiente publicado:
 *   node scripts/configurar-telegram.mjs https://seu-dominio.vercel.app
 *
 * Lê TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SEGREDO do .env.local.
 */
import { readFileSync } from 'node:fs';

const url = process.argv[2];
if (!url?.startsWith('https://')) throw new Error('Informe a URL pública (https://…) do app.');

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

async function api(metodo, corpo) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados = await res.json();
  console.log(`${dados.ok ? '✓' : '✗'} ${metodo}${dados.ok ? '' : ` — ${dados.description}`}`);
  return dados;
}

await api('setWebhook', {
  url: `${url}/api/telegram`,
  secret_token: env.TELEGRAM_WEBHOOK_SEGREDO,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: true,
});
await api('setMyName', { name: 'Quita · Contas a pagar' });
await api('setMyShortDescription', { short_description: 'Mande o boleto: eu leio, organizo e te lembro antes de vencer.' });
await api('setMyDescription', {
  description:
    'Encaminhe o PDF do boleto, a conta de consumo ou o XML da NF-e. Eu confiro o código, leio valor e vencimento, evito lançamento duplicado e te lembro antes de vencer. Projeto de portfólio — use documentos de exemplo do site.',
});
await api('setMyCommands', {
  commands: [
    { command: 'contas', description: 'Próximas contas a pagar' },
    { command: 'painel', description: 'Link do seu painel' },
    { command: 'ajuda', description: 'Como usar' },
  ],
});
const info = await api('getWebhookInfo', {});
console.log('webhook:', info.result?.url, '· pendentes:', info.result?.pending_update_count);
