// lib/openrouter.js
/**
 * OpenRouter (LLM) integration for AI-powered conversations.
 * Replaces ai_agent.py functionality in Python
 */

const { OpenAI } = require('openai');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const openRouterClient = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

/**
 * OpenRouter chat completion with tool support
 */
async function openRouterChat(
  messages,
  tools,
  model
) {
  try {
    const response = await openRouterClient.chat.completions.create({
      model: model || OPENROUTER_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    });

    return response;
  } catch (error) {
    console.error('OpenRouter API error:', error);
    throw new Error(`OpenRouter chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process user message with system prompt and bank manager tools
 */
async function processUserMessage(
  userMessage,
  conversationHistory
) {
  if (conversationHistory === undefined) {
    conversationHistory = [];
  }
  
  const systemPrompt = `You are a banking and loan assistant for InCraax AI.

You have access to an internal bank manager database through the search_bank_manager tool.

When the user asks about:
- bank manager
- branch manager  
- manager contact
- manager mobile number
- manager email
- manager in a specific city
- manager in a specific branch
- any bank contact details

Use the search_bank_manager tool to find real data.

Never invent manager information.

If the database does not contain the requested manager,
clearly tell the user that no matching record was found.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Import BANK_MANAGER_TOOLS at the point of use to avoid circular dependencies
  try {
    const { BANK_MANAGER_TOOLS } = require('./bankSearch');
    const response = await openRouterChat(messages, BANK_MANAGER_TOOLS);
    
    const assistantMessage = response.choices[0].message;
    
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length) {
      const toolResults = await handleToolCalls(assistantMessage.tool_calls);
      return await processToolResults(toolResults, [...messages, assistantMessage]);
    }

    return assistantMessage.content || "I don't have information about that. Could you please ask something else?";
  } catch (error) {
    console.error('Failed to import bankSearch:', error);
    return "I'm experiencing technical difficulties. Please try again later.";
  }
}

/**
 * Handle bank manager tool calls
 */
async function handleToolCalls(toolCalls) {
  const results = [];
  
  for (const toolCall of toolCalls) {
    if (toolCall.function.name === 'search_bank_manager') {
      try {
        const { searchBankManager } = require('./bankSearch');
        const args = JSON.parse(toolCall.function.arguments || '{}');
        const result = await searchBankManager(args);
        results.push({
          tool_call_id: toolCall.id,
          tool_name: toolCall.function.name,
          content: JSON.stringify(result, (key, value) => value),
        });
      } catch (error) {
        console.error('Error in handleToolCalls:', error);
      }
    }
  }
  
  return results;
}

/**
 * Process tool results and continue conversation
 */
async function processToolResults(toolResults, messages) {
  const messagesWithTools = [
    ...messages,
    {
      role: 'assistant',
      content: null,
      tool_calls: messages[messages.length - 1].tool_calls,
    },
    ...toolResults.map(result => ({
      role: 'tool',
      tool_call_id: result.tool_call_id,
      content: result.content,
    })),
  ];

  try {
    const response = await openRouterChat(messagesWithTools);
    return response.choices[0].message.content || "I encountered an issue processing your request.";
  } catch (error) {
    console.error('Error in processToolResults:', error);
    return "I'm experiencing technical difficulties. Please try again later.";
  }
}

module.exports = {
  openRouterChat,
  processUserMessage,
  handleToolCalls,
  processToolResults,
  OpenRouterTool: {},
  OpenRouterMessage: {},
  OpenRouterResponse: {},
};
