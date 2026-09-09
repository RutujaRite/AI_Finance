const pool = require("../lib/db");

async function findByEmailAndPassword(email, password) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1 AND password = $2",
    [email, password]
  );

  return result.rows[0] || null;
}

async function updateLastLogin(userId) {
  await pool.query(
    "UPDATE users SET last_login = NOW() WHERE id = $1",
    [userId]
  );
}
async function findByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0] || null;
}

async function createUser(name, email, password) {
  await pool.query(
    "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
    [name, email, password]
  );
}

module.exports = {
  findByEmailAndPassword,
  updateLastLogin,
  findByEmail,
  createUser
};