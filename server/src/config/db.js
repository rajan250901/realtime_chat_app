const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // Render / Supabase PostgreSQL generally works
    // better with SSL in production.
    ...(process.env.NODE_ENV === "production"
        ? {
              ssl: {
                  rejectUnauthorized: false,
              },
          }
        : {}),
});

const setupDatabase = async () => {
    /*
     * USERS
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar_url TEXT,
            last_seen TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    /*
     * CONVERSATIONS
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            type VARCHAR(20) NOT NULL
                CHECK (type IN ('direct', 'group')),
            name VARCHAR(100),
            avatar_url TEXT,
            created_by INTEGER
                REFERENCES users(id)
                ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    /*
     * CONVERSATION MEMBERS
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS conversation_members (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL
                REFERENCES conversations(id)
                ON DELETE CASCADE,

            user_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,

            role VARCHAR(20)
                NOT NULL
                DEFAULT 'member',

            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(conversation_id, user_id)
        )
    `);

    /*
     * Add role if old table already exists.
     */

    await pool.query(`
        ALTER TABLE conversation_members
        ADD COLUMN IF NOT EXISTS role
        VARCHAR(20)
        NOT NULL
        DEFAULT 'member'
    `);

    /*
     * MESSAGES
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,

            conversation_id INTEGER NOT NULL
                REFERENCES conversations(id)
                ON DELETE CASCADE,

            sender_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,

            content TEXT NOT NULL,

            client_message_id VARCHAR(100),

            edited BOOLEAN
                NOT NULL
                DEFAULT FALSE,

            deleted_at TIMESTAMP NULL,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);

    /*
     * Add missing message columns
     * for old production databases.
     */

    await pool.query(`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS
        client_message_id VARCHAR(100)
    `);

    await pool.query(`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS
        edited BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS
        deleted_at TIMESTAMP NULL
    `);

    /*
     * CONVERSATION READS
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS conversation_reads (
            id SERIAL PRIMARY KEY,

            conversation_id INTEGER NOT NULL
                REFERENCES conversations(id)
                ON DELETE CASCADE,

            user_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,

            last_read_message_id INTEGER
                REFERENCES messages(id)
                ON DELETE SET NULL,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(conversation_id, user_id)
        )
    `);

    /*
     * MESSAGE DELIVERIES
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS message_deliveries (
            id SERIAL PRIMARY KEY,

            message_id INTEGER NOT NULL
                REFERENCES messages(id)
                ON DELETE CASCADE,

            user_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,

            delivered_at TIMESTAMP NULL,

            read_at TIMESTAMP NULL,

            UNIQUE(message_id, user_id)
        )
    `);

    /*
     * MESSAGE REACTIONS
     */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS message_reactions (
            id SERIAL PRIMARY KEY,

            message_id INTEGER NOT NULL
                REFERENCES messages(id)
                ON DELETE CASCADE,

            user_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,

            emoji VARCHAR(20),

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);

    /*
     * THIS IS THE IMPORTANT FIX
     * for your current Render error:
     *
     * column mr.emoji does not exist
     */

    await pool.query(`
        ALTER TABLE message_reactions
        ADD COLUMN IF NOT EXISTS emoji VARCHAR(20)
    `);

    /*
     * INDEXES
     */

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_conversation_members_user
        ON conversation_members(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_conversation_members_conversation
        ON conversation_members(conversation_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_messages_conversation_id_id
        ON messages(conversation_id, id DESC)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_messages_sender_id
        ON messages(sender_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_message_reactions_message
        ON message_reactions(message_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_message_deliveries_message
        ON message_deliveries(message_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_message_deliveries_user
        ON message_deliveries(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_conversation_reads_user
        ON conversation_reads(user_id)
    `);

    /*
     * CLIENT MESSAGE ID UNIQUE INDEX
     */

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_messages_client_message_id
        ON messages(client_message_id)
        WHERE client_message_id IS NOT NULL
    `);

    console.log("Database schema verified successfully");
};

const connectDB = async () => {
    try {
        await pool.query("SELECT NOW()");

        console.log("Database connected successfully");

        await setupDatabase();

        console.log("Database setup completed successfully");
    } catch (error) {
        console.error("Database connection/setup failed:", error);

        throw error;
    }
};

module.exports = {
    pool,
    connectDB,
};
