/**
 * Database Initialization Script for CreditWise AI / Next.js
 * Executes schema.sql to ensure all extensions, tables, constraints,
 * and indexes are created idempotently.
 *
 * Run with: npx tsx scripts/initializeDatabase.ts
 */

import fs from "fs";
import path from "path";
import pool from "../lib/db";

async function initializeDatabase() {
  console.log("Starting CreditWise AI Database Initialization using schema.sql...");
  const schemaPath = path.join(__dirname, "../schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  const client = await pool.connect();
  try {
    await client.query(schemaSql);
    console.log("Database initialized successfully. All tables, extensions, and indexes verified.");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase().catch((err) => {
  console.error("Fatal error during database initialization:", err);
  process.exit(1);
});
