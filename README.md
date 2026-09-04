# Zapzap: ponte WhatsApp Web + Chatwoot

PoC de atendimento humano bidirecional usando `whatsapp-web.js` e a API do Chatwoot. A solução não usa a API Oficial da Meta: ela mantém uma sessão local do WhatsApp Web com Puppeteer.

## Requisitos

- Node.js 18 ou superior
- Uma instância do Chatwoot com uma caixa de entrada do tipo API
- WhatsApp no celular para ler o QR Code na primeira execução

## Instalação

```bash
npm install
cp .env.example .env
```

Edite `.env` com os dados da sua conta Chatwoot. O servidor pode abrir sem essas variáveis para consulta da página de status, mas o encaminhamento de mensagens só funciona após a configuração.

## Execução

```bash
npm start
```

Abra `http://localhost:3000/`. Na primeira execução, escaneie o QR Code exibido no terminal. A sessão fica persistida em `.wwebjs_auth` e não precisa ser escaneada novamente enquanto permanecer válida.

Para expor o webhook ao Chatwoot, publique a rota abaixo em uma URL acessível pela sua instância:

```text
POST /webhook/chatwoot
```

No Chatwoot, cadastre essa URL em um webhook da conta e selecione o evento `message_created`.

## Fluxos implementados

1. Mensagens recebidas no WhatsApp são convertidas para E.164, associadas a um contato/conversa localmente e encaminhadas como `incoming` ao Chatwoot.
2. Mensagens `outgoing` públicas recebidas no webhook são enviadas ao número correspondente no WhatsApp.
3. Eventos privados, eventos diferentes de `message_created` e mensagens que não são `outgoing` são ignorados para evitar loops.

## Banco e arquivos locais

O banco `data.sqlite` é criado automaticamente com a tabela `contacts`. A pasta `.wwebjs_auth` contém a sessão autenticada e não deve ser versionada. Esses arquivos já estão no `.gitignore`.

## Endpoints locais

- `GET /`: painel simples de estado da aplicação.
- `GET /health`: estado em JSON para monitoramento.
- `POST /webhook/chatwoot`: entrada de mensagens do Chatwoot.

## Observações da PoC

O WhatsApp Web automatizado pode desconectar ou exigir novo QR Code. Use essa integração apenas respeitando os termos aplicáveis do WhatsApp e do Chatwoot. Em produção, adicione autenticação/assinatura no webhook, logs estruturados, retry e tratamento de mídia.