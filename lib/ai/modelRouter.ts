/**
 * Central Model Router & Dynamic AI Engine Dispatcher
 * Manages active configurations for STT, LLM, and TTS engines.
 * Concurrency-safe database transactions and in-memory caching.
 */

import pool from "@/lib/db";

export type ModelCategory = "STT" | "LLM" | "TTS";

export interface AiModelConfig {
  id: number;
  category: ModelCategory;
  model_name: string;
  provider: string;
  has_custom_api_key: boolean;
  base_url?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// In-memory cache for active models
let activeModelCache: Record<ModelCategory, AiModelConfig | null> = {
  STT: null,
  LLM: null,
  TTS: null,
};
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export function invalidateModelCache() {
  activeModelCache = {
    STT: null,
    LLM: null,
    TTS: null,
  };
  lastCacheTime = 0;
}

/**
 * Automatically resolves the provider from the model identifier.
 */
export function resolveProviderFromModel(modelName: string): string {
  const norm = String(modelName || "").trim().toLowerCase();
  if (norm.startsWith("openai/") || norm.includes("whisper") || norm.includes("gpt-") || norm.includes("tts-1")) return "OpenAI";
  if (norm.startsWith("anthropic/") || norm.includes("claude")) return "Anthropic";
  if (norm.startsWith("google/") || norm.includes("gemini")) return "Google";
  if (norm.startsWith("meta-llama/") || norm.includes("llama")) return "Meta";
  if (norm.startsWith("deepseek/") || norm.includes("deepseek")) return "DeepSeek";
  if (norm.startsWith("mistralai/") || norm.includes("mistral")) return "Mistral AI";
  if (norm.startsWith("elevenlabs/") || norm.includes("elevenlabs")) return "ElevenLabs";
  if (norm.startsWith("groq/")) return "Groq";
  return "OpenRouter";
}

/**
 * Ensures table exists and seeds initial baseline defaults if table is empty.
 */
export async function ensureAiModelsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id SERIAL PRIMARY KEY,
        category VARCHAR(20) NOT NULL CHECK (category IN ('STT', 'LLM', 'TTS')),
        model_name VARCHAR(150) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        api_key TEXT,
        base_url TEXT,
        is_active BOOLEAN DEFAULT false,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_models_category ON ai_models(category);
      CREATE INDEX IF NOT EXISTS idx_ai_models_active ON ai_models(category, is_active);
    `);

    // Check count
    const countRes = await client.query(`SELECT COUNT(*) as count FROM ai_models`);
    const count = parseInt(countRes.rows[0].count, 10);
    if (count === 0) {
      await seedDefaultModelsInternal(client);
    }
  } finally {
    client.release();
  }
}

/**
 * Baseline predefined system defaults
 */
const SYSTEM_DEFAULTS: Array<{
  category: ModelCategory;
  model_name: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
}> = [
  // STT Engine
  {
    category: "STT",
    model_name: "openai/whisper-large-v3",
    provider: "OpenAI",
    is_active: true,
    is_default: true,
  },
  {
    category: "STT",
    model_name: "openai/whisper-1",
    provider: "OpenAI",
    is_active: false,
    is_default: false,
  },
  // LLM Reasoning Engine
  {
    category: "LLM",
    model_name: "openrouter/auto",
    provider: "OpenRouter",
    is_active: true,
    is_default: true,
  },
  {
    category: "LLM",
    model_name: "anthropic/claude-3.5-sonnet",
    provider: "Anthropic",
    is_active: false,
    is_default: false,
  },
  {
    category: "LLM",
    model_name: "google/gemini-2.5-flash",
    provider: "Google",
    is_active: false,
    is_default: false,
  },
  {
    category: "LLM",
    model_name: "openai/gpt-4o",
    provider: "OpenAI",
    is_active: false,
    is_default: false,
  },
  // TTS Voice Engine
  {
    category: "TTS",
    model_name: "openai/tts-1",
    provider: "OpenAI",
    is_active: true,
    is_default: true,
  },
  {
    category: "TTS",
    model_name: "elevenlabs/multilingual-v2",
    provider: "ElevenLabs",
    is_active: false,
    is_default: false,
  },
];

async function seedDefaultModelsInternal(client: any) {
  for (const m of SYSTEM_DEFAULTS) {
    await client.query(
      `
      INSERT INTO ai_models (category, model_name, provider, is_active, is_default)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [m.category, m.model_name, m.provider, m.is_active, m.is_default]
    );
  }
}

/**
 * Retrieves all models from DB, with api_key masked for security.
 */
export async function getAllAiModels(): Promise<AiModelConfig[]> {
  await ensureAiModelsTable();
  const res = await pool.query(`
    SELECT
      id,
      category,
      model_name,
      provider,
      (api_key IS NOT NULL AND api_key != '') as has_custom_api_key,
      base_url,
      is_active,
      is_default,
      created_at,
      updated_at
    FROM ai_models
    ORDER BY category ASC, is_active DESC, is_default DESC, id ASC
  `);

  return res.rows.map((r) => ({
    id: r.id,
    category: r.category as ModelCategory,
    model_name: r.model_name,
    provider: r.provider,
    has_custom_api_key: Boolean(r.has_custom_api_key),
    base_url: r.base_url,
    is_active: Boolean(r.is_active),
    is_default: Boolean(r.is_default),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Returns the currently active model config for a given category.
 */
export async function getActiveModel(category: ModelCategory): Promise<AiModelConfig | null> {
  const now = Date.now();
  if (activeModelCache[category] && now - lastCacheTime < CACHE_TTL_MS) {
    return activeModelCache[category];
  }

  await ensureAiModelsTable();
  const res = await pool.query(
    `
    SELECT
      id,
      category,
      model_name,
      provider,
      (api_key IS NOT NULL AND api_key != '') as has_custom_api_key,
      api_key,
      base_url,
      is_active,
      is_default,
      created_at,
      updated_at
    FROM ai_models
    WHERE category = $1 AND is_active = true
    LIMIT 1
    `,
    [category]
  );

  if (res.rowCount === 0) {
    return null;
  }

  const row = res.rows[0];
  const model: AiModelConfig = {
    id: row.id,
    category: row.category as ModelCategory,
    model_name: row.model_name,
    provider: row.provider,
    has_custom_api_key: Boolean(row.has_custom_api_key),
    base_url: row.base_url,
    is_active: true,
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  activeModelCache[category] = model;
  lastCacheTime = now;
  return model;
}

/**
 * Resolves active LLM model name for chat runtime.
 */
export async function getActiveLlmModelName(): Promise<string> {
  try {
    const active = await getActiveModel("LLM");
    if (active?.model_name) {
      return active.model_name;
    }
  } catch (err) {
    console.warn("Could not load active LLM model from DB:", err);
  }
  return process.env.OPENROUTER_MODEL || "openrouter/free";
}

/**
 * Concurrency-safe activation of a model within its category.
 * Deactivates any currently active model in that category, activates the selected model.
 */
export async function activateModel(id: number): Promise<{ success: boolean; model: AiModelConfig }> {
  await ensureAiModelsTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify model exists
    const checkRes = await client.query(`SELECT id, category, model_name, provider FROM ai_models WHERE id = $1`, [id]);
    if (checkRes.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new Error(`Model with ID ${id} not found.`);
    }

    const { category, model_name } = checkRes.rows[0];

    // 2. Deactivate currently active models in this category
    await client.query(`UPDATE ai_models SET is_active = false WHERE category = $1`, [category]);

    // 3. Activate selected model
    const updateRes = await client.query(
      `
      UPDATE ai_models
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, category, model_name, provider, (api_key IS NOT NULL AND api_key != '') as has_custom_api_key, base_url, is_active, is_default, created_at, updated_at
      `,
      [id]
    );

    await client.query("COMMIT");

    // Invalidate in-memory cache
    invalidateModelCache();

    // If LLM model was activated, update runtime environment variable
    if (category === "LLM") {
      process.env.OPENROUTER_MODEL = model_name;
    }

    const row = updateRes.rows[0];
    return {
      success: true,
      model: {
        id: row.id,
        category: row.category,
        model_name: row.model_name,
        provider: row.provider,
        has_custom_api_key: Boolean(row.has_custom_api_key),
        base_url: row.base_url,
        is_active: true,
        is_default: Boolean(row.is_default),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Adds a new custom model to the database.
 */
export async function createAiModel(data: {
  category: ModelCategory;
  model_name: string;
  provider?: string;
  api_key?: string;
  base_url?: string;
  is_active?: boolean;
}): Promise<AiModelConfig> {
  await ensureAiModelsTable();
  const category = data.category;
  const model_name = String(data.model_name || "").trim();
  if (!model_name) throw new Error("Model Name is required.");
  if (!["STT", "LLM", "TTS"].includes(category)) throw new Error("Category must be STT, LLM, or TTS.");

  const provider = data.provider?.trim() || resolveProviderFromModel(model_name);
  const apiKey = data.api_key ? data.api_key.trim() : null;
  const baseUrl = data.base_url ? data.base_url.trim() : null;
  const shouldActivate = Boolean(data.is_active);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check duplicate
    const dupCheck = await client.query(
      `SELECT id FROM ai_models WHERE category = $1 AND LOWER(model_name) = LOWER($2)`,
      [category, model_name]
    );
    if (dupCheck.rowCount! > 0) {
      await client.query("ROLLBACK");
      throw new Error(`A model named "${model_name}" already exists in ${category}.`);
    }

    // If shouldActivate, deactivate existing
    if (shouldActivate) {
      await client.query(`UPDATE ai_models SET is_active = false WHERE category = $1`, [category]);
    }

    const insertRes = await client.query(
      `
      INSERT INTO ai_models (category, model_name, provider, api_key, base_url, is_active, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id, category, model_name, provider, (api_key IS NOT NULL AND api_key != '') as has_custom_api_key, base_url, is_active, is_default, created_at, updated_at
      `,
      [category, model_name, provider, apiKey, baseUrl, shouldActivate]
    );

    await client.query("COMMIT");
    invalidateModelCache();

    if (shouldActivate && category === "LLM") {
      process.env.OPENROUTER_MODEL = model_name;
    }

    const row = insertRes.rows[0];
    return {
      id: row.id,
      category: row.category,
      model_name: row.model_name,
      provider: row.provider,
      has_custom_api_key: Boolean(row.has_custom_api_key),
      base_url: row.base_url,
      is_active: Boolean(row.is_active),
      is_default: Boolean(row.is_default),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Updates an existing model (name, api_key, category).
 * If api_key is omitted or empty string, preserves the existing key!
 */
export async function updateAiModel(
  id: number,
  data: {
    model_name?: string;
    category?: ModelCategory;
    api_key?: string;
    base_url?: string;
  }
): Promise<AiModelConfig> {
  await ensureAiModelsTable();
  const client = await pool.connect();
  try {
    const existingRes = await client.query(`SELECT * FROM ai_models WHERE id = $1`, [id]);
    if (existingRes.rowCount === 0) {
      throw new Error(`Model with ID ${id} not found.`);
    }

    const current = existingRes.rows[0];
    const newModelName = data.model_name ? data.model_name.trim() : current.model_name;
    const newCategory = data.category || current.category;
    const newProvider = resolveProviderFromModel(newModelName);
    const newBaseUrl = data.base_url !== undefined ? data.base_url : current.base_url;

    // Preserve existing key if not provided
    const newApiKey = data.api_key !== undefined && data.api_key.trim() !== "" ? data.api_key.trim() : current.api_key;

    const updateRes = await client.query(
      `
      UPDATE ai_models
      SET
        model_name = $1,
        category = $2,
        provider = $3,
        api_key = $4,
        base_url = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, category, model_name, provider, (api_key IS NOT NULL AND api_key != '') as has_custom_api_key, base_url, is_active, is_default, created_at, updated_at
      `,
      [newModelName, newCategory, newProvider, newApiKey, newBaseUrl, id]
    );

    invalidateModelCache();
    const row = updateRes.rows[0];
    return {
      id: row.id,
      category: row.category,
      model_name: row.model_name,
      provider: row.provider,
      has_custom_api_key: Boolean(row.has_custom_api_key),
      base_url: row.base_url,
      is_active: Boolean(row.is_active),
      is_default: Boolean(row.is_default),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } finally {
    client.release();
  }
}

/**
 * Deletes an inactive model.
 * Rejects deletion if the model is currently active.
 */
export async function deleteAiModel(id: number): Promise<void> {
  await ensureAiModelsTable();
  const client = await pool.connect();
  try {
    const checkRes = await client.query(`SELECT id, is_active, model_name, category FROM ai_models WHERE id = $1`, [id]);
    if (checkRes.rowCount === 0) {
      throw new Error(`Model with ID ${id} not found.`);
    }

    const { is_active, model_name, category } = checkRes.rows[0];
    if (is_active) {
      throw new Error(`Please activate another model before deleting this model ("${model_name}" is currently active).`);
    }

    await client.query(`DELETE FROM ai_models WHERE id = $1`, [id]);
    invalidateModelCache();
  } finally {
    client.release();
  }
}

/**
 * Restores system defaults from predefined baseline.
 * Does NOT delete custom models.
 */
export async function restoreDefaultAiModels(): Promise<void> {
  await ensureAiModelsTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Deactivate all
    await client.query("UPDATE ai_models SET is_active = false");

    for (const d of SYSTEM_DEFAULTS) {
      const exist = await client.query(
        `SELECT id FROM ai_models WHERE category = $1 AND LOWER(model_name) = LOWER($2)`,
        [d.category, d.model_name]
      );
      if (exist.rowCount! > 0) {
        await client.query(
          `UPDATE ai_models SET is_active = $1, is_default = $2 WHERE id = $3`,
          [d.is_active, d.is_default, exist.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO ai_models (category, model_name, provider, is_active, is_default)
           VALUES ($1, $2, $3, $4, $5)`,
          [d.category, d.model_name, d.provider, d.is_active, d.is_default]
        );
      }
    }

    await client.query("COMMIT");
    invalidateModelCache();

    // Ensure OpenRouter model env is set to baseline
    process.env.OPENROUTER_MODEL = "openrouter/auto";
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}
