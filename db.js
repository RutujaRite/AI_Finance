const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "login_db",
  password: process.env.DB_PASSWORD || "",
  port: 5432,
});

module.exports = pool;
