// components/agent-studio/QualificationSection.tsx
"use client";

import React, { useState } from "react";
import { Agent, UserSubscriptionState } from "@/lib/agent-studio/types";

interface QualificationSectionProps {
  agent: Agent;
  subscription: UserSubscriptionState;
  onChange: (updated: Partial<Agent>) => void;
  onSaveChanges: () => void;
  saving?: boolean;
  onUpgradeModal: (reason: { title: string; subtitle: string; actionText: string }) => void;
}

export default function QualificationSection({
  agent,
  subscription,
  onChange,
  onSaveChanges,
  saving = false,
  onUpgradeModal,
}: QualificationSectionProps) {
  // New Lead Field Modal/Inline State
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(true);

  // New Document Modal/Inline State
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocRequired, setNewDocRequired] = useState(true);

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lead Fields Handlers
  function handleToggleField(fieldId: string, prop: "enabled" | "required") {
    const updated = agent.qualification.leadFields.map((field) => {
      if (field.id === fieldId) {
        return { ...field, [prop]: !field[prop] };
      }
      return field;
    });
    onChange({
      qualification: { ...agent.qualification, leadFields: updated },
    });
  }

  function handleRemoveField(fieldId: string) {
    const updated = agent.qualification.leadFields.filter((f) => f.id !== fieldId);
    onChange({
      qualification: { ...agent.qualification, leadFields: updated },
    });
  }

  function handleCreateField() {
    if (!newFieldName.trim()) return;
    const newField = {
      id: `f_${Date.now()}`,
      name: newFieldName.trim(),
      key: newFieldName.trim().toLowerCase().replace(/\s+/g, "_"),
      enabled: true,
      required: newFieldRequired,
      type: "text" as const,
    };
    onChange({
      qualification: {
        ...agent.qualification,
        leadFields: [...agent.qualification.leadFields, newField],
      },
    });
    setNewFieldName("");
    setNewFieldRequired(true);
    setShowAddField(false);
  }

  // Document Collection Handlers
  function handleToggleDocumentRequired(docId: string) {
    const updated = agent.qualification.documentCollection.map((doc) => {
      if (doc.id === docId) {
        return { ...doc, required: !doc.required };
      }
      return doc;
    });
    onChange({
      qualification: { ...agent.qualification, documentCollection: updated },
    });
  }

  function handleRemoveDocumentReq(docId: string) {
    const updated = agent.qualification.documentCollection.filter((d) => d.id !== docId);
    onChange({
      qualification: { ...agent.qualification, documentCollection: updated },
    });
  }

  function handleCreateDocumentReq() {
    if (!newDocName.trim()) return;
    const newDoc = {
      id: `d_${Date.now()}`,
      name: newDocName.trim(),
      required: newDocRequired,
      description: "Applicant verification proof",
    };
    onChange({
      qualification: {
        ...agent.qualification,
        documentCollection: [...agent.qualification.documentCollection, newDoc],
      },
    });
    setNewDocName("");
    setNewDocRequired(true);
    setShowAddDoc(false);
  }

  // Knowledge File Upload Handlers (enforces plan limit)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check plan limits
    const maxFiles = subscription.maxKnowledgeFiles;
    if (agent.knowledge.length >= maxFiles) {
      onUpgradeModal({
        title: `Your ${subscription.plan.toUpperCase()} plan includes ${maxFiles} knowledge file${maxFiles === 1 ? "" : "s"}.`,
        subtitle: "Upgrade to Pro for up to 10 knowledge files and expanded document intelligence.",
        actionText: "Upgrade to Pro",
      });
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          type: file.name.endsWith(".docx")
            ? "docx"
            : file.name.endsWith(".txt")
            ? "txt"
            : "pdf",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.limitReached) {
          onUpgradeModal({
            title: `Your ${subscription.plan.toUpperCase()} plan includes ${maxFiles} knowledge file${maxFiles === 1 ? "" : "s"}.`,
            subtitle: "Upgrade to Pro for up to 10 knowledge files and expanded document intelligence.",
            actionText: "Upgrade to Pro",
          });
        } else {
          setUploadError(data.error || "Failed to upload knowledge document");
        }
        return;
      }

      if (data.agent) {
        onChange(data.agent);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemoveKnowledgeFile(docId: string) {
    try {
      const res = await fetch(`/api/agents/${agent.id}/knowledge?docId=${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.agent) {
        onChange(data.agent);
      }
    } catch (err) {
      console.error("Failed to remove knowledge file:", err);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
      {/* Header bar with Save Changes */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Qualification & Knowledge
          </h2>
          <p className="text-xs text-slate-500">
            Set required applicant fields, document intake standards, and grounded knowledge files.
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

      {/* 1. Lead Qualification */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Lead Qualification
            </h3>
            <p className="text-xs text-slate-500">
              The agent systematically collects and validates these fields before routing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddField(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
          >
            <i className="bi bi-plus-lg text-xs" />
            <span>Add Field</span>
          </button>
        </div>

        {/* Add Field Inline Card */}
        {showAddField && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Add New Qualification Field</span>
              <button
                type="button"
                onClick={() => setShowAddField(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="bi bi-x text-base" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="Field name (e.g. Existing Loan EMI)"
                className="flex-1 min-w-[200px] text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Mandatory / Required</span>
              </label>
              <button
                type="button"
                onClick={handleCreateField}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                Save Field
              </button>
            </div>
          </div>
        )}

        {/* Fields List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agent.qualification.leadFields.map((field) => (
            <div
              key={field.id}
              className={`p-3 rounded-xl border transition flex items-center justify-between ${
                field.enabled
                  ? "bg-white border-slate-200/90 shadow-2xs"
                  : "bg-slate-50/50 border-slate-200/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-xs font-medium text-slate-800">
                  {field.name}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Required Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleField(field.id, "required")}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition ${
                    field.required
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {field.required ? "Required" : "Optional"}
                </button>

                {/* Enabled Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleField(field.id, "enabled")}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    field.enabled ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      field.enabled ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleRemoveField(field.id)}
                  className="text-slate-300 hover:text-red-500 transition"
                  title="Remove Field"
                >
                  <i className="bi bi-trash text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Document Collection */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Document Collection
            </h3>
            <p className="text-xs text-slate-500">
              Checklist of KYC & income proofs the assistant will request from customers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddDoc(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
          >
            <i className="bi bi-plus-lg text-xs" />
            <span>Add Document</span>
          </button>
        </div>

        {/* Add Document Inline Card */}
        {showAddDoc && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Add Document Requirement</span>
              <button
                type="button"
                onClick={() => setShowAddDoc(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="bi bi-x text-base" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Document title (e.g. Form 16 / ITR Returns)"
                className="flex-1 min-w-[200px] text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newDocRequired}
                  onChange={(e) => setNewDocRequired(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Mandatory / Required</span>
              </label>
              <button
                type="button"
                onClick={handleCreateDocumentReq}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                Save Document
              </button>
            </div>
          </div>
        )}

        {/* Document items list */}
        <div className="space-y-2">
          {agent.qualification.documentCollection.map((doc) => (
            <div
              key={doc.id}
              className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                  <i className="bi bi-file-earmark-check" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{doc.name}</div>
                  <div className="text-[11px] text-slate-400">{doc.description || "Verification document"}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleDocumentRequired(doc.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition ${
                    doc.required
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {doc.required ? "Required" : "Optional"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveDocumentReq(doc.id)}
                  className="text-slate-300 hover:text-red-500 transition"
                >
                  <i className="bi bi-trash text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Knowledge Base */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Knowledge Base
            </h3>
            <p className="text-xs text-slate-500">
              Ground your assistant with verified policy sheets, guidelines, and FAQs.
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
            {agent.knowledge.length} of {subscription.maxKnowledgeFiles} files used
          </span>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
            <i className="bi bi-exclamation-circle" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Dropzone / Upload area */}
        <label className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/40 hover:bg-slate-50/80 group">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
            {uploading ? (
              <i className="bi bi-arrow-repeat text-lg animate-spin" />
            ) : (
              <i className="bi bi-cloud-arrow-up text-lg" />
            )}
          </div>
          <p className="text-xs font-semibold text-slate-700">
            {uploading ? "Processing knowledge document..." : "Click to upload knowledge file"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Supported formats: PDF, DOCX, TXT (Up to 10MB)
          </p>
        </label>

        {/* Documents List */}
        <div className="space-y-2">
          {agent.knowledge.map((doc) => (
            <div
              key={doc.id}
              className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold uppercase">
                  {doc.type}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      {doc.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <i className="bi bi-check text-xs" />
                      Processed
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {doc.size} • Processed {doc.uploadedAt}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Replace (triggers upload click) */}
                <label className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1 rounded-lg hover:bg-indigo-50/60 cursor-pointer transition">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  Replace
                </label>
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemoveKnowledgeFile(doc.id)}
                  className="text-xs font-semibold text-slate-400 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50/60 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
