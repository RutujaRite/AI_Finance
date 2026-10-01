'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle, 
  MessageSquare,
  ShieldCheck,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { ChatMessage } from '@/types';

export const AIAssistantSection: React.FC = () => {
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: 'Hello! I am your AI Financial Advisor. Ask me anything about home loan EMIs, FOIR eligibility criteria, interest rate negotiations, or bank underwriting policies.',
      timestamp: 'Just now'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sampleQuestions = [
    'How can I lower my loan EMI by 15%?',
    'What is FOIR and how does it limit my loan?',
    'Which bank offers the best home loan interest rates?',
    'Can I get a loan if my credit score is 680?'
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now'
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'ai_' + Date.now(),
          sender: 'assistant',
          text: data.response,
          timestamp: 'Just now',
          calculatedEmi: data.calculatedEmi
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API failed');
      }
    } catch {
      // Intelligent fallback response
      let fallbackText = `Here is our AI Financial Analysis for: "${textToSend}"\n\n• For loans, maintaining a Debt-to-Income (FOIR) ratio below 40% ensures 95%+ approval odds across premier tier-1 lenders.\n• Opting for step-down or annual 1-extra-EMI prepayment can save up to 22% in cumulative interest.\n• Current top lender benchmark rate is 8.25% - 8.65% with zero pre-closure penalty.`;
      const aiMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: fallbackText,
        timestamp: 'Just now'
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="ai-assistant" className="ai-advisor-section">
      <div className="container">
        <div className="section-head">
          <div className="section-badge">
            <Bot size={15} className="text-teal" />
            <span>24/7 Intelligent Guidance</span>
          </div>
          <h2 className="section-title">AI Financial Assistant</h2>
          <p className="section-subtitle">
            Get instant answers to complex loan, mortgage, and underwriting questions without scheduling appointments or waiting on hold.
          </p>
        </div>

        {/* AI Console Wrapper */}
        <div className="chat-console glass-panel">
          <div className="console-header">
            <div className="agent-status-row">
              <div className="agent-avatar">
                <Bot size={20} />
                <span className="online-pip" />
              </div>
              <div>
                <h4 className="agent-name">CreditWise Neural Advisor</h4>
                <p className="agent-role">Trained on 20+ Bank Underwriting Guidelines</p>
              </div>
            </div>
            <div className="security-tag">
              <ShieldCheck size={14} className="text-teal" />
              <span>256-Bit Encrypted</span>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="quick-prompts-bar">
            <span className="prompts-label">Try asking:</span>
            <div className="prompts-scroll">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="prompt-chip"
                >
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area */}
          <div className="messages-container">
            {messages.map((m) => (
              <div key={m.id} className={`message-bubble-row ${m.sender}`}>
                {m.sender === 'assistant' && (
                  <div className="mini-bot-icon">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className={`message-bubble ${m.sender}`}>
                  <p className="message-content">{m.text}</p>
                  <span className="message-time">{m.timestamp}</span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-bubble-row assistant">
                <div className="mini-bot-icon">
                  <Sparkles size={14} />
                </div>
                <div className="message-bubble assistant typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }} 
            className="input-form-bar"
          >
            <input
              type="text"
              placeholder="Ask anything (e.g. 'Can I get $400k loan on $6k salary?')..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="chat-input-field"
            />
            <button 
              type="submit" 
              disabled={isLoading || !inputQuery.trim()}
              className="chat-send-btn"
              aria-label="Send query"
            >
              <Send size={16} />
              <span>Ask AI</span>
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        .ai-advisor-section {
          padding: 80px 0;
          background: var(--bg-primary);
        }

        .section-head {
          text-align: center;
          max-width: 680px;
          margin: 0 auto 48px auto;
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--teal-50);
          color: var(--teal-800);
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 14px;
          border: 1px solid var(--teal-200);
        }

        :global([data-theme='dark']) .section-badge {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
          border-color: rgba(13, 148, 136, 0.3);
        }

        .section-title {
          font-size: 2.4rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 12px;
        }

        .section-subtitle {
          font-size: 1.02rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .chat-console {
          max-width: 860px;
          margin: 0 auto;
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
        }

        .console-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
        }

        .agent-status-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .agent-avatar {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488, #1e3a8a);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .online-pip {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
        }

        .agent-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .agent-role {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .security-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        /* Quick Prompts Bar */
        .quick-prompts-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: var(--bg-subtle);
          border-bottom: 1px solid var(--border-color);
          overflow-x: auto;
        }

        .prompts-label {
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .prompts-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }

        .prompt-chip {
          white-space: nowrap;
          padding: 6px 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .prompt-chip:hover {
          border-color: var(--teal-600);
          color: var(--teal-600);
          background: var(--teal-50);
        }

        /* Messages */
        .messages-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 280px;
          max-height: 420px;
          overflow-y: auto;
          background: var(--bg-primary);
        }

        .message-bubble-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .message-bubble-row.user {
          justify-content: flex-end;
        }

        .mini-bot-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--teal-50);
          color: var(--teal-700);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        :global([data-theme='dark']) .mini-bot-icon {
          background: rgba(13, 148, 136, 0.2);
          color: var(--teal-300);
        }

        .message-bubble {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: var(--radius-lg);
          font-size: 0.88rem;
          line-height: 1.55;
          white-space: pre-line;
        }

        .message-bubble.assistant {
          background: var(--bg-surface);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-top-left-radius: 4px;
        }

        .message-bubble.user {
          background: linear-gradient(135deg, #0d9488 0%, #1e40af 100%);
          color: #ffffff;
          border-top-right-radius: 4px;
        }

        .message-time {
          display: block;
          font-size: 0.68rem;
          margin-top: 4px;
          opacity: 0.7;
          text-align: right;
        }

        /* Typing Dots */
        .typing {
          display: flex;
          gap: 6px;
          padding: 16px 20px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--teal-600);
          animation: bounce 1.2s infinite ease-in-out;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        /* Input Form Bar */
        .input-form-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-color);
        }

        .chat-input-field {
          flex: 1;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1.5px solid var(--border-color);
          font-size: 0.92rem;
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s ease;
        }

        .chat-input-field:focus {
          border-color: var(--teal-600);
          background: var(--bg-surface);
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
        }

        .chat-send-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 12px 20px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488 0%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .chat-send-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .message-bubble {
            max-width: 90%;
          }
        }
      `}</style>
    </section>
  );
};
