// app/api/admin/database/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const client = await pool.connect();
    let latencyMs = 0;
    let totalChunks = 0;
    let totalDocs = 0;
    let pgVersion = "PostgreSQL 15+";
    let hasVector = false;

    try {
      const pingRes = await client.query("SELECT NOW() as now, version() as version");
      latencyMs = Math.max(1, Date.now() - start);
      if (pingRes.rows[0]?.version) {
        pgVersion = pingRes.rows[0].version.split(" on ")[0];
      }

      // Check vector extension
      const extRes = await client
        .query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        .catch(() => ({ rows: [] }));
      hasVector = extRes.rows.length > 0;

      // Check chunks count
      const chunkRes = await client
        .query("SELECT COUNT(*) as count FROM knowledge_chunks")
        .catch(() => ({ rows: [{ count: 0 }] }));
      totalChunks = parseInt(chunkRes.rows[0]?.count || "0", 10);

      // Check docs count
      const docRes = await client
        .query("SELECT COUNT(*) as count FROM knowledge_documents")
        .catch(() => ({ rows: [{ count: 0 }] }));
      totalDocs = parseInt(docRes.rows[0]?.count || "0", 10);
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      connected: true,
      latencyMs,
      engine: hasVector ? "PostgreSQL + pgvector" : "PostgreSQL (pgvector ready)",
      version: pgVersion,
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "login_db",
      user: process.env.DB_USER || "postgres",
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        max: 20,
      },
      stats: {
        totalChunks,
        totalDocs,
        vectorDimensions: 1536,
        indexType: "HNSW / Cosine",
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error?.message || "Database connection failed",
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "login_db",
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
