# Quita · contas a pagar no automático

![Next.js](https://img.shields.io/badge/Next.js_15-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff) ![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=fff) ![Telegram](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?logo=telegram&logoColor=fff) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=fff) ![Vercel Cron](https://img.shields.io/badge/Vercel-Cron-000?logo=vercel)

**🔗 Demo ao vivo: [quita-contas.vercel.app](https://quita-contas.vercel.app)** · bot: [@kdjdabot](https://t.me/kdjdabot) · painel de exemplo: [/demo](https://quita-contas.vercel.app/demo)

![Painel do Quita](docs/painel.png)

Automação de contas a pagar para pequenos negócios. Você **encaminha o boleto, a conta de consumo ou o XML da NF-e para um bot do Telegram**, e o Quita faz o resto:

1. **lê** o documento (texto do PDF ou campos do XML);
2. **encontra e valida** a linha digitável ou a chave da NF-e pelos dígitos verificadores;
3. extrai **valor, vencimento, banco e fornecedor** e **classifica** por categoria;
4. **bloqueia lançamento duplicado**;
5. **agenda lembretes** no Telegram (X dias antes, no dia e no dia seguinte), com botões "✅ Paguei" e "📋 Linha digitável";
6. mostra tudo num **painel pessoal**: contas, previsão de saídas, gastos por categoria e o **histórico de execuções**, passo a passo, como no n8n.

- Site: `/` · Painel da padaria fictícia: `/demo` · Painel pessoal: `/p/{token}` (o bot envia o link no `/start`)
- Documentos de exemplo, gerados na hora e sempre com vencimento futuro: `/api/exemplos/{boleto-moinho|conta-energia|nfe-laticinios|boleto-internet}`

---

## Por que não usa IA para ler o boleto

A linha digitável **já carrega os dados**, protegidos por dígitos verificadores. O Quita decodifica tudo de forma determinística (`src/lib/codigos.ts`):

| Documento | Tamanho | O que sai do código | Validação |
| --- | --- | --- | --- |
| Boleto bancário | 47 dígitos | banco, valor, vencimento (fator) | módulo 10 em cada campo + módulo 11 geral |
| Arrecadação (água, luz, telefone, tributos) | 48 dígitos, começa com 8 | segmento → categoria, valor, vencimento quando embutido | módulo 10 ou 11 por bloco, conforme o identificador |
| Chave da NF-e | 44 dígitos | UF, mês de emissão, CNPJ do emitente, número | módulo 11 |
| XML da NF-e | — | emitente, total e **cada duplicata** (vencimento e valor) | estrutura do XML |

Detalhes que costumam passar despercebidos:

- **O fator de vencimento reiniciou em 22/02/2025** (chegou a 9999 e voltou a 1000). O mesmo fator vale para duas datas separadas por 25 anos, e o Quita escolhe a mais próxima de hoje.
- Um documento impresso junta números vizinhos ("Pedido 2026 000123"). A busca testa janelas deslizantes e só aceita códigos com todos os DVs corretos. Em 2.000 boletos aleatórios, **zero falsos positivos** (há teste para isso).
- A IA (Groq, camada gratuita, opcional) entra só para **dar nome ao fornecedor** quando o layout não tem o rótulo "Beneficiário". **Nunca decide valor nem data.**

## Arquitetura

```
Telegram ──webhook──► /api/telegram ─┐
Painel (upload/exemplo/texto) ──────►├─► pipeline.ts ──► Supabase (schema "contas") ◄── /api/agendador (Vercel Cron, 8h)
                                     │   Receber → Ler → Encontrar → Validar →              └─► lembretes no Telegram
                                     │   Enriquecer → Deduplicar → Salvar e agendar              + resumo semanal
                                     └─► registro da execução (cada passo com tempo e resultado)
```

- **Next.js 15** (App Router, Route Handlers), **unpdf** para o texto do PDF, **fast-xml-parser** para NF-e e **pdf-lib** para gerar os exemplos (boleto com código de barras Intercalado 2 de 5 de verdade).
- **Telegram Bot API** via HTTPS puro: webhook com `secret_token`, botões inline e callbacks.
- **Vercel Cron** diário (`vercel.json`): lembretes sem repetição (tabela `lembretes`), resumo às segundas e recriação da carteira demo.

### Segurança

- Tabelas no schema **`contas`, fora da API REST** do Supabase. O acesso é só pelas funções `public.contas_*`, que exigem um segredo do servidor (`CONTAS_SEGREDO`), que nunca vai ao navegador.
- **Webhook** aceita apenas requisições com o cabeçalho `X-Telegram-Bot-Api-Secret-Token`. O **agendador** aceita apenas `Authorization: Bearer CRON_SECRET`.
- **Painel pessoal** por token de 144 bits, `noindex` e `no-referrer`.
- Cada conversa no Telegram é uma carteira isolada. Os botões só alteram contas da própria carteira.

## Como rodar

```bash
npm install
# banco: aplique supabase/migrations/*.sql num projeto Supabase e gere o segredo:
#   insert into public.segredos values ('contas', encode(gen_random_bytes(32), 'hex'));
cp .env.example .env.local        # Supabase, CONTAS_SEGREDO, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SEGREDO, CRON_SECRET, APP_URL
npm run dev                       # http://localhost:3300
npm test                          # códigos de boleto, arrecadação, NF-e, busca em texto e categorias

# depois de publicar:
node scripts/configurar-telegram.mjs https://SEU-DOMINIO   # webhook, comandos e descrição do bot
```

## Limitações

- **Foto de boleto** não é lida (sem OCR). O bot pede o PDF ou a linha digitável colada, que é o que dá 100% de precisão.
- Contas de arrecadação **sem vencimento embutido** entram marcadas "conferir".
- Lembretes vão pelo Telegram. **E-mail e WhatsApp** entrariam como novos canais no mesmo agendador.
