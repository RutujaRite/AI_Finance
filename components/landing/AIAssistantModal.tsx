'use client';

import React, { useState } from 'react';
import { X, Bot, Send, Sparkles, User as UserIcon, RefreshCw, Calculator, FileCheck, CheckCircle } from 'lucide-react';
import { ChatMessage } from '@/types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: "Hello! I am your AI Underwriting & Loan Assistant. Ask me anything about loan eligibility, FOIR multipliers, interest rates for 20+ banks, or search for bank managers in your city.",
      timestamp: 'Just now'
    }
  ]);
  const [inputVal, setInputVal] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);

  // Sync initialPrompt if changed
  React.useEffect(() => {
    if (initialPrompt) {
      setInputVal(initialPrompt);
    }
  }, [initialPrompt]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputVal;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: data.response || "I couldn't process that query. Please try another.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        calculatedEmi: data.calculatedEmi
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: 'ai_err_' + Date.now(),
          sender: 'assistant',
          text: 'Unable to reach the assistant server. Please check your connection.',
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-chat-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-header">
          <div className="header-info">
            <div className="ai-status-circle">
              <Bot size={20} />
            </div>
            <div>
              <div className="header-title-row">
                <h3 className="chat-title">AI Loan Assistant</h3>
                <span className="online-pill">
                  <span className="pulsing-dot" /> Live Underwriter
                </span>
              </div>
              <p className="chat-subtitle">Real-time banking underwriting algorithms & loan calculations</p>
            </div>
          </div>
          <button onClick={onClose} className="chat-close-btn" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Suggested Prompt Chips */}
        <div className="quick-suggestions-bar">
          <button 
            onClick={() => handleSend('Calculate EMI for 5L home loan at 9.5%')}
            className="suggestion-chip"
            type="button"
          >
            <Calculator size={13} />
            <span>5L home loan @ 9.5%</span>
          </button>
          <button 
            onClick={() => handleSend('Compare HDFC vs ICICI loan processing fees & charges')}
            className="suggestion-chip"
            type="button"
          >
            <FileCheck size={13} />
            <span>Bank processing fees</span>
          </button>
          <button 
            onClick={() => handleSend('Find ICICI manager details in Pune')}
            className="suggestion-chip"
            type="button"
          >
            <Sparkles size={13} />
            <span>ICICI Pune manager</span>
          </button>
        </div>

        {/* Message History */}
        <div className="chat-body">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
            >
              <div className="msg-avatar">
                {msg.sender === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
              </div>
              <div className="msg-bubble">
                <div className="msg-text">{msg.text}</div>
                
                {msg.calculatedEmi && (
                  <div className="calculated-emi-card">
                    <div className="emi-result-top">
                      <span className="emi-headline">Estimated Monthly EMI</span>
                      <span className="emi-amount">₹{msg.calculatedEmi.monthlyEmi.toLocaleString('en-IN')}<span className="per-month">/mo</span></span>
                    </div>
                    <div className="emi-breakdown-grid">
                      <div>
                        <span className="bd-label">Principal</span>
                        <span className="bd-val">₹{msg.calculatedEmi.principal.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="bd-label">Total Interest</span>
                        <span className="bd-val">₹{msg.calculatedEmi.interest.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="bd-label">Tenure</span>
                        <span className="bd-val">{msg.calculatedEmi.tenureMonths} Months</span>
                      </div>
                    </div>
                  </div>
                )}

                <span className="msg-timestamp">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message-row ai-row">
              <div className="msg-avatar">
                <Bot size={14} />
              </div>
              <div className="msg-bubble loading-bubble">
                <RefreshCw size={14} className="spin-icon" />
                <span>Consulting underwriting policies...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="chat-footer">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="chat-input-form"
          >
            <input 
              type="text"
              placeholder="Ask loan criteria, EMI, CIBIL cutoffs or managers..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={isLoading || !inputVal.trim()}
              className="chat-send-btn"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-chat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 650px;
          height: 600px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .chat-header {
          padding: 1.15rem 1.35rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-subtle);
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .ai-status-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-title-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .chat-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .online-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          font-weight: 600;
          background: #dcfce7;
          color: #15803d;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
        }

        [data-theme='dark'] .online-pill {
          background: #14532d;
          color: #86efac;
        }

        .pulsing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
        }

        .chat-subtitle {
          font-size: 0.775rem;
          color: var(--text-muted);
        }

        .chat-close-btn {
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
        }

        .quick-suggestions-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.25rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          overflow-x: auto;
        }

        .suggestion-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.65rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          transition: all 0.18s ease;
        }

        .suggestion-chip:hover {
          background: var(--primary-50);
          color: var(--primary-600);
          border-color: var(--primary-500);
        }

        .chat-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }

        .message-row {
          display: flex;
          gap: 0.75rem;
          max-width: 85%;
        }

        .user-row {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .ai-row {
          align-self: flex-start;
        }

        .msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .user-row .msg-avatar {
          background: var(--primary-500);
          color: #ffffff;
        }

        .ai-row .msg-avatar {
          background: var(--bg-subtle);
          color: var(--primary-600);
          border: 1px solid var(--border-color);
        }

        .msg-bubble {
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .user-row .msg-bubble {
          background: var(--primary-500);
          color: #ffffff;
          border-bottom-right-radius: 2px;
        }

        .ai-row .msg-bubble {
          background: var(--bg-subtle);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 2px;
        }

        .msg-text {
          white-space: pre-line;
        }

        .calculated-emi-card {
          margin-top: 0.75rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.85rem;
        }

        .emi-result-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .emi-headline {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }

        .emi-amount {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--primary-600);
        }

        .per-month {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .emi-breakdown-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .bd-label {
          display: block;
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .bd-val {
          font-size: 0.825rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .msg-timestamp {
          display: block;
          font-size: 0.65rem;
          opacity: 0.7;
          margin-top: 0.35rem;
          text-align: right;
        }

        .loading-bubble {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.825rem;
          color: var(--text-muted);
        }

        .spin-icon {
          animation: spin 1.5s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .chat-footer {
          padding: 0.85rem 1.25rem;
          background: var(--bg-subtle);
          border-top: 1px solid var(--border-color);
        }

        .chat-input-form {
          display: flex;
          gap: 0.65rem;
        }

        .chat-input {
          flex: 1;
          padding: 0.65rem 1rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          color: var(--text-primary);
          outline: none;
        }

        .chat-input:focus {
          border-color: var(--primary-500);
        }

        .chat-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-500);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-send-btn:not(:disabled):hover {
          background: var(--primary-600);
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};
