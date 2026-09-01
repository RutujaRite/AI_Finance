
const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const pool = require("./db");
const { requireLogin} = require("./middleware/authMiddleware");
const initializeDatabase = require("./database/initializeDatabase");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const emiRoutes = require("./routes/emiRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const policyFileRoutes = require("./routes/policyFileRoutes");
const policyVersionRoutes = require("./routes/policyVersionRoutes");
const policyRoutes = require("./routes/policyRoutes");
const policyWriteRoutes = require("./routes/policyWriteRoutes");
const policyUploadRoutes = require("./routes/policyUploadRoutes");
const adminPolicyRoutes = require("./routes/adminPolicyRoutes");
const homeRoutes = require("./routes/homeRoutes");
const {
  fetchLiveCompanySummary
} = require("./services/companyResearchService");
const app = express();
const {
  evaluateApplicantAgainstPolicies,
  evaluateWithBankSpecificCategories,
  getActivePolicyRequirements,
  getApplicableMissingFields
} = require("./services/eligibilityService");
const {
  getAssistantConversationById,
  getOrCreateAssistantConversation,
  saveAssistantMessage
} = require("./services/assistantConversationService");
const {
  detectBankFromText,
  isPolicyQaIntent,
  isPersonalLoanEligibilityIntent,
  getMasterPolicyForBank,
  answerPolicyQuestion
} = require("./services/policyAssistantService");
const {
  normalizeAssistantText,
  getConversationState,
  setConversationState,
  clearConversationState,
  collectEligibilityField,
  getEligibilityQuestion,
  formatEligibilityResult,
  isLoanIntent,
  looksLikeCompanyQuery
} = require("./services/assistantFlowService");
const {
  getNextResolverQuestion,
  isResolverComplete,
  collectResolverField
} = require("./services/programCategoryResolver");

const PORT = 3000;

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));
app.use(express.static(path.join(__dirname, "public")));
app.use("/", authRoutes);
app.use("/", profileRoutes);
app.use("/", emiRoutes);
app.use("/", assistantRoutes);
app.use("/", policyFileRoutes);
app.use("/", policyVersionRoutes);
app.use("/", policyRoutes);
app.use("/", policyWriteRoutes);
app.use("/", policyUploadRoutes);
app.use("/", adminPolicyRoutes);
app.use("/", homeRoutes);

// Multer error handler
app.use(function (err, req, res, next) {
  if (err && err.name === 'MulterError') {
    console.error('Multer error:', err);
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function findCompanyMatches(searchText) {
  const keyword = normalizeAssistantText(searchText).replace(/[^a-zA-Z0-9\s]/g, ' ');
  const pattern = `%${keyword}%`;

  if (!keyword) {
    return [];
  }

  const result = await pool.query(
    `SELECT DISTINCT company_name, company_category, bank_name, other_info
     FROM company_records
     WHERE company_name ILIKE $1
        OR company_category ILIKE $1
        OR other_info ILIKE $1
     ORDER BY company_name ASC, bank_name ASC
     LIMIT 8`,
    [pattern]
  );

  return result.rows;
}

app.post("/api/assistant/handle", requireLogin, async (req, res) => {
  try {
    const body = req.body || {};
    const message = normalizeAssistantText(body.message || '');
    const requestedId = body.conversation_id ? Number(body.conversation_id) : null;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const conversation = requestedId
      ? await getAssistantConversationById(req.session.userId, requestedId)
      : await getOrCreateAssistantConversation(req.session.userId);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    await saveAssistantMessage(conversation.id, 'user', message);
    console.log('[DEBUG] user message saved');

    const greetingPattern = /^(hii|hi|hello|hey|good\s*(morning|afternoon|evening)|how\s*are\s*you|what'?s\s*up|sup)\b/i;
    const isGreeting = greetingPattern.test(message);
    console.log('[DEBUG] message=', JSON.stringify(message), 'isGreeting=', isGreeting);
    if (isGreeting) {
      console.log('[DEBUG] clearing conversation state for', conversation.id);
      await clearConversationState(pool, conversation.id);
      const greeting = 'Hi! How can I help you?';
      console.log('[DEBUG] saving assistant greeting');
      await saveAssistantMessage(conversation.id, 'assistant', greeting);
      console.log('[DEBUG] returning greeting response');
      return res.json({ success: true, type: 'greeting', response: greeting });
    }

    const state = await getConversationState(pool, conversation.id);
    const policyReqs = await getActivePolicyRequirements(pool, "Personal");

    if (state && state.flow === 'personal_loan_resolver' && state.applicant) {
      const updatedApplicant = collectResolverField(message, state.applicant, state.lastAskedField);
      const resolverComplete = isResolverComplete(updatedApplicant);

      if (!resolverComplete) {
        const nextField = getNextResolverQuestion(updatedApplicant);
        const nextQuestion = nextField ? nextField.label : "Could you please provide the required details?";
        await setConversationState(pool, conversation.id, { flow: 'personal_loan_resolver', applicant: updatedApplicant, lastAskedField: nextField ? nextField.key : null });
        await saveAssistantMessage(conversation.id, 'assistant', nextQuestion);
        return res.json({ success: true, type: 'resolver_flow', response: nextQuestion, state: { flow: 'personal_loan_resolver' } });
      }

      await setConversationState(pool, conversation.id, { flow: 'personal_loan_resolver_complete', applicant: updatedApplicant, lastAskedField: null });
      let evaluations = [];
      let response = "";
      try {
        evaluations = await evaluateWithBankSpecificCategories(pool, updatedApplicant);
        response = formatEligibilityResult(updatedApplicant, evaluations);
      } catch (err) {
        console.error("Evaluation failed:", err);
        response = "Evaluation could not be completed due to a system error. Please try again later or contact support.";
        evaluations = [];
      }
      await saveAssistantMessage(conversation.id, 'assistant', response);
      return res.json({ success: true, type: 'eligibility_result', response, evaluations });
    }

    if (isPolicyQaIntent(message)) {
      const bankInfo = detectBankFromText(message);
      if (!bankInfo) {
        const response = 'I can help you with policy information. Please specify which bank you are asking about (for example: ABFL, Axis Bank, HDFC, ICICI, etc.).';
        await saveAssistantMessage(conversation.id, 'assistant', response);
        return res.json({ success: true, type: 'policy_qa', response });
      }

      const bankRes = await pool.query("SELECT id FROM banks WHERE LOWER(name) = LOWER($1) OR code = $2", [bankInfo.name, bankInfo.code]);
      if (bankRes.rowCount === 0) {
        const response = `I don't have policy information for ${bankInfo.name} in the system yet.`;
        await saveAssistantMessage(conversation.id, 'assistant', response);
        return res.json({ success: true, type: 'policy_qa', response });
      }

      const bankId = bankRes.rows[0].id;
      const masterPolicy = await getMasterPolicyForBank(pool, bankId);
      if (!masterPolicy) {
        const response = `I don't have a master policy document for ${bankInfo.name} yet. Please contact the bank directly for policy details.`;
        await saveAssistantMessage(conversation.id, 'assistant', response);
        return res.json({ success: true, type: 'policy_qa', response });
      }

      const answer = await answerPolicyQuestion( pool, bankInfo, message);
      await saveAssistantMessage(conversation.id, 'assistant', answer);
      return res.json({ success: true, type: 'policy_qa', response: answer, bank: bankInfo.name });
    }

    if (isPersonalLoanEligibilityIntent(message) || isLoanIntent(message)) {
      const initialApplicant = collectEligibilityField(message, {
        customerName: req.session.userName || "Applicant",
        monthlyIncome: null,
        existingEmi: null,
        loanAmount: null,
        tenureMonths: null,
        cibil: null,
        age: null,
        employmentType: "",
        companyName: "",
        location: ""
      });

      const firstResolverQuestion = getNextResolverQuestion(initialApplicant);
      if (firstResolverQuestion) {
        await setConversationState(pool, conversation.id, { flow: 'personal_loan_resolver', applicant: initialApplicant, lastAskedField: firstResolverQuestion.key });
        await saveAssistantMessage(conversation.id, 'assistant', firstResolverQuestion.label);
        return res.json({ success: true, type: 'resolver_flow', response: firstResolverQuestion.label, state: { flow: 'personal_loan_resolver' } });
      }

      await setConversationState(pool, conversation.id, { flow: 'personal_loan_resolver_complete', applicant: initialApplicant, lastAskedField: null });
      let evaluations = [];
      let response = "";
      try {
        evaluations = await evaluateWithBankSpecificCategories(pool, initialApplicant);
        response = formatEligibilityResult(initialApplicant, evaluations);
      } catch (err) {
        console.error("Evaluation failed:", err);
        response = "Evaluation could not be completed due to a system error. Please try again later or contact support.";
        evaluations = [];
      }
      await saveAssistantMessage(conversation.id, 'assistant', response);
      return res.json({ success: true, type: 'eligibility_result', response, evaluations });
    }

    if (!looksLikeCompanyQuery(message)) {
      const fallback = 'I can help you with personal loan eligibility checks, bank policy details, or company information. Just let me know what you need.';
      await saveAssistantMessage(conversation.id, 'assistant', fallback);
      return res.json({ success: true, type: 'fallback', response: fallback });
    }

   console.log('[ASSISTANT_HANDLE] message=' + message + ' type=company');
    const matches = await findCompanyMatches(message);
    console.log('[ASSISTANT_HANDLE] db_matches=' + matches.length);
    const liveInfo = await fetchLiveCompanySummary(message);
    console.log('[ASSISTANT_HANDLE] liveInfo_len=' + (liveInfo || '').length);

    let responseText = 'No detailed company information was found in the live search results.';
    if (liveInfo) {
      responseText = liveInfo;
    } else if (matches.length > 0) {
      responseText = 'I found matching company records in the database, but the live web search did not return additional public profile details.';
    }

    await saveAssistantMessage(conversation.id, 'assistant', responseText);
    res.json({
      success: true,
      type: 'company',
      response: responseText,
      details: responseText,
      matches,
      liveInfo
    });
  } catch (error) {
    console.error('Assistant handle failed:', error);
    console.error(error.stack);
    res.status(500).json({ success: false, message: 'Unable to process your request.' });
  }
});
initializeDatabase()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log("");
      console.log("======================================");
      console.log(" Login Page is running successfully!");
      console.log(" Open: http://localhost:3000");
      console.log(" Database: PostgreSQL");
      console.log("======================================");
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });
