require('dotenv').config();

const express = require('express');
const path = require('node:path');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const db = require('./db');
const chatwoot = require('./chatwootService');

const port = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let currentQrCode = null;

app.get('/health', (request, response) => {
  response.json({
    status: 'ok',
    whatsapp: Boolean(client.info),
    chatwoot: chatwoot.isConfigured(),
  });
});

app.get('/qr', (request, response) => {
  response.json({ qrCode: currentQrCode });
});

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  },
});

function toE164(value) {
  const digits = String(value || '').replace(/@c\.us$/, '').replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

function toWhatsAppId(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  return digits ? `${digits}@c.us` : null;
}

function getWebhookPhone(payload) {
  return payload?.conversation?.meta?.sender?.phone_number
    || payload?.conversation?.contact?.phone_number
    || payload?.contact?.phone_number
    || payload?.sender?.phone_number;
}

async function forwardMessageToChatwoot(message) {
  if (message.fromMe || !message.from.endsWith('@c.us') || !message.body) {
    return;
  }

  const phoneNumber = toE164(message.from);
  if (!phoneNumber) {
    console.warn('Mensagem ignorada: número de telefone inválido.');
    return;
  }

  let contact = db.findContact(phoneNumber);
  if (!contact) {
    const chatwootContact = await chatwoot.createContact(
      phoneNumber,
      message._data?.notifyName,
    );
    const chatwootContactId = chatwootContact.id;
    const conversation = await chatwoot.createConversation(chatwootContactId);
    const chatwootConversationId = conversation.id || conversation.payload?.id;

    if (!chatwootContactId || !chatwootConversationId) {
      throw new Error('A API do Chatwoot não retornou os IDs esperados.');
    }

    db.saveContact(phoneNumber, chatwootContactId, chatwootConversationId);
    contact = db.findContact(phoneNumber);
  }

  await chatwoot.sendIncomingMessage(
    contact.chatwoot_conversation_id,
    message.body,
  );
  console.log(`Mensagem de ${phoneNumber} encaminhada ao Chatwoot.`);
}

app.post('/webhook/chatwoot', async (request, response) => {
  const payload = request.body || {};
  const message = payload.message || payload;

  if (
    payload.event !== 'message_created'
    || message.private === true
    || message.message_type !== 'outgoing'
  ) {
    return response.status(200).json({ ignored: true });
  }

  const phoneNumber = toE164(getWebhookPhone(payload));
  const content = message.content;
  const whatsappId = toWhatsAppId(phoneNumber);

  if (!content || !whatsappId) {
    return response.status(400).json({ error: 'Mensagem ou telefone ausente.' });
  }

  try {
    if (!client.info) {
      return response.status(503).json({ error: 'WhatsApp ainda não está pronto.' });
    }

    await client.sendMessage(whatsappId, content);
    console.log(`Mensagem do Chatwoot enviada para ${whatsappId}.`);
    return response.status(200).json({ sent: true });
  } catch (error) {
    console.error('Erro ao enviar mensagem para o WhatsApp:', error.message);
    return response.status(500).json({ error: 'Falha ao enviar mensagem.' });
  }
});

client.on('qr', async (qr) => {
  console.log('Escaneie o QR Code abaixo no WhatsApp:');
  qrcode.generate(qr, { small: true });
  currentQrCode = await QRCode.toDataURL(qr);
});

client.on('ready', () => {
  currentQrCode = null;
  console.log('WhatsApp conectado e pronto.');
});
client.on('authenticated', () => console.log('Sessão do WhatsApp autenticada.'));
client.on('auth_failure', (error) => console.error('Falha na autenticação:', error));
client.on('disconnected', (reason) => console.warn('WhatsApp desconectado:', reason));
client.on('message', (message) => {
  forwardMessageToChatwoot(message).catch((error) => {
    console.error('Erro ao encaminhar mensagem ao Chatwoot:', error.message);
  });
});

const server = app.listen(port, () => {
  console.log(`Webhook ouvindo em http://localhost:${port}/webhook/chatwoot`);
});

client.initialize().catch((error) => {
  console.error('Erro ao inicializar o WhatsApp:', error);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando aplicação...`);
  server.close();
  client.destroy().finally(() => {
    db.close();
    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
