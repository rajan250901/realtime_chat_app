const { pool } = require("../config/db");

const searchUsers = async (search, currentUserId) => {
  const result = await pool.query(
    `SELECT id, name, email, avatar_url, last_seen FROM users
     WHERE (name ILIKE $1 OR email ILIKE $1) AND id != $2
     ORDER BY name ASC LIMIT 20`, [`%${search}%`, currentUserId]
  );
  return result.rows;
};

const getUserById = async (userId) => {
  const result = await pool.query(`SELECT id, name, email, avatar_url, last_seen, created_at FROM users WHERE id = $1`, [userId]);
  return result.rows[0];
};

module.exports = { searchUsers, getUserById };
