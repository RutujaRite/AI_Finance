// components/agent-studio/TestSection.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Agent, UserSubscriptionState, TestChatMessage } from "@/lib/agent-studio/types";

interface TestSectionProps {
  agent: Agent;
  subscription: UserSubscriptionState;
  onUsageUpdated: (subscription: UserSubscriptionState) => void;
  onUpgradeModal: (reason: { title: string; subtitle: string; actionText: string }) => void;
}

export default function TestSection({
  agent,
  subscription,
  onUsageUpdated,
  onUpgradeModal,
}: TestSectionProps) {
  const [messages, setMessages] = useState<TestChatMessage[]>([
    {
      id: "msg_init",
      role: "assistant",
      content:
        agent.welcomeMessage?.text ||
        `Hi! I'm your ${agent.name}. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [activePipeline, setActivePipeline] = useState<
    Array<{ step: string; detail: string }>
  >([
    { step: "Question", detail: "Awaiting user input in playground" },
    { step: "Understand", detail: "Parse intent and identify required fields" },
    { step: "Knowledge", detail: "Retrieve matching bank policies or docs" },
    { step: "Instructions", detail: "Apply agent persona, tone & rules" },
    { step: "Capabilities", detail: "Execute active capabilities (EMI, Eligibility)" },
    { step: "Response", detail: "Return conversational answer to applicant" },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const currentUsage = subscription.messagesUsed;
  const maxUsage = subscription.maxMessages;
  const percentage = Math.min(100, Math.round((currentUsage / maxUsage) * 100));
  const remaining = Math.max(0, maxUsage - currentUsage);
  const isAtLimit = currentUsage >= maxUsage;
  const isNearLimit = remaining === 1;

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    if (isAtLimit) {
      onUpgradeModal({
        title: "You've reached your free testing limit.",
        subtitle:
          "Your AI agent is saved and ready. Upgrade your plan to continue testing with more messages.",
        actionText: "View Plans",
      });
      return;
    }

    const userMsg: TestChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newChatHistory = [...messages, userMsg];
    setMessages(newChatHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: newChatHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.limitReached) {
          onUpgradeModal({
            title: "You've reached your free testing limit.",
            subtitle:
              "Your AI agent is saved and ready. Upgrade your plan to continue testing with more messages.",
            actionText: "View Plans",
          });
          if (data.usage) {
            onUsageUpdated({
              ...subscription,
              messagesUsed: data.usage.messagesUsed,
            });
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_err_${Date.now()}`,
              role: "assistant",
              content:
                "I apologize, but I encountered a momentary issue processing your request. Please try again.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
        return;
      }

      if (data.subscription) {
        onUsageUpdated(data.subscription);
      } else if (data.usage) {
        onUsageUpdated({
          ...subscription,
          messagesUsed: data.usage.messagesUsed,
        });
      }

      if (data.pipeline) {
        setActivePipeline(data.pipeline);
      }

      const botMsg: TestChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        trace: data.pipeline,
      };

      setMessages((prev) => [...prev, botMsg]);

      // If this message reached the limit, show the upgrade modal softly
      if (data.usage?.limitReached) {
        setTimeout(() => {
          onUpgradeModal({
            title: "You've reached your free testing limit.",
            subtitle:
              "Your AI agent is saved and ready. Upgrade your plan to continue testing with more messages.",
            actionText: "View Plans",
          });
        }, 800);
      }
    } catch (err: any) {
      console.error("Test send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content:
            "Connection temporarily unavailable. Please verify your connection or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: "msg_init",
        role: "assistant",
        content:
          agent.welcomeMessage?.text ||
          `Hi! I'm your ${agent.name}. How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }

  const suggestionPills = [
    "I want a personal loan.",
    "What documents are required?",
    "Calculate EMI for ₹5 Lakhs for 3 years",
    "Check loan eligibility across partner banks",
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8 animate-fadeIn">
      {/* Playground Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              Test {agent.name}
            </h2>
            <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Live Playground
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Send test messages to evaluate accuracy, persona tone, and qualification flow.
          </p>
        </div>

        {/* Small Usage Indicator */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 min-w-[210px]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Trial Usage</span>
            <span className="font-bold text-slate-800">
              {currentUsage} / {maxUsage} messages
            </span>
          </div>

          <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isAtLimit ? "bg-amber-400" : isNearLimit ? "bg-amber-400" : "bg-indigo-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {isNearLimit && !isAtLimit && (
            <p className="text-[10px] text-amber-600 font-medium mt-1">
              1 test message remaining.
            </p>
          )}

          {isAtLimit && (
            <p className="text-[10px] text-indigo-600 font-semibold mt-1">
              Free limit reached • Upgrade to continue
            </p>
          )}
        </div>
      </div>

      {/* How It Works Collapsible */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <i className="bi bi-diagram-3 text-indigo-600" />
            <span>How It Works</span>
          </div>
          <i
            className={`bi bi-chevron-${showHowItWorks ? "up" : "down"} text-xs text-slate-400`}
          />
        </button>

        {showHowItWorks && (
          <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/40 animate-fadeIn">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2 py-2">
              {activePipeline.map((step, idx) => (
                <React.Fragment key={step.step}>
                  <div className="flex-1 w-full bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                    <div className="text-[11px] font-bold text-indigo-600">
                      {step.step}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5" title={step.detail}>
                      {step.detail}
                    </div>
                  </div>
                  {idx < activePipeline.length - 1 && (
                    <div className="hidden md:block text-slate-300 font-bold text-sm">
                      ↓
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Playground Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-[520px] overflow-hidden">
        {/* Chat Messages scroll area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                    isUser
                      ? "bg-slate-700 text-white"
                      : "bg-indigo-600 text-white"
                  }`}
                >
                  {isUser ? "You" : "🤖"}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs whitespace-pre-line ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-tr-xs"
                      : "bg-slate-50 text-slate-800 rounded-tl-xs border border-slate-200/70"
                  }`}
                >
                  <div>{msg.content}</div>
                  <div
                    className={`mt-1.5 text-[10px] ${
                      isUser ? "text-indigo-200 text-right" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0">
                🤖
              </div>
              <div className="bg-slate-50 text-slate-500 rounded-2xl rounded-tl-xs border border-slate-200/70 p-3.5 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce delay-200" />
                <span className="ml-1 text-[11px] text-slate-400">Processing knowledge & response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-5 py-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto bg-slate-50/40">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Try:</span>
          {suggestionPills.map((pill, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading || isAtLimit}
              onClick={() => handleSend(pill)}
              className="text-[11px] text-slate-600 bg-white hover:bg-indigo-50/60 hover:text-indigo-700 px-2.5 py-1 rounded-lg border border-slate-200/80 transition shrink-0 shadow-2xs disabled:opacity-50"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || isAtLimit}
              placeholder={
                isAtLimit
                  ? "Testing limit reached on Basic plan. Upgrade to continue testing."
                  : "Type a message... (e.g. I want a personal loan)"
              }
              className="flex-1 px-4 py-2.5 bg-slate-50/70 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={loading || !input.trim() || isAtLimit}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <span>Send</span>
              <i className="bi bi-send text-xs" />
            </button>

            <button
              type="button"
              onClick={handleClearChat}
              title="Clear Chat"
              className="px-3 py-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs transition"
            >
              <i className="bi bi-trash" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
