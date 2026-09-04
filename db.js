const path = require('node:path');
const Database = require('better-sqlite3');

const database = new Database(path.join(__dirname, 'data.sqlite'));

database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    chatwoot_contact_id INTEGER NOT NULL,
    chatwoot_conversation_id INTEGER NOT NULL
  )
`);

const findContactStatement = database.prepare(`
  SELECT id, phone_number, chatwoot_contact_id, chatwoot_conversation_id
  FROM contacts
  WHERE phone_number = ?
`);

const saveContactStatement = database.prepare(`
  INSERT INTO contacts (
    phone_number,
    chatwoot_contact_id,
    chatwoot_conversation_id
  ) VALUES (?, ?, ?)
  ON CONFLICT(phone_number) DO UPDATE SET
    chatwoot_contact_id = excluded.chatwoot_contact_id,
    chatwoot_conversation_id = excluded.chatwoot_conversation_id
`);

function findContact(phoneNumber) {
  return findContactStatement.get(phoneNumber);
}

function saveContact(phoneNumber, chatwootContactId, chatwootConversationId) {
  return saveContactStatement.run(
    phoneNumber,
    chatwootContactId,
    chatwootConversationId,
  );
}

module.exports = {
  findContact,
  saveContact,
  close: () => database.close(),
};
