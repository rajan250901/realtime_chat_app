const { pool } = require("./db");

async function ensureChatSchema() {
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP NULL`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member'`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(100)`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`,
    `DROP INDEX IF EXISTS messages_client_message_id_unique`,
    `CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_id_unique ON messages(client_message_id)`,
    `CREATE INDEX IF NOT EXISTS messages_conversation_id_id_idx ON messages(conversation_id, id DESC)`,
    `CREATE INDEX IF NOT EXISTS conversation_members_conversation_user_idx ON conversation_members(conversation_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS message_deliveries (id SERIAL PRIMARY KEY, message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(message_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS conversation_reads (conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_read_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(conversation_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS message_reactions (id SERIAL PRIMARY KEY, message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(message_id, user_id))`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }

  await pool.query(`UPDATE conversation_members SET role = 'member' WHERE role IS NULL`);
  console.log("Chat feature schema verified");
}

module.exports = { ensureChatSchema };
