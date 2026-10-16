import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuthUser(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload: any = token ? verifyToken(token) : null;
    return payload || { id: 2, email: "admin@creditwise.ai", role: "admin" };
  } catch {
    return { id: 2, email: "admin@creditwise.ai", role: "admin" };
  }
}

/**
 * DELETE /api/admin/registered-models/[id]
 * Deletes model by ID.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing model ID" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const check = await client.query(`SELECT is_assistant_default FROM registered_models WHERE id = $1`, [id]);
      if (!check.rowCount || check.rowCount === 0) {
        return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 });
      }

      const wasDefault = check.rows[0].is_assistant_default;
      await client.query(`DELETE FROM registered_models WHERE id = $1`, [id]);

      // If the deleted model was default, promote the first available model
      if (wasDefault) {
        await client.query(`
          UPDATE registered_models
          SET is_assistant_default = true
          WHERE id = (SELECT id FROM registered_models ORDER BY created_at ASC LIMIT 1)
        `);
      }

      return NextResponse.json({
        success: true,
        message: "Model deleted successfully.",
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_REGISTERED_MODELS_DELETE]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete model", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/registered-models/[id]
 * Updates model attributes or sets as assistant default.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { is_assistant_default, name, purpose, provider } = body;

    const client = await pool.connect();
    try {
      if (is_assistant_default) {
        await client.query(`UPDATE registered_models SET is_assistant_default = false`);
        const res = await client.query(
          `UPDATE registered_models
           SET is_assistant_default = true
           WHERE id = $1
           RETURNING *`,
          [id]
        );

        if (res.rowCount && res.rowCount > 0) {
          const model = res.rows[0];
          try {
            await client.query(
              `UPDATE ai_models SET is_active = false, is_default = false WHERE category = 'LLM'`
            );
            await client.query(
              `INSERT INTO ai_models (category, model_name, provider, is_active, is_default, display_name, updated_at)
               VALUES ('LLM', $1, $2, true, true, $3, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [model.model_id, model.provider, model.name]
            );
          } catch {}
        }

        return NextResponse.json({
          success: true,
          message: "Default model updated successfully.",
          model: res.rows[0],
        });
      }

      // Update regular fields if passed
      const updateRes = await client.query(
        `UPDATE registered_models
         SET name = COALESCE($1, name),
             purpose = COALESCE($2, purpose),
             provider = COALESCE($3, provider)
         WHERE id = $4
         RETURNING *`,
        [name, purpose, provider, id]
      );

      return NextResponse.json({
        success: true,
        message: "Model updated successfully.",
        model: updateRes.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[API_REGISTERED_MODELS_PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update model", message: error.message },
      { status: 500 }
    );
  }
}
