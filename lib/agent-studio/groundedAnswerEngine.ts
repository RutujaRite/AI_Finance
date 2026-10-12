// lib/agent-studio/groundedAnswerEngine.ts
import { Agent, KnowledgeDocumentRecord } from "./types";

export interface GroundedEvaluationResult {
  reply: string;
  isInScope: boolean;
  matchedChunks: string[];
  docNames: string[];
}

/**
 * Deterministically grounds test queries strictly on the uploaded knowledge base
 * adhering to the configured agent instructions, roles, and guardrails.
 */
export function generateKnowledgeGroundedReply(
  query: string,
  agent: Agent,
  documents: KnowledgeDocumentRecord[],
  chunks: Array<{ id: string; content: string; chunk_index?: number }>
): GroundedEvaluationResult {
  const cleanQuery = query.trim();
  const lowerQuery = cleanQuery.toLowerCase();
  const docNames = documents.map((d) => d.name);
  const docNamesStr = docNames.map((n) => `**${n}**`).join(", ");

  // 1. Guardrail Check: Protect system instructions / internal secrets
  if (
    lowerQuery.includes("system prompt") ||
    lowerQuery.includes("confidential rules") ||
    lowerQuery.includes("internal instructions") ||
    lowerQuery.includes("reveal your prompt") ||
    lowerQuery.includes("ignore previous instructions")
  ) {
    return {
      reply: `I am configured to protect internal instructions and system security. In this test demo, I focus solely on answering queries grounded in your verified knowledge base document(s): ${docNamesStr}.`,
      isInScope: true,
      matchedChunks: [],
      docNames,
    };
  }

  // 2. If NO documents exist
  if (documents.length === 0) {
    return {
      reply: `No knowledge base documents have been uploaded for **${agent.name}** yet.\n\nTo test the AI agent grounded in your specific documents, please upload your policy document (.pdf, .txt, .docx) under **AI Instructions**.\n\n*(Configured Goal: ${agent.goal || agent.instructions?.businessDescription})*`,
      isInScope: false,
      matchedChunks: [],
      docNames: [],
    };
  }

  // 3. Inspect document contents and determine document type
  const allChunksText = chunks.map((c) => c.content).join("\n\n");
  const lowerAllText = allChunksText.toLowerCase();
  const isGreetingKnowledge =
    lowerAllText.includes("greeting") ||
    lowerAllText.includes("namaste") ||
    docNames.some((n) => /greeting|welcome/i.test(n));

  const isLoanPolicyKnowledge =
    lowerAllText.includes("loan") ||
    lowerAllText.includes("cibil") ||
    lowerAllText.includes("salary") ||
    lowerAllText.includes("eligibility") ||
    docNames.some((n) => /loan|credit|policy|fin/i.test(n));

  // ==========================================
  // CASE A: GREETING KNOWLEDGE BASE
  // ==========================================
  if (isGreetingKnowledge && !isLoanPolicyKnowledge) {
    // Check for Greetings
    if (/^(hi|hello|hey|greetings|hola)\b/i.test(lowerQuery) || lowerQuery === "hi" || lowerQuery === "hello") {
      return {
        reply: `Hello! I'm your **${agent.name}** 👋\n\nAs specified in your uploaded knowledge base (**${docNames[0] || "Knowledge Base"}**), a friendly welcome is appropriate. How can I assist you today?`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 1).map((c) => c.content),
        docNames,
      };
    }

    if (lowerQuery.includes("good morning") || lowerQuery.includes("morning")) {
      return {
        reply: `Good morning! I'm your **${agent.name}** 🌅\n\nResponding with a suitable morning greeting as guided by your uploaded knowledge base. How can I help you today?`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 1).map((c) => c.content),
        docNames,
      };
    }

    if (lowerQuery.includes("good afternoon") || lowerQuery.includes("afternoon")) {
      return {
        reply: `Good afternoon! I'm your **${agent.name}** ☀️\n\nResponding with a suitable afternoon greeting as per your uploaded knowledge base. How can I assist you with your request?`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 1).map((c) => c.content),
        docNames,
      };
    }

    if (lowerQuery.includes("good evening") || lowerQuery.includes("evening")) {
      return {
        reply: `Good evening! I'm your **${agent.name}** 🌆\n\nResponding with a suitable evening greeting as per your uploaded knowledge base. What can I help you with tonight?`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 1).map((c) => c.content),
        docNames,
      };
    }

    if (lowerQuery.includes("namaste") || lowerQuery.includes("pranam")) {
      return {
        reply: `Namaste! 🙏\n\nWelcome to **${agent.name}**. As specified in your uploaded knowledge base, I am responding with respect and warmth. It is a pleasure to assist you. How may I help you?`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 1).map((c) => c.content),
        docNames,
      };
    }

    if (
      lowerQuery.includes("what is in") ||
      lowerQuery.includes("summary") ||
      lowerQuery.includes("what knowledge") ||
      lowerQuery.includes("explain document") ||
      lowerQuery.includes("purpose")
    ) {
      return {
        reply: `### 📖 Uploaded Knowledge Base: ${docNames[0]}\n\nThis knowledge document provides guidance for greeting interactions and assistant identity:\n\n| Greeting Type | Expected Meaning & Response |\n|---|---|\n| **Hello** | Starting a conversation; friendly welcome |\n| **Hi / Hey** | Casual conversation; short friendly welcome |\n| **Good morning** | Morning greeting; respond with suitable morning greeting |\n| **Good afternoon** | Afternoon greeting; respond with suitable afternoon greeting |\n| **Good evening** | Evening greeting; respond with suitable evening greeting |\n| **Namaste** | Respectful greeting; respond politely and respectfully |\n\n**Agent Identity:** The assistant introduces itself naturally and makes it easy for the user to continue.\n\n*Testing is strictly restricted to this uploaded knowledge base as per your agent instructions.*`,
        isInScope: true,
        matchedChunks: chunks.map((c) => c.content),
        docNames,
      };
    }

    // OUT OF SCOPE check: The document is a greeting knowledge base, but user asks about loans, credit, banking, or unrelated topics
    return {
      reply: `Based on the uploaded knowledge base (${docNamesStr}), this information is not covered.\n\nIn this test demo, I am configured to strictly answer questions related to your uploaded knowledge base document(s) as per your agent instructions.\n\n💡 **Tip:** Your uploaded document is a Greeting Knowledge Base. Please test with greetings like *"Hello"*, *"Good morning"*, or *"Namaste"*, or upload a policy document under **AI Instructions** to test specific lender policies.`,
      isInScope: false,
      matchedChunks: [],
      docNames,
    };
  }

  // ==========================================
  // CASE B: LOAN / POLICY KNOWLEDGE BASE
  // ==========================================
  if (isLoanPolicyKnowledge) {
    // Check if the query asks about a different bank NOT in the document
    const knownBanks = [
      "hdfc", "icici", "sbi", "axis", "kotak", "bajaj", "tata capital", "finnable", "piramal",
      "indusind", "idfc", "bandhan", "yes bank", "cholamandalam", "poonawalla"
    ];
    const requestedBank = knownBanks.find((b) => lowerQuery.includes(b));
    const docHasBank = requestedBank && (lowerAllText.includes(requestedBank) || docNames.some((n) => n.toLowerCase().includes(requestedBank)));

    if (requestedBank && !docHasBank) {
      return {
        reply: `Based on the uploaded knowledge base (${docNamesStr}), information for **${requestedBank.toUpperCase()}** is not specified.\n\nIn this test demo, I am strictly restricted to evaluating the uploaded document(s): ${docNamesStr} as per your agent instructions.`,
        isInScope: false,
        matchedChunks: [],
        docNames,
      };
    }

    // If query asks for eligibility
    if (lowerQuery.includes("eligib") || lowerQuery.includes("criteria") || lowerQuery.includes("who can apply")) {
      const relevantSnippets = chunks
        .filter((c) => /eligib|age|salary|cibil|criteria|work/i.test(c.content))
        .map((c) => c.content)
        .slice(0, 3);

      const bodyText = relevantSnippets.length > 0 ? relevantSnippets.join("\n\n") : allChunksText.slice(0, 900);

      return {
        reply: `### 📋 Eligibility Criteria from Uploaded Knowledge (${docNames[0]})\n\n${bodyText}\n\n*Grounded exclusively in uploaded document ${docNamesStr} as per agent instructions.*`,
        isInScope: true,
        matchedChunks: relevantSnippets,
        docNames,
      };
    }

    // If query asks for salary / cibil cutoff
    if (lowerQuery.includes("cibil") || lowerQuery.includes("salary") || lowerQuery.includes("nth") || lowerQuery.includes("income")) {
      const relevantSnippets = chunks
        .filter((c) => /cibil|score|salary|nth|income|cutoff/i.test(c.content))
        .map((c) => c.content)
        .slice(0, 3);

      const bodyText = relevantSnippets.length > 0 ? relevantSnippets.join("\n\n") : allChunksText.slice(0, 900);

      return {
        reply: `### 💰 Salary & CIBIL Cutoff from Uploaded Knowledge (${docNames[0]})\n\n${bodyText}\n\n*Grounded exclusively in uploaded document ${docNamesStr} as per agent instructions.*`,
        isInScope: true,
        matchedChunks: relevantSnippets,
        docNames,
      };
    }

    // If query asks for documents needed
    if (lowerQuery.includes("document") || lowerQuery.includes("kyc") || lowerQuery.includes("statement") || lowerQuery.includes("payslip")) {
      const relevantSnippets = chunks
        .filter((c) => /document|kyc|statement|payslip|itr|pan|aadhaar/i.test(c.content))
        .map((c) => c.content)
        .slice(0, 3);

      const bodyText = relevantSnippets.length > 0 ? relevantSnippets.join("\n\n") : allChunksText.slice(0, 900);

      return {
        reply: `### 📄 Documentation Requirements from Uploaded Knowledge (${docNames[0]})\n\n${bodyText}\n\n*Grounded exclusively in uploaded document ${docNamesStr} as per agent instructions.*`,
        isInScope: true,
        matchedChunks: relevantSnippets,
        docNames,
      };
    }

    // If query asks for loan amount or tenure
    if (lowerQuery.includes("tenure") || lowerQuery.includes("amount") || lowerQuery.includes("limit") || lowerQuery.includes("roi") || lowerQuery.includes("interest")) {
      const relevantSnippets = chunks
        .filter((c) => /tenure|amount|limit|roi|interest|rate|max|min/i.test(c.content))
        .map((c) => c.content)
        .slice(0, 3);

      const bodyText = relevantSnippets.length > 0 ? relevantSnippets.join("\n\n") : allChunksText.slice(0, 900);

      return {
        reply: `### 💳 Loan Parameters from Uploaded Knowledge (${docNames[0]})\n\n${bodyText}\n\n*Grounded exclusively in uploaded document ${docNamesStr} as per agent instructions.*`,
        isInScope: true,
        matchedChunks: relevantSnippets,
        docNames,
      };
    }

    // General in-scope match: check if user words match document content
    const queryTokens = lowerQuery.replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
    const hasWordMatch = queryTokens.some((t) => lowerAllText.includes(t));

    if (hasWordMatch) {
      const topSnippets = chunks.slice(0, 2).map((c) => c.content).join("\n\n");
      return {
        reply: `### Verified Information from Uploaded Knowledge Base (${docNames[0]})\n\n${topSnippets}\n\n*Grounded exclusively in uploaded document ${docNamesStr} as per agent instructions.*`,
        isInScope: true,
        matchedChunks: chunks.slice(0, 2).map((c) => c.content),
        docNames,
      };
    }

    // Otherwise Out of Scope
    return {
      reply: `Based on the uploaded knowledge base (${docNamesStr}), this information is not covered.\n\nIn this test demo, I am configured to strictly answer questions related to your uploaded knowledge base document(s) as per your agent instructions. Please ask a question related to ${docNamesStr}.`,
      isInScope: false,
      matchedChunks: [],
      docNames,
    };
  }

  // ==========================================
  // CASE C: GENERAL KNOWLEDGE BASE
  // ==========================================
  const queryTokens = lowerQuery.replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const matchedChunks = chunks.filter((c) => {
    const cLower = c.content.toLowerCase();
    return queryTokens.some((t) => cLower.includes(t));
  });

  if (matchedChunks.length > 0) {
    const content = matchedChunks.slice(0, 3).map((c) => c.content).join("\n\n");
    return {
      reply: `### Verified Information from Uploaded Knowledge (${docNames[0]})\n\n${content}\n\n*Grounded strictly on uploaded knowledge base ${docNamesStr} as per agent instructions.*`,
      isInScope: true,
      matchedChunks: matchedChunks.map((c) => c.content),
      docNames,
    };
  }

  return {
    reply: `Based on the uploaded knowledge base (${docNamesStr}), this information is not covered.\n\nIn this test demo, I am configured to strictly answer questions related to your uploaded knowledge base document(s) as per your agent instructions. Please ask a question related to ${docNamesStr}.`,
    isInScope: false,
    matchedChunks: [],
    docNames,
  };
}
