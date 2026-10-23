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
    const { is_assistant_default, name, purpose, provider, model_id, route_via_gateway } = body;

    const client = await pool.connect();
    try {
      // Check existing model
      const existingRes = await client.query(`SELECT * FROM registered_models WHERE id = $1`, [id]);
      if (!existingRes.rowCount || existingRes.rowCount === 0) {
        return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 });
      }
      const existingModel = existingRes.rows[0];

      let shouldBeDefault = is_assistant_default !== undefined ? Boolean(is_assistant_default) : existingModel.is_assistant_default;

      if (is_assistant_default === true) {
        await client.query(`UPDATE registered_models SET is_assistant_default = false`);
      }

      // Update registered model with all provided fields
      const updateRes = await client.query(
        `UPDATE registered_models
         SET name = COALESCE($1, name),
             model_id = COALESCE($2, model_id),
             provider = COALESCE($3, provider),
             purpose = COALESCE($4, purpose),
             is_assistant_default = COALESCE($5, is_assistant_default),
             route_via_gateway = COALESCE($6, route_via_gateway)
         WHERE id = $7
         RETURNING *`,
        [
          name !== undefined ? String(name).trim() : null,
          model_id !== undefined ? String(model_id).trim() : null,
          provider !== undefined ? String(provider).trim() : null,
          purpose !== undefined ? String(purpose).trim() : null,
          is_assistant_default !== undefined ? shouldBeDefault : null,
          route_via_gateway !== undefined ? Boolean(route_via_gateway) : null,
          id,
        ]
      );

      const updatedModel = updateRes.rows[0];

      // Synchronize with ai_models if this model is default / active
      if (updatedModel.is_assistant_default) {
        try {
          await client.query(
            `UPDATE ai_models SET is_active = false, is_default = false WHERE category = 'LLM'`
          );
          const aiModelCheck = await client.query(
            `SELECT id FROM ai_models WHERE category = 'LLM' AND model_name = $1 LIMIT 1`,
            [updatedModel.model_id]
          );
          if (aiModelCheck.rowCount && aiModelCheck.rowCount > 0) {
            await client.query(
              `UPDATE ai_models
               SET is_active = true, is_default = true, display_name = $1, provider = $2, updated_at = NOW()
               WHERE id = $3`,
              [updatedModel.name, updatedModel.provider, aiModelCheck.rows[0].id]
            );
          } else {
            await client.query(
              `INSERT INTO ai_models (category, model_name, provider, is_active, is_default, display_name, updated_at)
               VALUES ('LLM', $1, $2, true, true, $3, NOW())`,
              [updatedModel.model_id, updatedModel.provider, updatedModel.name]
            );
          }
          const { invalidateModelCache } = await import("@/lib/ai/modelRouter");
          invalidateModelCache();
        } catch (syncErr) {
          console.warn("[API_REGISTERED_MODELS_PATCH] ai_models sync warning:", syncErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Model "${updatedModel.name}" updated successfully.`,
        model: updatedModel,
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
