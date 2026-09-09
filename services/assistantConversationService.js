const pool = require("../lib/db");


function normalizeAssistantText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}


function createConversationTitle(message) {
  const raw = normalizeAssistantText(message || "");

  if (!raw) {
    return "Loan Assistant";
  }

  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(
      /\b(loan|eligibility|check|company|info|details|help)\b/gi,
      ""
    )
    .trim();

  const title = cleaned || raw;

  return title.length > 30
    ? `${title.slice(0, 27).trim()}...`
    : title;
}


async function updateConversationTitle(
  conversationId,
  message
) {
  if (!conversationId) {
    return;
  }

  const current = await pool.query(
    `SELECT title
     FROM assistant_conversations
     WHERE id = $1`,
    [conversationId]
  );

  const currentTitle =
    current.rows[0]?.title || "";

  if (
    currentTitle &&
    !/^(new chat|loan assistant)$/i.test(
      currentTitle
    )
  ) {
    return;
  }

  const nextTitle =
    createConversationTitle(message);

  await pool.query(
    `UPDATE assistant_conversations
     SET title = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [
      nextTitle,
      conversationId
    ]
  );
}


async function createAssistantConversation(
  userId,
  title = "Loan Assistant"
) {
  const created = await pool.query(
    `INSERT INTO assistant_conversations (
      user_id,
      title,
      updated_at
    )
    VALUES ($1, $2, NOW())
    RETURNING
      id,
      user_id,
      title,
      created_at,
      updated_at`,
    [
      userId,
      title
    ]
  );

  return created.rows[0];
}


async function getAssistantConversationById(
  userId,
  conversationId
) {
  const existing = await pool.query(
    `SELECT
      id,
      user_id,
      title,
      created_at,
      updated_at
     FROM assistant_conversations
     WHERE id = $1
     AND user_id = $2`,
    [
      conversationId,
      userId
    ]
  );

  if (existing.rowCount === 0) {
    return null;
  }

  return existing.rows[0];
}


async function getOrCreateAssistantConversation(
  userId
) {
  const existing = await pool.query(
    `SELECT id
     FROM assistant_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  return createAssistantConversation(userId);
}


async function saveAssistantMessage(
  conversationId,
  role,
  content
) {
  const text =
    String(content || "").trim();

  if (!conversationId || !text) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO assistant_messages (
      conversation_id,
      role,
      content,
      created_at
    )
    VALUES ($1, $2, $3, NOW())
    RETURNING
      id,
      conversation_id,
      role,
      content,
      created_at`,
    [
      conversationId,
      role,
      text
    ]
  );

  if (role === "user") {
    await updateConversationTitle(
      conversationId,
      text
    );
  }

  await pool.query(
    `UPDATE assistant_conversations
     SET updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0];
}


/**
 * Get conversation state with selected company and supported banks info
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Full state or null
 */
async function getConversationStateWithCompanyInfo(pool, conversationId) {
  if (!pool || !conversationId) return null;
  try {
    const result = await pool.query(
      `SELECT state FROM assistant_conversation_states 
       WHERE conversation_id = $1 AND expires_at > NOW()`,
      [conversationId]
    );
    if (result.rowCount > 0 && result.rows[0].state) {
      return result.rows[0].state;
    }
  } catch (err) {
    console.warn("Failed to load conversation state:", err.message);
  }
  return null;
}

/**
 * Update conversation state with company selection results
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} conversationId - Conversation ID
 * @param {Object} companySelectionData - {selectedCompanyName, supportedBanks[]}
 * @returns {Promise<void>}
 */
async function updateCompanySelectionState(pool, conversationId, companySelectionData) {
  if (!pool || !conversationId) return;
  
  try {
    const currentState = await getConversationStateWithCompanyInfo(pool, conversationId) || {};
    
    const updatedState = {
      ...currentState,
      evaluationPhase: "data_collection",
      selectedCompanyName: companySelectionData.selectedCompanyName,
      supportedBanks: companySelectionData.supportedBanks || [],
      applicant: currentState.applicant || {
        companyName: companySelectionData.selectedCompanyName,
        employmentType: null,
        cibil: null,
        age: null,
        monthlyIncome: null,
        loanAmount: null,
        tenureMonths: null,
        existingEmi: null
      }
    };

    await pool.query(
      `INSERT INTO assistant_conversation_states 
       (conversation_id, state, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
       ON CONFLICT (conversation_id) 
       DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '30 minutes'`,
      [conversationId, updatedState]
    );
  } catch (err) {
    console.warn("Failed to update company selection state:", err.message);
  }
}

/**
 * Clear conversation state (e.g., when starting over)
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
async function clearConversationState(pool, conversationId) {
  if (!pool || !conversationId) return;
  try {
    await pool.query(
      `DELETE FROM assistant_conversation_states WHERE conversation_id = $1`,
      [conversationId]
    );
  } catch (err) {
    console.warn("Failed to clear conversation state:", err.message);
  }
}


module.exports = {
  createAssistantConversation,
  getAssistantConversationById,
  getOrCreateAssistantConversation,
  saveAssistantMessage,
  getConversationStateWithCompanyInfo,
  updateCompanySelectionState,
  clearConversationState,
  getConversationState: getConversationStateWithCompanyInfo,
  setConversationState: updateCompanySelectionState
};