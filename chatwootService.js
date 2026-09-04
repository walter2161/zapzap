const axios = require('axios');

const apiUrl = (process.env.CHATWOOT_API_URL || '').replace(/\/$/, '');
const accountId = process.env.CHATWOOT_ACCOUNT_ID;
const inboxId = Number(process.env.CHATWOOT_INBOX_ID);

function isConfigured() {
  return Boolean(
    apiUrl
      && accountId
      && process.env.CHATWOOT_API_TOKEN
      && Number.isInteger(inboxId),
  );
}

function ensureConfigured() {
  if (!isConfigured()) {
  throw new Error(
    'Configure CHATWOOT_API_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_INBOX_ID e CHATWOOT_API_TOKEN.',
  );
  }
}

const client = axios.create({
  baseURL: `${apiUrl}/api/v1/accounts/${accountId}`,
  headers: {
    'api_access_token': process.env.CHATWOOT_API_TOKEN,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

async function createContact(phoneNumber, name) {
  ensureConfigured();
  const { data } = await client.post('/contacts', {
    name: name || phoneNumber,
    phone_number: phoneNumber,
  });

  return data.payload?.contact || data.payload || data.contact || data;
}

async function createConversation(contactId) {
  ensureConfigured();
  const { data } = await client.post('/conversations', {
    contact_id: contactId,
    inbox_id: inboxId,
  });

  return data;
}

async function sendIncomingMessage(conversationId, content) {
  ensureConfigured();
  const { data } = await client.post(
    `/conversations/${conversationId}/messages`,
    {
      content,
      message_type: 'incoming',
      private: false,
    },
  );

  return data;
}

module.exports = {
  isConfigured,
  createContact,
  createConversation,
  sendIncomingMessage,
};
