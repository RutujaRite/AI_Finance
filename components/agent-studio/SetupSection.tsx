// components/agent-studio/SetupSection.tsx
"use client";

import React, { useState } from "react";
import { Agent } from "@/lib/agent-studio/types";

interface SetupSectionProps {
  agent: Agent;
  onChange: (updated: Partial<Agent>) => void;
  onSaveChanges: () => void;
  saving?: boolean;
}

export default function SetupSection({
  agent,
  onChange,
  onSaveChanges,
  saving = false,
}: SetupSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newAttachment, setNewAttachment] = useState("");
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);

  function handleAddAttachment() {
    if (!newAttachment.trim()) return;
    const current = agent.welcomeMessage.attachments || [];
    onChange({
      welcomeMessage: {
        ...agent.welcomeMessage,
        attachments: [...current, newAttachment.trim()],
      },
    });
    setNewAttachment("");
    setShowAttachmentInput(false);
  }

  function handleRemoveAttachment(index: number) {
    const current = agent.welcomeMessage.attachments || [];
    onChange({
      welcomeMessage: {
        ...agent.welcomeMessage,
        attachments: current.filter((_, i) => i !== index),
      },
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
      {/* Header bar with Save Changes */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Agent Setup
          </h2>
          <p className="text-xs text-slate-500">
            Define identity, operational behavior, response tone, and welcome greetings.
          </p>
        </div>
        <button
          onClick={onSaveChanges}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm hover:shadow disabled:opacity-60"
        >
          {saving ? (
            <>
              <i className="bi bi-arrow-repeat text-sm animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <i className="bi bi-check2 text-sm" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* 1. Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Overview
          </h3>
          <p className="text-xs text-slate-500">
            General agent identity and conversation availability channels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition"
              placeholder="e.g. Loan Assistant"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Response Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["concise", "balanced", "detailed"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ responseStyle: style })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium capitalize border transition ${
                    agent.responseStyle === style
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
                      : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={agent.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition"
            placeholder="AI assistant for loan policy and customer assistance."
          />
        </div>

        {/* Modes */}
        <div className="pt-2 border-t border-slate-100">
          <span className="block text-xs font-semibold text-slate-700 mb-3">
            Operating Modes
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 border border-slate-200/70">
              <div>
                <div className="text-xs font-semibold text-slate-800">AI Agent Mode</div>
                <div className="text-[11px] text-slate-500">Autonomous replies</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    modes: { ...agent.modes, aiAgentMode: !agent.modes.aiAgentMode },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  agent.modes.aiAgentMode ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    agent.modes.aiAgentMode ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 border border-slate-200/70">
              <div>
                <div className="text-xs font-semibold text-slate-800">Conversations</div>
                <div className="text-[11px] text-slate-500">Live chat intake</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    modes: { ...agent.modes, conversations: !agent.modes.conversations },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  agent.modes.conversations ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    agent.modes.conversations ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 border border-slate-200/70">
              <div>
                <div className="text-xs font-semibold text-slate-800">Campaigns</div>
                <div className="text-[11px] text-slate-500">Outreach workflows</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    modes: { ...agent.modes, campaigns: !agent.modes.campaigns },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  agent.modes.campaigns ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    agent.modes.campaigns ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Agent Instructions Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Agent Instructions
          </h3>
          <p className="text-xs text-slate-500">
            Guide the agent&apos;s behavior, knowledge context, persona, and escalation criteria.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Describe your business
          </label>
          <textarea
            rows={2}
            value={agent.instructions.businessDescription}
            onChange={(e) =>
              onChange({
                instructions: {
                  ...agent.instructions,
                  businessDescription: e.target.value,
                },
              })
            }
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition resize-none"
            placeholder="Leading financial marketplace partner helping applicants compare loan eligibility..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Agent role
            </label>
            <input
              type="text"
              value={agent.instructions.agentRole}
              onChange={(e) =>
                onChange({
                  instructions: {
                    ...agent.instructions,
                    agentRole: e.target.value,
                  },
                })
              }
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition"
              placeholder="Senior Loan & Credit Advisory Specialist"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tone
            </label>
            <input
              type="text"
              value={agent.instructions.tone}
              onChange={(e) =>
                onChange({
                  instructions: {
                    ...agent.instructions,
                    tone: e.target.value,
                  },
                })
              }
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition"
              placeholder="Warm, professional, empathetic, and transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Escalation rules
          </label>
          <textarea
            rows={2}
            value={agent.instructions.escalationRules}
            onChange={(e) =>
              onChange({
                instructions: {
                  ...agent.instructions,
                  escalationRules: e.target.value,
                },
              })
            }
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition resize-none"
            placeholder="Connect applicant to verified branch manager when requesting in-person support..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Additional instructions
          </label>
          <textarea
            rows={2}
            value={agent.instructions.additionalInstructions}
            onChange={(e) =>
              onChange({
                instructions: {
                  ...agent.instructions,
                  additionalInstructions: e.target.value,
                },
              })
            }
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition resize-none"
            placeholder="Verify loan type first. Guide customers through KYC documents and CIBIL requirements..."
          />
        </div>

        {/* Collapsible Advanced instructions (collapsed by default, no complicated LLM settings) */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition"
          >
            <span>Advanced instructions</span>
            <i
              className={`bi bi-chevron-${showAdvanced ? "up" : "down"} text-[10px]`}
            />
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-3 animate-fadeIn">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Context grounding prefix
                </label>
                <input
                  type="text"
                  value={agent.instructions.advancedPrompt || ""}
                  onChange={(e) =>
                    onChange({
                      instructions: {
                        ...agent.instructions,
                        advancedPrompt: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 rounded-lg border border-slate-200 focus:border-indigo-500 focus:outline-none"
                  placeholder="Base responses strictly on verified knowledge and partner bank rules."
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Creativity / Strictness</span>
                <span className="font-medium text-slate-700">Balanced (0.6)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Welcome Message Card + Live Preview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Welcome Message
            </h3>
            <p className="text-xs text-slate-500">
              The initial greeting customer sees when opening a conversation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Send welcome message</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  welcomeMessage: {
                    ...agent.welcomeMessage,
                    enabled: !agent.welcomeMessage.enabled,
                  },
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                agent.welcomeMessage.enabled ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  agent.welcomeMessage.enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form input */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Greeting Message
              </label>
              <textarea
                rows={4}
                value={agent.welcomeMessage.text}
                onChange={(e) =>
                  onChange({
                    welcomeMessage: {
                      ...agent.welcomeMessage,
                      text: e.target.value,
                    },
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition resize-none font-sans leading-relaxed"
                placeholder="Hi! I'm your Loan Assistant 👋..."
              />
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Attachments & Resources
                </span>
                <button
                  type="button"
                  onClick={() => setShowAttachmentInput(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <i className="bi bi-plus-lg text-[10px]" />
                  <span>Add Attachment</span>
                </button>
              </div>

              {showAttachmentInput && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200 animate-fadeIn">
                  <input
                    type="text"
                    value={newAttachment}
                    onChange={(e) => setNewAttachment(e.target.value)}
                    placeholder="e.g. Loan_Policy_QuickGuide.pdf"
                    className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentInput(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              )}

              {agent.welcomeMessage.attachments &&
              agent.welcomeMessage.attachments.length > 0 ? (
                <div className="space-y-1.5">
                  {agent.welcomeMessage.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <i className="bi bi-paperclip text-slate-400" />
                        <span className="truncate">{att}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <i className="bi bi-x text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No attachments added</p>
              )}
            </div>
          </div>

          {/* Live Preview Card */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Live Preview
            </label>
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 min-h-[180px] flex flex-col justify-start">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  🤖
                </div>
                <div className="space-y-2 max-w-[90%]">
                  <div className="p-3.5 bg-white rounded-2xl rounded-tl-sm border border-slate-200/80 shadow-xs text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {agent.welcomeMessage.text || "Hello! How can I assist you today?"}
                  </div>
                  {agent.welcomeMessage.attachments?.map((att, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] text-indigo-700 font-medium shadow-xs"
                    >
                      <i className="bi bi-file-earmark-pdf text-red-500" />
                      <span>{att}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
