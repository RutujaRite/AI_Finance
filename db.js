const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "login_db",
  password: "Akshuu@24",
  port: 5432,
});

module.exports = pool;
