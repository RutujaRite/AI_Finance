const fs = require('fs');

console.log('=== GREETING TEST ===');

// Simulate greeting processing
const message = "good evening";
const lower = message.toLowerCase();

const greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy", "hola"];
const isGreeting = greetings.some(g => lower.includes(g)) && message.trim().length <= 10;

console.log('Input message:', message);
console.log('Is greeting:', isGreeting);

if (isGreeting) {
  const reply = "Hello! I'm your AI assistant. Ask me anything about EMI calculations, loans, bank managers, or company records.";
  console.log('Greeting response:', reply);
}

// Simulate the conversation data structure
const conversationData = {
  message: message,
  conversation_id: "test123",
  ai_message: {
    id: 'uid_123',
    role: 'ai',
    content: isGreeting ? "Hello! I'm your AI assistant. Ask me anything about EMI calculations, loans, bank managers, or company records." : "Default message",
    timestamp: new Date().toISOString(),
    company_data: null,
    company_query: null,
    bank_data: null
  },
  user_message: {
    id: 'uid_456',
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  }
};

console.log('\n=== SIMULATED CONVERSATION DATA ===');
console.log(JSON.stringify(conversationData, null, 2));
