const express = require("express");

const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");
const {
  evaluateApplicantAgainstPolicies,
  evaluateWithBankSpecificCategories
} = require("../services/eligibilityService");

const {
  fetchLiveCompanySummary
} = require("../services/companyResearchService");

const {
  createAssistantConversation,
  getAssistantConversationById,
  getOrCreateAssistantConversation,
  saveAssistantMessage
} = require("../services/assistantConversationService");

const router = express.Router();


// ========================================
// ASSISTANT HISTORY
// ========================================

router.get("/api/assistant/history", requireLogin, async (req, res) => {
  try {
    const requestedId = req.query.conversation_id
      ? Number(req.query.conversation_id)
      : null;

    const conversation = requestedId
      ? await getAssistantConversationById(
          req.session.userId,
          requestedId
        )
      : await getOrCreateAssistantConversation(
          req.session.userId
        );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    const rows = await pool.query(
      `SELECT
        role,
        content,
        created_at
       FROM assistant_messages
       WHERE conversation_id = $1
       ORDER BY id ASC`,
      [conversation.id]
    );

    return res.json({
      success: true,
      conversationId: conversation.id,
      title: conversation.title || "Loan Assistant",
      messages: rows.rows.map((row) => ({
        role: row.role,
        content: row.content,
        created_at: row.created_at
      }))
    });

  } catch (error) {
    console.error(
      "Unable to load assistant history:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load assistant history."
    });
  }
});


// ========================================
// NEW CONVERSATION
// ========================================

router.post(
  "/api/assistant/conversations/new",
  requireLogin,
  async (req, res) => {
    try {
      const conversation =
        await createAssistantConversation(
          req.session.userId,
          "New Chat"
        );

      return res.json({
        success: true,
        conversationId: conversation.id,
        title: conversation.title || "New Chat"
      });

    } catch (error) {
      console.error(
        "Unable to create assistant conversation:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to create a new conversation."
      });
    }
  }
);


// ========================================
// RECENT CONVERSATIONS
// ========================================

router.get(
  "/api/assistant/conversations",
  requireLogin,
  async (req, res) => {
    try {
      const rows = await pool.query(
        `SELECT
          ac.id,
          ac.title,
          ac.updated_at
         FROM assistant_conversations ac
         WHERE ac.user_id = $1
           AND EXISTS (
             SELECT 1
             FROM assistant_messages am
             WHERE am.conversation_id = ac.id
           )
         ORDER BY ac.updated_at DESC
         LIMIT 8`,
        [req.session.userId]
      );

      return res.json({
        success: true,

        conversations: rows.rows.map((row) => ({
          id: row.id,
          title: row.title || "Loan Assistant",
          updated_at: row.updated_at
        }))
      });

    } catch (error) {
      console.error(
        "Unable to load assistant conversations:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load recent conversations."
      });
    }
  }
);


// ========================================
// SAVE ASSISTANT MESSAGE
// ========================================

router.post(
  "/api/assistant/message",
  requireLogin,
  async (req, res) => {
    try {
      const body = req.body || {};

      const role =
        String(body.role || "user").toLowerCase();

      const content =
        String(body.content || "").trim();

      const requestedId =
        body.conversation_id
          ? Number(body.conversation_id)
          : null;

      if (
        !["user", "assistant"].includes(role) ||
        !content
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid message is required."
        });
      }

      const conversation = requestedId
        ? await getAssistantConversationById(
            req.session.userId,
            requestedId
          )
        : await getOrCreateAssistantConversation(
            req.session.userId
          );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found."
        });
      }

      const saved =
        await saveAssistantMessage(
          conversation.id,
          role,
          content
        );

      return res.json({
        success: true,
        message: saved,
        conversationId: conversation.id
      });

    } catch (error) {
      console.error(
        "Unable to save assistant message:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to save assistant message."
      });
    }
  }
);
router.post("/api/assistant/evaluate", requireLogin, async (req, res) => {
  try {
    const body = req.body || {};

    const customerName = String(
      body.customer_name || req.session.userName || "Customer"
    ).trim();

    const loanType = String(body.loan_type || "Personal").trim();
    const companyName = String(body.company_name || "").trim();

    const monthlyIncome = Number(body.monthly_income || 0);
    const existingEmi = Number(body.existing_emi || 0);
    const loanAmount = Number(body.loan_amount || 0);
    const tenureMonths = Number(body.tenure_months || 0);

    const cibil =
      body.cibil != null && body.cibil !== ""
        ? Number(body.cibil)
        : null;

    const age =
      body.age != null && body.age !== ""
        ? Number(body.age)
        : null;

    const employmentType =
      String(body.employment_type || "").trim();

    const location =
      String(body.location || "").trim();

    const pincode =
      String(body.pincode || "").trim();

    const requiresLiveInfo =
      /^(yes|y|true)$/i.test(
        String(body.live_web_info || "")
      );

    const debtRatio =
      monthlyIncome > 0
        ? (existingEmi / monthlyIncome) * 100
        : 0;

    const applicant = {
      cibil,
      age,
      employmentType,
      monthlyIncome,
      existingEmi,
      loanAmount,
      tenureMonths,
      location,
      pincode,
      companyName
    };

    // Use bank-specific category resolution
    const allEvaluations =
      await evaluateWithBankSpecificCategories(
        pool,
        applicant
      );

    // Filter to show only ELIGIBLE banks by default
    const eligibleEvaluations = allEvaluations.filter(
      e => e.status === "ELIGIBLE"
    );

    const summaryParts = [
      `${customerName} requested a ${loanType} loan of ₹${loanAmount.toLocaleString("en-IN")} from ${companyName || "an unspecified employer"}.`,
      `Monthly income ₹${monthlyIncome.toLocaleString("en-IN")}, existing EMI ₹${existingEmi.toLocaleString("en-IN")} (debt ${debtRatio.toFixed(1)}% of income).`
    ];

    if (eligibleEvaluations.length > 0) {
      summaryParts.push(
        `✓ ${eligibleEvaluations.length} bank(s) found you ELIGIBLE for a Personal Loan.`
      );
    } else if (allEvaluations.length > 0) {
      const reviewCount = allEvaluations.filter(e => e.status === "NEEDS_REVIEW").length;
      const notEligibleCount = allEvaluations.filter(e => e.status === "NOT_ELIGIBLE").length;
      if (reviewCount > 0) {
        summaryParts.push(
          `⚠ ${reviewCount} bank(s) require further review. ${notEligibleCount} bank(s) found you not eligible.`
        );
      } else {
        summaryParts.push(
          `✗ Unfortunately, you are not eligible with any active banks based on current policies.`
        );
      }
    } else {
      summaryParts.push(
        "No suitable active loan policy was found for the information provided."
      );
    }

    let liveInfo = "";

    if (requiresLiveInfo) {
      try {
        liveInfo =
          await fetchLiveCompanySummary(
            companyName || "company"
          );
      } catch {
        liveInfo =
          "Live web lookup was requested, but the external site was not reachable at this moment.";
      }
    }

    res.json({
      success: true,
      customer: customerName,
      summary: summaryParts.join(" "),
      evaluations: eligibleEvaluations,
      all_evaluations: allEvaluations,
      evaluation_stats: {
        eligible: eligibleEvaluations.length,
        needs_review: allEvaluations.filter(e => e.status === "NEEDS_REVIEW").length,
        not_eligible: allEvaluations.filter(e => e.status === "NOT_ELIGIBLE").length,
        total: allEvaluations.length
      },
      liveInfo
    });

  } catch (error) {
    console.error(
      "AI assistant evaluation failed:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to evaluate eligibility at the moment."
    });
  }
});


module.exports = router;