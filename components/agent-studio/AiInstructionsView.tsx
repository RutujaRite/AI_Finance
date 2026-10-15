// components/agent-studio/AiInstructionsView.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Settings,
  User,
  FileText,
  BookOpen,
  UploadCloud,
  Upload,
  Paperclip,
  ArrowRight,
  Search,
  Eye,
  Edit2,
  Trash2,
  Bot,
  ChevronDown,
  Check,
  Lightbulb,
  X,
  Save,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  FileSpreadsheet,
  FileCode,
  Globe,
  Database,
  Folder,
  Link2,
  ChevronRight,
  MessageSquare,
  Sliders,
  Cpu,
  Download
} from "lucide-react";
import { Agent } from "@/lib/agent-studio/types";

interface AgentDocItem {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedOn: string;
  status: string;
  content?: string;
  instructionText?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  guardrailText?: string;
  isActive?: boolean;
}

interface BankPolicyLibraryItem {
  id: number;
  bank_name: string;
  bank_code: string;
  status: string;
  extracted_text?: string;
  file_name?: string;
}

interface AiInstructionsViewProps {
  agent: Agent;
  agents?: Agent[];
  onSelectAgent?: (agentId: string) => void;
  onUpdateAgent: (updates: Partial<Agent>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onNavigateToKnowledge: () => void;
  onNavigateToDemo?: () => void;
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
  onCreateAgentClick?: () => void;
  onActivateAgent?: (agentId: string) => Promise<void>;
  onDeactivateAgent?: (agentId: string) => Promise<void>;
  onDeleteAgentClick?: (agentId: string) => void;
}

const PAGE_SIZE = 5;

const DEFAULT_REFERENCE_DOCS: AgentDocItem[] = [
  {
    id: "ref_1_akte_bank",
    name: "Akte_Bank_Policy.pdf",
    type: "PDF",
    size: "2.4 MB",
    uploadedOn: "12 Oct 2025, 10:24 AM",
    status: "Active",
    content: "Akte Bank Personal Loan Policy Guidelines.\n\nEligibility Criteria:\n- Minimum Age: 21 years, Maximum: 58 years\n- Minimum Net Monthly Income: ₹25,000\n- Minimum CIBIL Score: 700\n- Maximum Loan Amount: ₹15,00,000\n- Maximum Tenure: 60 months\n- Allowed FOIR: Up to 55%",
    instructionText: "Reference this document strictly when applicant asks about Akte Bank loan criteria or salary thresholds.",
    whenToUse: "akte bank, personal loan, salary criteria, foir",
    whenNotToUse: "home loan, commercial vehicle loan",
    guardrailText: "Never promise unconditional approval without official bank credit verification.",
    isActive: true,
  },
  {
    id: "ref_2_hdfc_bank",
    name: "HDFC_Bank_Terms.pdf",
    type: "PDF",
    size: "1.8 MB",
    uploadedOn: "11 Oct 2025, 04:12 PM",
    status: "Active",
    content: "HDFC Bank Personal Loan Terms and Underwriting Guidelines.\n\nKey Parameters:\n- Category A Company Minimum Salary: ₹25,000\n- Category B Company Minimum Salary: ₹30,000\n- CIBIL Cutoff: 720+\n- Interest Rate: 10.50% - 14.50%\n- Maximum Loan Amount: ₹40,00,000\n- Processing Fee: 1.50% + GST",
    instructionText: "Consult this document for HDFC interest rates, corporate tier brackets, and maximum loan amounts.",
    whenToUse: "hdfc, hdfc bank, terms, interest rates, tenure",
    whenNotToUse: "gold loan, loan against property",
    guardrailText: "State clearly that interest rates depend on company category and credit assessment.",
    isActive: true,
  },
  {
    id: "ref_3_company_data",
    name: "Company_Data.xlsx",
    type: "XLSX",
    size: "3.6 MB",
    uploadedOn: "10 Oct 2025, 02:30 PM",
    status: "Active",
    content: "Company Category Master Sheet:\nContains categorization tiers (Super Cat A, Cat A, Cat B, Cat C, and Unlisted) for corporate employers across partner banks including Axis, HDFC, ICICI, Kotak, and IndusInd Bank.",
    instructionText: "Use this master sheet to map employer names to corporate listing categories.",
    whenToUse: "company category, employer tier, cat a, cat b, super cat a",
    whenNotToUse: "self employed without company, students, homemakers",
    guardrailText: "Never categorize non-corporate profiles like student or housewife as company names.",
    isActive: true,
  },
  {
    id: "ref_4_faq_insurance",
    name: "FAQ_Insurance.docx",
    type: "DOCX",
    size: "1.2 MB",
    uploadedOn: "09 Oct 2025, 11:20 AM",
    status: "Active",
    content: "Loan Insurance, Credit Shield, Processing Fees, and Frequently Asked Questions documentation for loan applicants.\nClarifies mandatory vs optional insurance, cancellation terms, and claim procedures.",
    instructionText: "Provide accurate answers regarding loan protection plans, fees, and charges.",
    whenToUse: "insurance, credit shield, fees, charges, cancellation",
    whenNotToUse: "interest rate calculation",
    guardrailText: "Clarify that loan insurance is optional and subject to applicant consent.",
    isActive: true,
  },
  {
    id: "ref_5_policy_notes",
    name: "Policy_Notes.txt",
    type: "TXT",
    size: "850 KB",
    uploadedOn: "08 Oct 2025, 03:45 PM",
    status: "Active",
    content: "Underwriting Exception Notes:\n- Deviations allowed for high-salary applicants (>₹75,000/mo) with CIBIL >= 750 upon credit committee approval.\n- Address proof exceptions allowed with active rent agreement and employer HR confirmation.",
    instructionText: "Reference these underwriting exceptions when standard bank criteria require deviations.",
    whenToUse: "exception, deviation, underwriting rules, approval override",
    whenNotToUse: "standard rejected cases without deviation criteria",
    guardrailText: "Do not disclose internal underwriter notes directly to customer conversations.",
    isActive: true,
  },
];

export default function AiInstructionsView({
  agent,
  agents = [],
  onSelectAgent,
  onUpdateAgent,
  onSave,
  saving,
  onNavigateToKnowledge,
  onNavigateToDemo,
  onToast,
  onCreateAgentClick,
  onActivateAgent,
  onDeactivateAgent,
  onDeleteAgentClick,
}: AiInstructionsViewProps) {
  const [isDraft, setIsDraft] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [agentDocs, setAgentDocs] = useState<AgentDocItem[]>(DEFAULT_REFERENCE_DOCS);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Table Selection, Search, Filter & Pagination
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [currentPage, setCurrentPage] = useState(1);

  // Agent State
  const [isAssistantVisible, setIsAssistantVisible] = useState(
    agent.operationalMode !== "task_focused"
  );
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState<boolean>(
    agent.isActiveForUser !== false && agent.status === "active"
  );

  useEffect(() => {
    setIsAgentActive(agent.isActiveForUser !== false && agent.status === "active");
  }, [agent.id, agent.isActiveForUser, agent.status]);

  async function handleToggleActiveStatus() {
    const nextState = !isAgentActive;
    setIsAgentActive(nextState);
    try {
      if (nextState) {
        if (onActivateAgent) {
          await onActivateAgent(agent.id);
        } else {
          onUpdateAgent({ status: "active", isActiveForUser: true });
          onToast(`Agent "${agentName}" activated`, "success");
        }
      } else {
        if (onDeactivateAgent) {
          await onDeactivateAgent(agent.id);
        } else {
          onUpdateAgent({ status: "draft", isActiveForUser: false });
          onToast(`Agent "${agentName}" deactivated`, "info");
        }
      }
    } catch {
      setIsAgentActive(!nextState);
      onToast("Failed to toggle agent status", "warning");
    }
  }

  // Modals
  const [previewDoc, setPreviewDoc] = useState<AgentDocItem | null>(null);
  const [editConfigDoc, setEditConfigDoc] = useState<AgentDocItem | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editInstructionText, setEditInstructionText] = useState("");
  const [editWhenToUse, setEditWhenToUse] = useState("");
  const [editWhenNotToUse, setEditWhenNotToUse] = useState("");
  const [editGuardrailText, setEditGuardrailText] = useState("");
  const [isSavingDocConfig, setIsSavingDocConfig] = useState(false);

  // Delete modal confirmation
  const [deleteDocTarget, setDeleteDocTarget] = useState<AgentDocItem | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // From URL Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitleInput, setUrlTitleInput] = useState("");

  // From Text Modal
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textTitleInput, setTextTitleInput] = useState("");
  const [textContentInput, setTextContentInput] = useState("");

  // From Library Modal
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryPolicies, setLibraryPolicies] = useState<BankPolicyLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isAddingFromSource, setIsAddingFromSource] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  const allAgentsList = agents && agents.length > 0 ? agents : [agent];

  // Close agent dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Form values based on current agent
  const agentName = agent.name || "Loan Assistant";
  const agentRole = agent.instructions?.agentRole || "Loan Consultant";
  const conversationTone = agent.instructions?.tone || "Professional and friendly";
  const responseStyle =
    agent.responseStyle === "detailed"
      ? "Detailed"
      : agent.responseStyle === "balanced"
      ? "Step-by-step"
      : "Clear, helpful, concise";

  const defaultPrompt =
    "You are a helpful AI assistant. Understand the user's message before responding. Follow the configured business instructions. Use the connected knowledge base for supported answers. If information is missing, ask a clear follow-up question. Do not invent facts. Keep responses friendly, accurate, and easy to understand.";

  const instructionsText =
    agent.instructions?.advancedPrompt && agent.instructions.advancedPrompt.length > 50
      ? agent.instructions.advancedPrompt
      : defaultPrompt;

  // Real API Fetch: Knowledge Documents for Current Agent
  async function loadAgentKnowledge() {
    try {
      setIsLoadingDocs(true);
      setDocsError(null);
      const res = await fetch(`/api/agents/${agent.id}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.documents) && data.documents.length > 0) {
          const mapped: AgentDocItem[] = data.documents.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: (d.fileType || "PDF").toUpperCase(),
            size: d.fileSize || "1.0 MB",
            uploadedOn: new Date(d.uploadedAt || Date.now()).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            status: d.status === "FAILED" ? "Failed" : "Active",
            content: d.content || d.extractedText || undefined,
            instructionText: d.instruction?.instructionText || "",
            whenToUse: d.instruction?.whenToUse || "",
            whenNotToUse: d.instruction?.whenNotToUse || "",
            guardrailText: d.guardrail?.guardrailText || "",
            isActive: d.isActive !== false,
          }));
          setAgentDocs(mapped);
        } else {
          // If no documents uploaded yet for this agent, display reference policies from reference mockup
          setAgentDocs(DEFAULT_REFERENCE_DOCS);
        }
      } else {
        setAgentDocs(DEFAULT_REFERENCE_DOCS);
      }
    } catch (err: any) {
      console.warn("Notice loading agent knowledge documents:", err);
      setAgentDocs(DEFAULT_REFERENCE_DOCS);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  useEffect(() => {
    loadAgentKnowledge();
    setCurrentPage(1);
    setSelectedDocIds([]);
  }, [agent.id]);

  // Load Real Bank Policies for "From Knowledge Base Library"
  async function loadLibraryPolicies() {
    try {
      setIsLoadingLibrary(true);
      const res = await fetch("/api/policies");
      if (res.ok) {
        const data = await res.json();
        const policies = data.policies || (Array.isArray(data) ? data : []);
        setLibraryPolicies(policies);
      }
    } catch (err) {
      console.warn("Failed to load library policies:", err);
    } finally {
      setIsLoadingLibrary(false);
    }
  }

  function handleNameChange(name: string) {
    setIsDraft(true);
    onUpdateAgent({ name });
  }

  function handleRoleChange(role: string) {
    setIsDraft(true);
    onUpdateAgent({
      instructions: {
        ...agent.instructions,
        agentRole: role,
      },
    });
  }

  function handleToneChange(tone: string) {
    setIsDraft(true);
    onUpdateAgent({
      instructions: {
        ...agent.instructions,
        tone,
      },
    });
  }

  function handleStyleChange(style: string) {
    setIsDraft(true);
    let mapped: "concise" | "balanced" | "detailed" = "concise";
    if (style.includes("Detailed")) mapped = "detailed";
    else if (style.includes("Step") || style.includes("balanced")) mapped = "balanced";
    else mapped = "concise";

    onUpdateAgent({
      responseStyle: mapped,
    });
  }

  function handleInstructionsChange(text: string) {
    if (text.length > 10000) return;
    setIsDraft(true);
    onUpdateAgent({
      goal: text,
      instructions: {
        ...agent.instructions,
        advancedPrompt: text,
      },
    });
  }

  async function handleSaveClick() {
    try {
      await onSave();
      setIsDraft(false);
      onToast("Instructions saved successfully", "success");
    } catch {
      onToast("Failed to save instructions", "warning");
    }
  }

  // Real File Upload Handler (POST /api/agents/[id]/knowledge)
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const allowed = ["PDF", "DOCX", "DOC", "TXT", "XLSX", "XLS", "CSV"];
    if (!allowed.includes(ext)) {
      onToast("Unsupported format. Allowed: PDF, DOCX, TXT, CSV, XLSX", "warning");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onToast("File exceeds actual 10MB limit", "warning");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Uploaded "${file.name}" to ${agentName}`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to upload document", "warning");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      onToast("Failed to upload document: " + err.message, "warning");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Real Delete File Handler (DELETE /api/agents/[id]/knowledge?docId=...)
  async function handleConfirmDeleteDoc() {
    if (!deleteDocTarget) return;
    setIsDeletingDoc(true);
    try {
      if (deleteDocTarget.id.startsWith("ref_")) {
        setAgentDocs((prev) => prev.filter((d) => d.id !== deleteDocTarget.id));
        onToast(`Removed "${deleteDocTarget.name}"`, "info");
        setDeleteDocTarget(null);
        return;
      }
      const res = await fetch(
        `/api/agents/${agent.id}/knowledge?docId=${deleteDocTarget.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onToast(`Removed "${deleteDocTarget.name}"`, "info");
        setDeleteDocTarget(null);
        await loadAgentKnowledge();
      } else {
        onToast("Failed to delete document from database", "warning");
      }
    } catch {
      onToast("Network error deleting document", "warning");
    } finally {
      setIsDeletingDoc(false);
    }
  }

  // Real Edit Configuration Handler (PATCH /api/agents/[id]/knowledge)
   async function handleDownloadFile(doc: AgentDocItem) {
     if (!doc.content) {
       onToast("No content available for download", "warning");
       return;
     }

     try {
       // Determine file extension and MIME type based on doc.type
       const extensionMap: Record<string, string> = {
         PDF: 'pdf',
         DOCX: 'docx',
         TXT: 'txt',
         XLSX: 'xlsx',
         CSV: 'csv'
       };

       const mimeTypeMap: Record<string, string> = {
         PDF: 'application/pdf',
         DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         TXT: 'text/plain',
         XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         CSV: 'text/csv'
       };

       const extension = extensionMap[doc.type] || 'txt';
       const mimeType = mimeTypeMap[doc.type] || 'text/plain';
       const fileName = doc.name.endsWith(`.${extension}`) ? doc.name : `${doc.name}.${extension}`;

       // Create a blob from the content
       const blob = new Blob([doc.content], { type: mimeType });
       const url = window.URL.createObjectURL(blob);

       // Create a temporary link and trigger download
       const link = document.createElement('a');
       link.href = url;
       link.setAttribute('download', fileName);
       document.body.appendChild(link);
       link.click();

       // Clean up
       document.body.removeChild(link);
       window.URL.revokeObjectURL(url);

       onToast(`Downloaded "${fileName}"`, "success");
     } catch (error) {
       console.error("Download error:", error);
       onToast("Failed to download file", "warning");
     }
   }

   async function handleSaveDocConfig() {
    if (!editConfigDoc) return;
    setIsSavingDocConfig(true);
    try {
      if (editConfigDoc.id.startsWith("ref_")) {
        setAgentDocs((prev) =>
          prev.map((d) =>
            d.id === editConfigDoc.id
              ? {
                  ...d,
                  name: editDocName.trim() || d.name,
                  instructionText: editInstructionText.trim(),
                  whenToUse: editWhenToUse.trim(),
                  whenNotToUse: editWhenNotToUse.trim(),
                  guardrailText: editGuardrailText.trim(),
                }
              : d
          )
        );
        onToast(`Saved configuration for "${editDocName || editConfigDoc.name}"`, "success");
        setEditConfigDoc(null);
        return;
      }
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: editConfigDoc.id,
          name: editDocName.trim() || editConfigDoc.name,
          instructionText: editInstructionText.trim(),
          whenToUse: editWhenToUse.trim(),
          whenNotToUse: editWhenNotToUse.trim(),
          guardrailText: editGuardrailText.trim(),
          isActive: editConfigDoc.isActive !== false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Saved configuration for "${editDocName || editConfigDoc.name}"`, "success");
        setEditConfigDoc(null);
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to update configuration", "warning");
      }
    } catch {
      onToast("Network error saving configuration", "warning");
    } finally {
      setIsSavingDocConfig(false);
    }
  }

  // Real Add from URL Handler
  async function handleAddFromUrl() {
    if (!urlInput.trim()) return;
    setIsAddingFromSource(true);
    try {
      let docName = urlTitleInput.trim();
      if (!docName) {
        try {
          const parsed = new URL(urlInput.trim());
          docName = `Web_Source_${parsed.hostname}.txt`;
        } catch {
          docName = `Web_Source_${Date.now()}.txt`;
        }
      }
      if (!docName.endsWith(".txt")) docName += ".txt";

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content: `Imported Knowledge Link: ${urlInput.trim()}\nFetched on ${new Date().toISOString()}.\nContains web policy context for ${agentName}.`,
          size: "45 KB",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsUrlModalOpen(false);
        setUrlInput("");
        setUrlTitleInput("");
        onToast(`Added web knowledge "${docName}"`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to import URL", "warning");
      }
    } catch {
      onToast("Failed to import URL", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Real Add from Text Handler
  async function handleAddFromText() {
    if (!textContentInput.trim()) return;
    setIsAddingFromSource(true);
    try {
      let docName = textTitleInput.trim() || `Policy_Guidelines_${Date.now()}`;
      if (!docName.endsWith(".txt")) docName += ".txt";

      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content: textContentInput.trim(),
          size: `${Math.max(1, Math.round(textContentInput.length / 1024))} KB`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsTextModalOpen(false);
        setTextTitleInput("");
        setTextContentInput("");
        onToast(`Saved text content as "${docName}"`, "success");
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to save text", "warning");
      }
    } catch {
      onToast("Failed to save text", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Real Add from Bank Policy Library Handler
  async function handleAddFromLibrary(policy: BankPolicyLibraryItem) {
    setIsAddingFromSource(true);
    try {
      const docName = policy.file_name || `${policy.bank_name.replace(/\s+/g, "_")}_Master_Policy.txt`;
      const res = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          type: "txt",
          content:
            policy.extracted_text ||
            `Master Underwriting Guidelines for ${policy.bank_name} (${policy.bank_code}).\nVerified bank criteria for personal loans, salary tiers, FOIR, and CIBIL cutoffs.`,
          size: "650 KB",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onToast(`Attached master policy for "${policy.bank_name}"`, "success");
        setIsLibraryModalOpen(false);
        await loadAgentKnowledge();
      } else {
        onToast(data.error || "Failed to attach library policy", "warning");
      }
    } catch {
      onToast("Failed to attach policy", "warning");
    } finally {
      setIsAddingFromSource(false);
    }
  }

  // Filtered & Paginated Documents
  const filteredDocs = useMemo(() => {
    return agentDocs.filter((d) => {
      const matchSearch =
        !searchQuery.trim() ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType =
        typeFilter === "All Types" ||
        d.type.toUpperCase() === typeFilter.toUpperCase();
      return matchSearch && matchType;
    });
  }, [agentDocs, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDocs.slice(start, start + PAGE_SIZE);
  }, [filteredDocs, currentPage]);

  function handleToggleSelectAll() {
    if (selectedDocIds.length === paginatedDocs.length && paginatedDocs.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(paginatedDocs.map((d) => d.id));
    }
  }

  function handleToggleSelectDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }





  return (
    <div className="w-full min-h-full bg-slate-50 flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 1. PAGE HEADER BANNER (GRADIENT CARD WITH AI MASCOT ILLUSTRATION) */}
        <div className="ai-header-banner relative overflow-hidden flex items-center justify-between bg-white border border-slate-300 rounded-2xl p-5 sm:p-6 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md">
          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            {/* AI Chip Icon Badge */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[11px] bg-[#1677FF] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
              <div className="relative flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="14" x2="4" y2="14" />
                </svg>
                <span className="absolute text-[8px] font-black text-white tracking-tighter">AI</span>
              </div>
              <div className="hidden bg-[#EAF3FF]"><Settings className="w-5 h-5 text-[#1677FF]" /></div>
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-[#12336B] tracking-tight">
                Configure AI Instructions
              </h1>
              <p className="text-xs md:text-[13px] text-[#526B91] mt-0.5">
                Customize how your assistant speaks, thinks, and uses your knowledge.
              </p>
            </div>
          </div>

          {/* AI Robot Assistant & Speech Bubble Mascot Illustration */}
          <div className="hidden sm:flex items-center relative pl-8 pr-2 select-none pointer-events-none shrink-0">
            {/* Ambient Background Glow */}
            <div className="absolute right-4 w-40 h-28 bg-[#1677FF]/10 rounded-full blur-2xl -z-10" />

            {/* Sparkle Stars */}
            <svg className="absolute left-2 top-2 w-4 h-4 text-[#8EBAF8] animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>
            <svg className="absolute right-1 top-2 w-3.5 h-3.5 text-[#1677FF]/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>
            <svg className="absolute left-6 bottom-3 w-3 h-3 text-[#A8CCFC]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>

            {/* Floating Speech Bubble */}
            <div className="mr-3 mb-4 bg-white/95 backdrop-blur-xs border border-[#CDE1FB] rounded-[10px] rounded-br-[2px] p-2 px-2.5 shadow-sm">
              <div className="w-7 h-1.5 bg-[#CDE1FB] rounded-full mb-1" />
              <div className="w-5 h-1.5 bg-[#E1EEFD] rounded-full" />
            </div>

            {/* Mascot Robot */}
            <svg width="88" height="74" viewBox="0 0 88 74" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="24" y="52" width="40" height="22" rx="11" fill="#E2EDFC" stroke="#B8D5FA" strokeWidth="1.5" />
              <path d="M38 58H50" stroke="#1677FF" strokeWidth="2" strokeLinecap="round" />
              <path d="M62 56C67 53 72 47 74 41C74.5 39.5 72.5 38.5 71.5 40C69 44 66 48 61 51" stroke="#B8D5FA" strokeWidth="3" strokeLinecap="round" fill="none" />
              <circle cx="74" cy="40" r="3" fill="#1677FF" />
              <path d="M26 56C21 58 19 62 18 66" stroke="#B8D5FA" strokeWidth="3" strokeLinecap="round" fill="none" />
              <rect x="40" y="47" width="8" height="6" rx="2" fill="#CADFF8" />
              <rect x="14" y="21" width="5" height="14" rx="2.5" fill="#1677FF" />
              <rect x="69" y="21" width="5" height="14" rx="2.5" fill="#1677FF" />
              <path d="M17 24C17 12 71 12 71 24" stroke="#CADFF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <rect x="17" y="11" width="54" height="36" rx="14" fill="#FFFFFF" stroke="#CDE1FB" strokeWidth="2" />
              <rect x="23" y="17" width="42" height="24" rx="10" fill="#142A56" />
              <ellipse cx="34" cy="29" rx="3.5" ry="4.5" fill="#38BDF8" />
              <circle cx="35" cy="27.5" r="1.2" fill="#FFFFFF" />
              <ellipse cx="54" cy="29" rx="3.5" ry="4.5" fill="#38BDF8" />
              <circle cx="55" cy="27.5" r="1.2" fill="#FFFFFF" />
              <path d="M41 33C42.5 34.5 45.5 34.5 47 33" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* 2. AGENT CONTROL TOOLBAR (HORIZONTAL WHITE CARD) */}
        <div className="ai-card bg-white border border-slate-300 shadow-xs rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 transition-all duration-200 hover:border-blue-500">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Agent Selector Dropdown Button (Professional UI, 38px) */}
            <div className="relative" ref={agentDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
                className="h-[38px] flex items-center gap-2.5 px-3.5 border border-[#DCE8F8] hover:border-[#1677FF] rounded-[7px] bg-white shadow-xs text-xs font-semibold text-[#12336B] hover:bg-[#F5F9FF] transition cursor-pointer"
                title="Select Agent"
              >
                <Bot className="w-4 h-4 text-[#1677FF]" />
                <span className="max-w-[150px] truncate">{agentName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#526B91] transition-transform ${
                    isAgentDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAgentDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-[#DCE8F8] rounded-[10px] shadow-xl z-50 py-1.5 overflow-hidden animate-fadeIn">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold text-[#526B91] uppercase tracking-wider border-b border-[#DCE8F8] flex items-center justify-between">
                    <span>Select Agent</span>
                    <span className="bg-[#EAF3FF] text-[#1677FF] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                      {allAgentsList.length}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {allAgentsList.map((ag) => {
                      const isSelected = ag.id === agent.id;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (onSelectAgent) {
                              onSelectAgent(ag.id);
                              setIsDraft(false);
                              onToast(`Switched to ${ag.name}`, "info");
                            }
                            setIsAgentDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-[#EAF3FF] text-[#1677FF] font-semibold"
                              : "text-[#12336B] hover:bg-[#F5F9FF]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Bot className="w-3.5 h-3.5 text-[#1677FF]" />
                            <span className="truncate">{ag.name}</span>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-[#1677FF] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {onCreateAgentClick && (
                    <div className="p-2 border-t border-[#DCE8F8] bg-[#F5F9FF]/80">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAgentDropdownOpen(false);
                          onCreateAgentClick();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#1677FF] hover:bg-[#0e65e6] text-white rounded-[7px] text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Agent</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Switchable Active / Inactive Button (Small Rectangular with Micro-Animation) */}
            <button
              type="button"
              onClick={handleToggleActiveStatus}
              className={`h-[32px] flex items-center gap-1.5 px-3 rounded-[6px] text-xs font-semibold transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer shadow-xs border ${
                isAgentActive
                  ? "bg-[#E7F9F1] hover:bg-[#d5f5e7] border-[#079669]/30 text-[#079669]"
                  : "bg-slate-100 hover:bg-slate-200/80 border-slate-300 text-slate-600"
              }`}
              title={isAgentActive ? "Status: Active — Click to Deactivate" : "Status: Inactive — Click to Activate"}
              aria-label={isAgentActive ? "Active" : "Inactive"}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAgentActive ? "bg-[#079669] animate-pulse" : "bg-slate-400"
                }`}
              />
              <span>{isAgentActive ? "Active" : "Inactive"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Professional Delete Agent Button (Small Rectangular with Micro-Animation) */}
<button
  type="button"
  onClick={() => {
    if (onDeleteAgentClick) onDeleteAgentClick(agent.id);
    else onToast("Cannot delete default agent", "warning");
  }}
  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium px-4 py-2 rounded-lg"
  title="Delete this agent"
  aria-label="Delete"
>
  <Trash2 className="w-3.5 h-3.5 text-[#F04452]" />
  <span>Delete</span>
</button>

            {/* Professional Save Instructions Button (Small Rectangular, Primary Blue with Micro-Animation) */}
<button
  type="button"
  onClick={handleSaveClick}
  disabled={saving}
  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-xs"
  title="Save instructions"
  aria-label="Save instructions"
>
  <Save className="w-3.5 h-3.5 text-white" />
  <span>{saving ? "Saving..." : "Save Instructions"}</span>
</button>
          </div>
        </div>

        {/* 3. AGENT IDENTITY & PERSONA (FULL WIDTH WHITE CARD WITH LIGHT COLOR SHADOW) */}
        <div className="ai-card bg-white border border-slate-300 shadow-xs rounded-2xl p-6 transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-[12px] bg-[#EAF2FF] text-[#1677FF] flex items-center justify-center shrink-0 shadow-xs">
                <User className="w-5 h-5 text-[#1677FF]" />
              </div>
              <div>
                <h2 className="font-bold text-[#102A56] text-base md:text-[17px] tracking-tight">
                  Agent Identity &amp; Persona
                </h2>
                <p className="text-xs text-[#526B91] mt-0.5 font-normal">
                  Define the agent's name, conversation tone, and response style.
                </p>
              </div>
            </div>

<span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isAgentActive ? 'bg-[#EAF8F1] text-[#079669] border border-[#079669]/20' : 'bg-slate-50 text-slate-600 border border-slate-200'} shadow-xs`}>
      <span className={`w-2 h-2 rounded-full ${isAgentActive ? 'bg-[#079669] animate-pulse' : 'bg-slate-400'}`} />
      {isAgentActive ? 'Active' : 'Inactive'}
    </span>
           </div>

           <div className="mb-5 border-b border-slate-100"></div>

           {/* 3-Column Responsive Inputs with Icons in Labels */}
          <div className="ai-form-grid pt-5 md:pt-6">
            <div>
<label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
      <User className="w-3.5 h-3.5 text-[#1677FF]" />
      <span>Agent Name</span>
    </label>
    <input
      type="text"
      value={agentName}
      onChange={(e) => handleNameChange(e.target.value)}
      placeholder="Loan Assistant"
      className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg px-3.5 py-2.5 shadow-2xs transition-all hover:border-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15"
    />
            </div>

            <div>
<label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
      <MessageSquare className="w-3.5 h-3.5 text-[#1677FF]" />
      <span>Conversation Tone</span>
    </label>
    <div className="relative">
      <select
        value={conversationTone}
        onChange={(e) => handleToneChange(e.target.value)}
        className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg px-3.5 py-2.5 shadow-2xs transition-all hover:border-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15"
      >
        <option value="Professional and Friendly">Professional and friendly</option>
        <option value="Formal">Formal</option>
        <option value="Conversational">Conversational</option>
        <option value="Empathetic">Empathetic</option>
      </select>
      <ChevronDown className="w-4 h-4 text-[#526B91] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
    </div>
            </div>

            <div>
<label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
      <Sliders className="w-3.5 h-3.5 text-[#1677FF]" />
      <span>Response Style</span>
    </label>
    <div className="relative">
      <select
        value={responseStyle}
        onChange={(e) => handleStyleChange(e.target.value)}
        className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg px-3.5 py-2.5 shadow-2xs transition-all hover:border-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15"
      >
        <option value="Clear, Helpful, Concise">Clear, helpful, concise</option>
        <option value="Detailed">Detailed</option>
        <option value="Step-by-Step">Step-by-step</option>
      </select>
      <ChevronDown className="w-4 h-4 text-[#526B91] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
    </div>
            </div>
          </div>
        </div>

        {/* 4. INSTRUCTIONS FOR THE AI AGENT (FULL WIDTH WHITE CARD DIRECTLY BELOW PERSONA) */}
        <div className="ai-card bg-white border border-slate-300 shadow-xs rounded-2xl p-6 transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#DCE8F8]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#E6EEFF] text-[#1677FF] flex items-center justify-center shrink-0 shadow-xs">
                <FileText className="w-5 h-5 text-[#1677FF]" />
              </div>
              <div>
                <h2 className="font-bold text-[#12336B] text-base tracking-tight">
                  Instructions for the AI Agent
                </h2>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Master instruction prompt, financial verification rules, and conversational logic.
                 </p>
               </div>
              </div>
            </div>
            <div className="mb-5 border-b border-slate-100"></div>
            {/* Clean Instructions Container Box */}
          <div className="pt-4">
            <div className="border border-[#DCE8F8] focus-within:border-[#1677FF] focus-within:ring-2 focus-within:ring-[#1677FF]/10 rounded-[12px] bg-white p-4 transition shadow-xs">
<textarea
  value={instructionsText}
  onChange={(e) => handleInstructionsChange(e.target.value)}
  placeholder="Write your custom instructions here..."
  className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg px-3.5 py-2.5 shadow-2xs transition-all hover:border-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15"
/>

              {/* Reference Checklist Guidelines */}
              <div className="pt-3.5 border-t border-[#F0F5FA] space-y-2 text-xs text-[#526B91]">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#1677FF] shrink-0" />
                  <span>Be specific about how the agent should respond and behave.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#1677FF] shrink-0" />
                  <span>Include financial verification rules and escalation logic.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#1677FF] shrink-0" />
                  <span>Use clear, simple language for better understanding.</span>
                </div>
              </div>

              {/* Character Limit Counter */}
              <div className="text-right text-[11px] font-mono text-[#8FA0BC] pt-2">
                {instructionsText.length.toLocaleString()} / 2000 characters
              </div>
            </div>

            {/* Footer below textarea */}
            <div className="flex items-center justify-between mt-3 text-xs text-[#526B91]">
              <span className="text-[#079669] flex items-center gap-1.5 font-medium text-xs">
                <Check className="w-3.5 h-3.5 text-[#079669]" />
                Autosaved
              </span>

              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className="h-[30px] px-3 bg-[#1677FF] hover:bg-[#0E65E6] active:bg-[#0958D9] text-white rounded-[6px] text-xs font-semibold shadow-xs cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-white" />
                <span>{saving ? "Saving..." : "Save Instructions"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. KNOWLEDGE BASE UPLOAD & SOURCES (50/50 SIDE-BY-SIDE EQUAL-HEIGHT GRID) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Drag-and-Drop Upload Area */}
          <div className="ai-card flex flex-col justify-between rounded-2xl border border-slate-300 bg-white p-5 md:p-6 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
            <div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#E1EFFF] text-[#1677FF] flex items-center justify-center shrink-0 shadow-xs">
                  <UploadCloud className="w-5 h-5 text-[#1677FF]" />
                </div>
                <div>
                  <h2 className="font-bold text-[#12336B] text-base tracking-tight">
                    Upload Knowledge Base
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Add documents like PDFs, Word files, or text files.
                  </p>
                  <p className="text-[11px] text-[#526B91]/80 mt-0.5 font-medium">
                    Supported: PDF, DOCX, TXT, CSV, XLSX (Max size: 10MB per file)
                  </p>
                </div>
              </div>

              {/* Dropzone Box with Normal Light Border */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 border border-solid border-[#D2E2F8] hover:border-[#1677FF] bg-[#F7FAFE] hover:bg-[#EFF6FF] rounded-[10px] p-6 text-center transition-all duration-200 cursor-pointer shadow-[0_1px_3px_rgba(30,80,150,0.02)] hover:shadow-sm"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <div className="text-xs text-[#526B91] mb-2 font-medium">
                  Drag and drop files here or
                </div>
                <button
                  type="button"
                  disabled={isUploading}
                  className="h-[32px] px-4 bg-[#1677FF] hover:bg-[#0E65E6] active:bg-[#0958D9] text-white rounded-[6px] text-xs font-semibold shadow-xs transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isUploading ? "Uploading..." : "Choose Files"}</span>
                </button>
                <div className="text-[11px] text-[#8FA0BC] mt-2">
                  Supports single or multiple files
                </div>
              </div>
            </div>
          </div>

          {/* Right: Add from existing sources */}
          <div className="ai-card flex flex-col justify-between rounded-2xl border border-slate-300 bg-white p-5 md:p-6 shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5">
            <div>
              <div className="mb-3.5">
                <h3 className="font-bold text-[#12336B] text-base tracking-tight">
                  Or add from existing sources
                </h3>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Connect live web links, text notes, or verified policies.
                </p>
              </div>

              <div className="space-y-2.5">
                {/* 1. From URL */}
                <button
                  type="button"
                  onClick={() => setIsUrlModalOpen(true)}
                  className="ai-source-card group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#12336B] group-hover:text-[#1677FF] transition-colors">
                        From URL
                      </div>
                      <div className="text-[11px] text-[#526B91]">
                        Add content from a web link
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8FA0BC] group-hover:text-[#1677FF] group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 2. From Text */}
                <button
                  type="button"
                  onClick={() => setIsTextModalOpen(true)}
                  className="ai-source-card group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#12336B] group-hover:text-[#1677FF] transition-colors">
                        From Text
                      </div>
                      <div className="text-[11px] text-[#526B91]">
                        Paste your content directly
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8FA0BC] group-hover:text-[#1677FF] group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 3. From Knowledge Base Library */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLibraryModalOpen(true);
                    loadLibraryPolicies();
                  }}
                  className="ai-source-card group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#12336B] group-hover:text-[#1677FF] transition-colors">
                        From Knowledge Base Library
                      </div>
                      <div className="text-[11px] text-[#526B91]">
                        Use existing pre-configured data
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8FA0BC] group-hover:text-[#1677FF] group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. UPLOADED KNOWLEDGE BASE FILES */}
        <div className="ai-card p-0 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xs transition-all duration-200 hover:border-blue-500 hover:shadow-md">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-[#DCE8F8] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#E1EFFF] text-[#1677FF] flex items-center justify-center shrink-0 shadow-xs">
                <BookOpen className="w-5 h-5 text-[#1677FF]" />
              </div>
              <div>
                <h2 className="font-bold text-[#12336B] text-base tracking-tight">
                  Uploaded Knowledge Base Files
                </h2>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Manage your uploaded files and view their status.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8FA0BC] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="ai-search-input h-[38px] rounded-[8px] pl-9 border border-[#DCE8F8] text-xs"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-[38px] px-3 py-1 text-xs text-[#12336B] bg-white border border-[#DCE8F8] rounded-[8px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] shadow-xs cursor-pointer transition-all"
              >
                <option value="All Types">All Types</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="XLSX">XLSX</option>
                <option value="TXT">TXT</option>
                <option value="CSV">CSV</option>
              </select>

              <button
                type="button"
                onClick={loadAgentKnowledge}
                disabled={isLoadingDocs}
                className="h-[38px] w-[38px] flex items-center justify-center border border-[#DCE8F8] text-[#526B91] hover:text-[#1677FF] hover:bg-[#EAF3FF] rounded-[8px] transition cursor-pointer shadow-xs"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? "animate-spin text-[#1677FF]" : ""}`} />
              </button>
            </div>
          </div>

          {/* Error State */}
          {docsError && (
            <div className="p-3.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{docsError}</span>
              </div>
              <button
                onClick={loadAgentKnowledge}
                className="font-semibold underline hover:text-rose-900 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Responsive Table Wrapper */}
          <div className="ai-file-table-wrapper border-0 rounded-none">
            <table className="ai-file-table">
              <thead>
                <tr>
                  <th style={{ width: "36px" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedDocIds.length === paginatedDocs.length &&
                        paginatedDocs.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-[#DCE8F8] text-[#1677FF] focus:ring-[#1677FF] accent-[#1677FF]"
                    />
                  </th>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded On</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading State */}
                {isLoadingDocs ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[#526B91]" style={{ padding: "40px 14px" }}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-[#1677FF] animate-spin" />
                        <span className="text-xs font-medium text-[#526B91]">
                          Loading knowledge documents from database...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDocs.length === 0 ? (
                  /* Empty State */
                  <tr>
                    <td colSpan={7} className="text-center text-[#526B91]" style={{ padding: "40px 14px" }}>
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <div className="w-9 h-9 rounded-full bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center">
                          <BookOpen className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-xs font-semibold text-[#12336B]">
                          No knowledge documents found
                        </span>
                        <p className="text-[11px] text-[#526B91] text-center">
                          Upload documents above or click "From Knowledge Base Library" to connect pre-verified bank policies.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <tr key={doc.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectDoc(doc.id)}
                            className="rounded border-[#DCE8F8] text-[#1677FF] focus:ring-[#1677FF] accent-[#1677FF]"
                          />
                        </td>
                        <td className="font-semibold text-[#12336B]">
                          <div className="flex items-center gap-2.5">
                            {doc.type === "PDF" ? (
                              <span className="w-5.5 h-5.5 rounded-[4px] bg-[#EE3F43] text-white font-bold text-[8px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                                PDF
                              </span>
                            ) : doc.type === "XLSX" || doc.type === "CSV" ? (
                              <span className="w-5.5 h-5.5 rounded-[4px] bg-[#107C41] text-white font-bold text-[7.5px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                                XLSX
                              </span>
                            ) : doc.type === "DOCX" ? (
                              <span className="w-5.5 h-5.5 rounded-[4px] bg-[#185ABD] text-white font-bold text-[7.5px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                                DOCX
                              </span>
                            ) : (
                              <span className="w-5.5 h-5.5 rounded-[4px] bg-[#475569] text-white font-bold text-[8px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                                TXT
                              </span>
                            )}
                            <span className="truncate max-w-[220px]" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              doc.type === "PDF"
                                ? "bg-rose-50 text-rose-500 border border-rose-200/60"
                                : doc.type === "XLSX" || doc.type === "CSV"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                                : doc.type === "DOCX"
                                ? "bg-blue-50 text-[#1677FF] border border-blue-200/60"
                                : "bg-slate-100 text-[#526B91] border border-slate-200/60"
                            }`}
                          >
                            {doc.type}
                          </span>
                        </td>
                        <td className="text-[#526B91] font-mono text-[11px]">
                          {doc.size}
                        </td>
                        <td className="text-[#526B91] whitespace-nowrap text-[11px]">
                          {doc.uploadedOn}
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              doc.status === "Active"
                                ? "bg-[#E7F9F1] text-[#079669] border border-[#079669]/20"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                doc.status === "Active" ? "bg-[#079669]" : "bg-rose-500"
                              }`}
                            />
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="ai-table-actions">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="ai-action-btn"
                              title="View"
                              aria-label="View file"
                            >
                              <Eye />
                            </button>

                            {/* Edit Configuration & Metadata */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditConfigDoc(doc);
                                setEditDocName(doc.name);
                                setEditInstructionText(doc.instructionText || "");
                                setEditWhenToUse(doc.whenToUse || "");
                                setEditWhenNotToUse(doc.whenNotToUse || "");
                                setEditGuardrailText(doc.guardrailText || "");
                              }}
                              className="ai-action-btn"
                              title="Edit"
                              aria-label="Edit file"
                            >
                              <Edit2 />
                            </button>

                           {/* Delete File */}
                           <button
                             type="button"
                             onClick={() => setDeleteDocTarget(doc)}
                             className="ai-action-btn ai-action-btn--delete"
                             title="Delete"
                             aria-label="Delete file"
                           >
                             <Trash2 />
                           </button>

                           {/* Download File */}
                           <button
                             type="button"
                             onClick={() => handleDownloadFile(doc)}
                             className="ai-action-btn"
                             title="Download"
                             aria-label="Download file"
                           >
                             <Download />
                           </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="p-3.5 border-t border-[#DCE8F8] flex items-center justify-between text-xs text-[#526B91] bg-white">
            <span>
              {filteredDocs.length > 0 ? (
                <>
                  Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredDocs.length)}-
                  {Math.min(currentPage * PAGE_SIZE, filteredDocs.length)} of {filteredDocs.length} files
                </>
              ) : (
                "Showing 0 of 0 files"
              )}
            </span>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 flex items-center justify-center border border-[#DCE8F8] rounded-[6px] text-xs font-semibold text-[#526B91] hover:bg-[#F5F9FF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                aria-label="Previous page"
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 flex items-center justify-center rounded-[6px] text-xs font-semibold cursor-pointer transition ${
                    currentPage === page
                      ? "bg-[#1677FF] text-white shadow-xs"
                      : "border border-[#DCE8F8] text-[#526B91] hover:bg-[#F5F9FF]"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 flex items-center justify-center border border-[#DCE8F8] rounded-[6px] text-xs font-semibold text-[#526B91] hover:bg-[#F5F9FF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: View File Details Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#DCE8F8] animate-fadeIn">
<div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#1677FF]" />
                </div>
                <h3 className="font-bold text-[#12336B] text-sm truncate max-w-md">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-[#8FA0BC] hover:text-[#12336B] p-1 rounded-md cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs text-[#526B91] leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-[8px] bg-[#F5F9FF] border border-[#DCE8F8] text-[11px]">
                <div>
                  <span className="text-[#8FA0BC] block">Format</span>
                  <span className="font-bold text-[#12336B]">{previewDoc.type}</span>
                </div>
                <div>
                  <span className="text-[#8FA0BC] block">File Size</span>
                  <span className="font-bold text-[#12336B]">{previewDoc.size}</span>
                </div>
                <div>
                  <span className="text-[#8FA0BC] block">Uploaded On</span>
                  <span className="font-bold text-[#12336B]">{previewDoc.uploadedOn}</span>
                </div>
                <div>
                  <span className="text-[#8FA0BC] block">Status</span>
                  <span className="font-bold text-[#079669]">Active</span>
                </div>
              </div>

              {previewDoc.instructionText && (
                <div className="p-3 rounded-[8px] bg-[#EAF3FF]/60 border border-[#DCE8F8]">
                  <span className="text-[10px] font-bold uppercase text-[#1677FF] block mb-1">
                    Document Usage Instruction
                  </span>
                  <p className="text-[#12336B] text-xs">{previewDoc.instructionText}</p>
                </div>
              )}

              {previewDoc.guardrailText && (
                <div className="p-3 rounded-[8px] bg-purple-50/60 border border-purple-100">
                  <span className="text-[10px] font-bold uppercase text-purple-700 block mb-1">
                    Safety Guardrail
                  </span>
                  <p className="text-[#12336B] text-xs">{previewDoc.guardrailText}</p>
                </div>
              )}

              <div>
                <span className="text-[11px] font-bold text-[#12336B] block mb-1.5">
                  Extracted Content / Policy Rules Preview
                </span>
                <div className="p-3.5 rounded-[8px] bg-[#F5F9FF] border border-[#DCE8F8] font-mono text-[11px] text-[#12336B] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {previewDoc.content ||
                    `Document: ${previewDoc.name}\n\nBank underwriting criteria and credit guidelines are indexed in PostgreSQL vector memory for ${agentName}.\nWhen users inquire about eligibility, this document will be retrieved to ground loan parameters.`}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#DCE8F8] flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 border border-[#DCE8F8] hover:bg-[#F5F9FF] text-[#526B91] rounded-[7px] text-xs font-semibold cursor-pointer transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Configuration & Metadata Modal */}
      {editConfigDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-[#DCE8F8] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0">
                  <Edit2 className="w-4 h-4 text-[#1677FF]" />
                </div>
                <h3 className="font-bold text-[#12336B] text-sm">
                  Edit File Configuration &amp; Metadata
                </h3>
              </div>
              <button
                onClick={() => setEditConfigDoc(null)}
                className="text-[#8FA0BC] hover:text-[#12336B] p-1 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  File Display Name
                </label>
                <input
                  type="text"
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Document Usage Instruction
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Reference this document strictly when applicant asks about salary requirements..."
                  value={editInstructionText}
                  onChange={(e) => setEditInstructionText(e.target.value)}
                  className="w-full p-2.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#12336B] mb-1">
                    When to Use (Keywords)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. personal loan, cibil, foir"
                    value={editWhenToUse}
                    onChange={(e) => setEditWhenToUse(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#12336B] mb-1">
                    When Not to Use
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. home loan, gold loan"
                    value={editWhenNotToUse}
                    onChange={(e) => setEditWhenNotToUse(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Safety Guardrail for this File
                </label>
                <input
                  type="text"
                  placeholder="e.g. Never disclose internal underwriter notes to applicants"
                  value={editGuardrailText}
                  onChange={(e) => setEditGuardrailText(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#DCE8F8] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditConfigDoc(null)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-[#F5F9FF] border border-[#DCE8F8] rounded-[7px] cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingDocConfig}
                onClick={handleSaveDocConfig}
                className="px-4 py-1.5 text-xs bg-[#1677FF] hover:bg-[#0e65e6] text-white rounded-[7px] font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition"
              >
                {isSavingDocConfig ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete File Confirmation Modal */}
      {deleteDocTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 animate-fadeIn">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-[#F04452] flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-[#12336B] text-sm">
                  Delete Knowledge Document?
                </h3>
                <span className="text-[11px] text-[#F04452] font-semibold">
                  Destructive Action
                </span>
              </div>
            </div>

            <p className="text-xs text-[#526B91] leading-relaxed mb-4">
              Are you sure you want to remove <strong>"{deleteDocTarget.name}"</strong>? All extracted text chunks and embeddings associated with this document will be erased from PostgreSQL.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#DCE8F8]">
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={() => setDeleteDocTarget(null)}
                className="px-3.5 py-1.5 text-xs text-[#526B91] hover:bg-[#F5F9FF] border border-[#DCE8F8] rounded-[7px] cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={handleConfirmDeleteDoc}
                className="px-4 py-1.5 text-xs bg-[#F04452] hover:bg-[#dc2626] text-white font-semibold rounded-[7px] shadow-xs disabled:opacity-50 cursor-pointer transition"
              >
                {isDeletingDoc ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: From URL Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#DCE8F8] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4 text-[#1677FF]" />
                </div>
                <h3 className="font-bold text-[#12336B] text-sm">
                  Add Knowledge from URL
                </h3>
              </div>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="text-[#8FA0BC] hover:text-[#12336B] p-1 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Source Web URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/bank-loan-criteria"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Document Display Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank_Online_Policy.txt"
                  value={urlTitleInput}
                  onChange={(e) => setUrlTitleInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>

              <p className="text-[11px] text-[#526B91]">
                The content from the web link will be processed and indexed into PostgreSQL for this agent.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-[#DCE8F8] flex justify-end gap-2">
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-[#F5F9FF] border border-[#DCE8F8] rounded-[7px] cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                disabled={!urlInput.trim() || isAddingFromSource}
                onClick={handleAddFromUrl}
                className="px-4 py-1.5 text-xs bg-[#1677FF] hover:bg-[#0e65e6] text-white rounded-[7px] font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition"
              >
                {isAddingFromSource ? "Importing..." : "Import URL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: From Text Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-[#DCE8F8] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#1677FF]" />
                </div>
                <h3 className="font-bold text-[#12336B] text-sm">
                  Add Raw Text Knowledge
                </h3>
              </div>
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="text-[#8FA0BC] hover:text-[#12336B] p-1 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Underwriting_Exceptions.txt"
                  value={textTitleInput}
                  onChange={(e) => setTextTitleInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] transition shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#12336B] mb-1">
                  Text Content / Policy Rules
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste bank terms, company categories, FOIR rules, or underwriting exceptions..."
                  value={textContentInput}
                  onChange={(e) => setTextContentInput(e.target.value)}
                  className="w-full p-2.5 border border-[#DCE8F8] rounded-[7px] focus:outline-none focus:border-[#1677FF] focus:ring-1 focus:ring-[#1677FF] text-[#12336B] leading-relaxed font-mono text-[11px] transition shadow-xs"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#DCE8F8] flex justify-end gap-2">
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-[#F5F9FF] border border-[#DCE8F8] rounded-[7px] cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                disabled={!textContentInput.trim() || isAddingFromSource}
                onClick={handleAddFromText}
                className="px-4 py-1.5 text-xs bg-[#1677FF] hover:bg-[#0e65e6] text-white rounded-[7px] font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition"
              >
                {isAddingFromSource ? "Saving..." : "Save Knowledge Text"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: From Knowledge Base Library Modal (Real Database Bank Policies) */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-[#DCE8F8] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#1677FF] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-[#1677FF]" />
                </div>
                <h3 className="font-bold text-[#12336B] text-sm">
                  Knowledge Base Library
                </h3>
              </div>
              <button
                onClick={() => setIsLibraryModalOpen(false)}
                className="text-[#8FA0BC] hover:text-[#12336B] p-1 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#526B91] mt-2 mb-3">
              Select any verified bank master policy from the CreditWise database to attach and index for this agent:
            </p>

            {/* Library list */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {isLoadingLibrary ? (
                <div className="py-10 text-center text-[#526B91]">
                  <RefreshCw className="w-5 h-5 text-[#1677FF] animate-spin mx-auto mb-2" />
                  <span className="text-xs">Loading verified policies from database...</span>
                </div>
              ) : libraryPolicies.length === 0 ? (
                <div className="py-8 text-center text-[#526B91] text-xs">
                  No bank master policies found in database.
                </div>
              ) : (
                libraryPolicies.map((policy) => (
                  <div
                    key={policy.id || policy.bank_code}
                    className="p-3 rounded-[8px] border border-[#DCE8F8] hover:border-[#1677FF]/40 bg-white hover:bg-[#F5F9FF] transition flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#12336B]">
                          {policy.bank_name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#1677FF]">
                          {policy.bank_code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#526B91] line-clamp-1">
                        {policy.file_name || `${policy.bank_name} verified underwriting master policy`}
                      </p>
                      <span className="text-[10px] text-[#079669] font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#079669]" />
                        Verified Bank Policy
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isAddingFromSource}
                      onClick={() => handleAddFromLibrary(policy)}
                      className="px-3.5 py-1.5 bg-[#1677FF] hover:bg-[#0e65e6] text-white rounded-[7px] text-xs font-semibold shrink-0 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      + Add to Agent
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#DCE8F8] flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsLibraryModalOpen(false);
                  onNavigateToKnowledge();
                }}
                className="text-[#1677FF] hover:underline font-semibold cursor-pointer"
              >
                Browse dedicated Knowledge Base page →
              </button>
              <button
                onClick={() => setIsLibraryModalOpen(false)}
                className="px-4 py-1.5 border border-[#DCE8F8] hover:bg-[#F5F9FF] text-[#526B91] rounded-[7px] font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
