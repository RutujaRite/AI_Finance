/**
 * Database connection pool for PostgreSQL.
 * Internal usage: all lib/ modules and API routes obtain connections from this pool.
 */

import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  database: process.env.DB_NAME || "login_db",
  password: process.env.DB_PASSWORD || "system123",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

export default pool;
