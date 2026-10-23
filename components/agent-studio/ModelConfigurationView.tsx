// components/agent-studio/ModelConfigurationView.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  Check,
  Copy,
  RotateCw,
  Search,
  Bot,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
  Activity,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
  Server,
  Zap,
  Star,
  Network,
  Pencil,
} from "lucide-react";

export type ModelProvider = "openai" | "anthropic" | "google" | "groq" | "ollama" | "custom";

export type ModelPurpose =
  | "General Chat"
  | "Complex Reasoning & Policy RAG"
  | "Fast Extraction & Guardrails"
  | "Embeddings & Vector Search"
  | "Underwriting / Eligibility Engine";

export interface RegisteredModel {
  id: string;
  name: string;
  model_id: string;
  provider: ModelProvider | string;
  purpose: ModelPurpose | string;
  is_assistant_default: boolean;
  created_at?: string;
  assignedAgents?: string[];
  usageStatus?: string;
  route_via_gateway?: boolean;
}

export interface ProviderKeyItem {
  id: string;
  name: string;
  defaultBaseUrl: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  updatedAt: string | null;
  isCustom?: boolean;
}

interface ModelConfigurationViewProps {
  onToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

const PROVIDER_OPTIONS: { id: ModelProvider; label: string }[] = [
  { id: "custom", label: "OpenRouter / Custom Gateway" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google Gemini" },
  { id: "groq", label: "Groq LPU" },
  { id: "ollama", label: "Ollama (Self-Hosted)" },
];

const PURPOSE_OPTIONS: ModelPurpose[] = [
  "General Chat",
  "Complex Reasoning & Policy RAG",
  "Fast Extraction & Guardrails",
  "Embeddings & Vector Search",
  "Underwriting / Eligibility Engine",
];

export default function ModelConfigurationView({ onToast }: ModelConfigurationViewProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"models" | "keys" | "usage">("models");

  // Models state
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [purposeFilter, setPurposeFilter] = useState<string>("ALL");

  // Provider keys state
  const [providers, setProviders] = useState<ProviderKeyItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<boolean>(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<RegisteredModel | null>(null);
  const [editFormName, setEditFormName] = useState<string>("");
  const [editFormModelId, setEditFormModelId] = useState<string>("");
  const [editFormProvider, setEditFormProvider] = useState<ModelProvider>("custom");
  const [editFormPurpose, setEditFormPurpose] = useState<ModelPurpose>("General Chat");
  const [editFormIsDefault, setEditFormIsDefault] = useState<boolean>(false);
  const [editFormRouteViaGateway, setEditFormRouteViaGateway] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [modelToDelete, setModelToDelete] = useState<RegisteredModel | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Key Edit Modal state
  const [keyModalProvider, setKeyModalProvider] = useState<ProviderKeyItem | null>(null);
  const [newApiKey, setNewApiKey] = useState<string>("");
  const [newBaseUrl, setNewBaseUrl] = useState<string>("");
  const [showRawKey, setShowRawKey] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  // Custom Provider Modal state
  const [showCustomProviderModal, setShowCustomProviderModal] = useState<boolean>(false);
  const [customProviderName, setCustomProviderName] = useState<string>("");
  const [customProviderId, setCustomProviderId] = useState<string>("");
  const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState<string>("");
  const [customProviderKey, setCustomProviderKey] = useState<string>("");

  // Add Model Form state
  const [formName, setFormName] = useState<string>("");
  const [formModelId, setFormModelId] = useState<string>("");
  const [formProvider, setFormProvider] = useState<ModelProvider>("custom");
  const [formPurpose, setFormPurpose] = useState<ModelPurpose>("General Chat");
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);
  const [formRouteViaGateway, setFormRouteViaGateway] = useState<boolean>(true);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch models
  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/admin/registered-models");
      const data = await res.json();
      if (data.success && Array.isArray(data.models)) {
        setModels(data.models);
      } else {
        onToast(data.error || "Failed to load registered models", "warning");
      }
    } catch (err: any) {
      onToast("Network error fetching models", "warning");
    } finally {
      setLoadingModels(false);
    }
  };

  // Fetch provider keys
  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch("/api/admin/provider-keys");
      const data = await res.json();
      if (data.success && Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
    } catch (err: any) {
      console.error("Failed to load provider keys", err);
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchModels();
    fetchProviders();
  }, []);

  // Handle register model submit
  const handleRegisterModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formModelId.trim()) {
      onToast("Please provide both model name and model identifier string.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formName.trim(),
        model_id: formModelId.trim(),
        provider: formProvider,
        purpose: formPurpose,
        is_assistant_default: formIsDefault,
        route_via_gateway: formRouteViaGateway,
      };

      let res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        res = await fetch("/api/admin/registered-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        onToast(`Model "${formName}" registered successfully!`, "success");
        setShowAddModal(false);
        // Reset form
        setFormName("");
        setFormModelId("");
        setFormProvider("custom");
        setFormPurpose("General Chat");
        setFormIsDefault(false);
        setFormRouteViaGateway(true);
        fetchModels();
      } else {
        onToast(data.message || data.error || "Failed to register model", "warning");
      }
    } catch {
      onToast("Error saving model. Please try again.", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle set as assistant default
  const handleSetDefault = async (model: RegisteredModel) => {
    if (model.is_assistant_default) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registered-models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_assistant_default: true }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`"${model.name}" is now the primary AI Assistant default model.`, "success");
        fetchModels();
      } else {
        onToast(data.error || "Failed to update default model", "warning");
      }
    } catch {
      onToast("Network error updating default model", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle open edit modal
  const handleOpenEdit = (model: RegisteredModel) => {
    setEditingModel(model);
    setEditFormName(model.name);
    setEditFormModelId(model.model_id);
    setEditFormProvider((model.provider as ModelProvider) || "custom");
    setEditFormPurpose((model.purpose as ModelPurpose) || "General Chat");
    setEditFormIsDefault(Boolean(model.is_assistant_default));
    setEditFormRouteViaGateway(model.route_via_gateway !== false);
    setShowEditModal(true);
  };

  // Handle edit model submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;
    if (!editFormName.trim() || !editFormModelId.trim()) {
      onToast("Please provide both model name and model identifier string.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: editFormName.trim(),
        model_id: editFormModelId.trim(),
        provider: editFormProvider,
        purpose: editFormPurpose,
        is_assistant_default: editFormIsDefault,
        route_via_gateway: editFormRouteViaGateway,
      };

      const res = await fetch(`/api/admin/registered-models/${editingModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onToast(`Model "${editFormName}" updated successfully!`, "success");
        setShowEditModal(false);
        setEditingModel(null);
        fetchModels();
      } else {
        onToast(data.message || data.error || "Failed to update model", "warning");
      }
    } catch {
      onToast("Error updating model. Please try again.", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete model
  const handleDeleteConfirm = async () => {
    if (!modelToDelete) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registered-models/${modelToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Model "${modelToDelete.name}" deleted.`, "info");
        setShowDeleteModal(false);
        setModelToDelete(null);
        fetchModels();
      } else {
        onToast(data.error || "Failed to delete model", "warning");
      }
    } catch {
      onToast("Error deleting model", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Copy model ID
  const handleCopyId = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onToast("Model ID copied to clipboard", "info");
  };

  // Test provider connection
  const handleTestProvider = async (providerId: string, customKey?: string, customBaseUrl?: string) => {
    setTestingKey(true);
    setTestResult(null);
    try {
      let res = await fetch("/api/admin/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          api_key: customKey || undefined,
          base_url: customBaseUrl || undefined,
        }),
      });

      if (!res.ok) {
        res = await fetch("/api/admin/provider-keys/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: providerId,
            api_key: customKey || undefined,
            base_url: customBaseUrl || undefined,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || "Connection active and responsive",
          latencyMs: data.latencyMs,
        });
        onToast(`Connection verified (${data.latencyMs}ms)`, "success");
      } else {
        const isAuthErr = res.status === 401 || /user not found|unauthorized|invalid.*key/i.test(`${data.error || ""} ${data.details || ""}`);
        const errMsg = isAuthErr
          ? "The saved OpenRouter API key is invalid or revoked. Please update your API key in AI Agent Studio Settings."
          : (data.error || data.details || "Connection test failed");
        setTestResult({
          success: false,
          message: errMsg,
        });
        onToast(`Authentication failed: ${errMsg}`, "warning");
      }
    } catch (err: any) {
      const errMsg = err.message || "Network timeout testing provider";
      setTestResult({
        success: false,
        message: errMsg,
      });
      onToast(`Authentication failed: ${errMsg}`, "warning");
    } finally {
      setTestingKey(false);
    }
  };

  // Save updated provider key
  const handleSaveProviderKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyModalProvider) return;
    if (!newApiKey.trim()) {
      onToast("Please enter an API key", "warning");
      return;
    }

    setActionLoading(true);
    try {
      let res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: keyModalProvider.id,
          api_key: newApiKey.trim(),
          base_url: newBaseUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        res = await fetch("/api/admin/provider-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: keyModalProvider.id,
            api_key: newApiKey.trim(),
            base_url: newBaseUrl.trim() || undefined,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        onToast(data.message || "Key saved successfully", "success");
        setKeyModalProvider(null);
        setNewApiKey("");
        setNewBaseUrl("");
        setTestResult(null);
        fetchProviders();
      } else {
        onToast(data.error || "Failed to save key", "warning");
      }
    } catch {
      onToast("Error updating key", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Save new custom provider
  const handleSaveCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customProviderName.trim() || !customProviderId.trim() || !customProviderBaseUrl.trim()) {
      onToast("Provider name, identifier, and base URL are required.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      let res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: customProviderId.trim().toLowerCase(),
          name: customProviderName.trim(),
          api_key: customProviderKey.trim() || "sk-custom-placeholder",
          base_url: customProviderBaseUrl.trim(),
        }),
      });

      if (!res.ok) {
        res = await fetch("/api/admin/provider-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: customProviderId.trim().toLowerCase(),
            name: customProviderName.trim(),
            api_key: customProviderKey.trim() || "sk-custom-placeholder",
            base_url: customProviderBaseUrl.trim(),
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        onToast(`Custom provider "${customProviderName}" added successfully!`, "success");
        setShowCustomProviderModal(false);
        setCustomProviderName("");
        setCustomProviderId("");
        setCustomProviderBaseUrl("");
        setCustomProviderKey("");
        fetchProviders();
      } else {
        onToast(data.error || "Failed to add custom provider", "warning");
      }
    } catch {
      onToast("Error saving custom provider", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProvider = providerFilter === "ALL" || m.provider.toLowerCase() === providerFilter.toLowerCase();
      const matchesPurpose = purposeFilter === "ALL" || m.purpose.toLowerCase() === purposeFilter.toLowerCase();
      return matchesSearch && matchesProvider && matchesPurpose;
    });
  }, [models, searchQuery, providerFilter, purposeFilter]);

  // Active default model
  const activeDefaultModel = useMemo(() => {
    return models.find((m) => m.is_assistant_default) || null;
  }, [models]);

  // Provider badge renderer
  const renderProviderBadge = (provider: string, routeViaGateway?: boolean) => {
    const p = provider.toLowerCase();
    let bg = "bg-slate-100 text-slate-800 border-slate-300";
    let label = provider.toUpperCase();

    if (p.includes("openai")) {
      bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      label = "OPENAI";
    } else if (p.includes("anthropic")) {
      bg = "bg-amber-50 text-amber-700 border-amber-200";
      label = "ANTHROPIC";
    } else if (p.includes("google")) {
      bg = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      label = "GOOGLE GEMINI";
    } else if (p.includes("groq")) {
      bg = "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      label = "GROQ";
    } else if (p.includes("custom") || p.includes("openrouter")) {
      bg = "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      label = "OPENROUTER / GATEWAY";
    } else if (p.includes("ollama")) {
      bg = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";
      label = "OLLAMA";
    }

    const isRoutedViaGateway = routeViaGateway !== false || p === "custom" || p.includes("openrouter");

    return (
      <div className="space-y-1">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bg}`}>
          <Server className="w-3 h-3" />
          {label}
        </span>
        {isRoutedViaGateway && p !== "ollama" && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium" title="Routes via OpenRouter multi-provider key">
            <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">OpenRouter Gateway (Inherited Key)</span>
          </div>
        )}
      </div>
    );
  };

  // Purpose badge renderer
  const renderPurposeBadge = (purpose: string) => {
    let style = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    if (purpose.includes("Underwriting") || purpose.includes("Eligibility")) {
      style = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    } else if (purpose.includes("Complex Reasoning") || purpose.includes("Policy RAG")) {
      style = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    } else if (purpose.includes("Fast Extraction") || purpose.includes("Guardrails")) {
      style = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    } else if (purpose.includes("Embeddings")) {
      style = "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
        <Sparkles className="w-3 h-3 opacity-70" />
        {purpose}
      </span>
    );
  };

  return (
    <div className="w-full flex-1 bg-slate-50 dark:bg-slate-950 min-h-full overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Model & Provider Management</h1>
            <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              Production Routing
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure LLM engines, manage API provider credentials, and inspect live assistant bindings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchModels();
              fetchProviders();
            }}
            disabled={loadingModels || loadingProviders}
            className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RotateCw className={`w-4 h-4 ${(loadingModels || loadingProviders) ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Model
          </button>
        </div>
      </div>

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Default Model Card */}
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/30 dark:border-blue-500/40 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-950/30 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Assistant Default</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="mt-2">
            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
              {activeDefaultModel ? activeDefaultModel.name : "Not Configured"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
              {activeDefaultModel ? activeDefaultModel.model_id : "No default selected"}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active on CreditWise Assistant
          </div>
        </div>

        {/* Registered Models Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Configured Models</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{models.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">models registered</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Available across all underwriting tools</div>
        </div>

        {/* Provider API Keys Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Providers</span>
            <Key className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {providers.filter((p) => p.hasKey).length} / {providers.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">keys verified</span>
          </div>
          <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">OpenRouter & Custom Gateway live</div>
        </div>

        {/* Agent Bindings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Agent Bindings</span>
            <Bot className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">4</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">active assistants</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Multi-Bank, Guardrail, RAG, QA</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab("models")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "models"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <Cpu className="w-4 h-4" />
            Registered Models ({models.length})
          </button>

          <button
            onClick={() => setActiveTab("keys")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "keys"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <Key className="w-4 h-4" />
            Provider API Keys
          </button>

          <button
            onClick={() => setActiveTab("usage")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "usage"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <Network className="w-4 h-4" />
            Agent & Assistant Bindings
          </button>
        </nav>
      </div>

      {/* TAB 1: REGISTERED MODELS */}
      {activeTab === "models" && (
        <div className="w-full space-y-4">
          {/* Filter Bar */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, model ID, or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Providers</option>
                <option value="custom">Custom / OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="groq">Groq</option>
                <option value="ollama">Ollama</option>
              </select>

              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Purposes</option>
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              {/* + Add Model Button */}
              <button
                type="button"
                onClick={() => {
                  setFormName("");
                  setFormModelId("");
                  setFormProvider("custom");
                  setFormPurpose("General Chat");
                  setFormIsDefault(false);
                  setFormRouteViaGateway(true);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Register New AI Model"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Model</span>
              </button>
            </div>
          </div>

          {/* Models Table */}
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            {loadingModels ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-sm">Loading configured models...</p>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <Cpu className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-medium text-slate-700 dark:text-slate-300">No models match your filters.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try resetting your search query or provider filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Model Name & ID</th>
                      <th className="px-5 py-3.5">Provider</th>
                      <th className="px-5 py-3.5">Assigned Purpose</th>
                      <th className="px-5 py-3.5">Assistant Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredModels.map((model) => (
                      <tr key={model.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                        {/* Name & ID */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{model.name}</span>
                            {model.is_assistant_default && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Star className="w-3 h-3 fill-amber-500" />
                                PRIMARY DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700">
                              {model.model_id}
                            </code>
                            <button
                              onClick={() => handleCopyId(model.id, model.model_id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                              title="Copy identifier"
                            >
                              {copiedId === model.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Provider */}
                        <td className="px-5 py-4">{renderProviderBadge(model.provider, model.route_via_gateway)}</td>

                        {/* Purpose */}
                        <td className="px-5 py-4">{renderPurposeBadge(model.purpose)}</td>

                        {/* Assistant Status */}
                        <td className="px-5 py-4">
                          {model.is_assistant_default ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Active Assistant Engine
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Standby / Dedicated Purpose
                            </div>
                          )}
                          {model.assignedAgents && model.assignedAgents.length > 0 && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate max-w-xs">
                              {model.assignedAgents.join(", ")}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!model.is_assistant_default && (
                              <button
                                onClick={() => handleSetDefault(model)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
                              >
                                Set as Default
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEdit(model)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit model"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setModelToDelete(model);
                                setShowDeleteModal(true);
                              }}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                              title="Delete model"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROVIDER API KEYS */}
      {/* TAB 2: PROVIDER API KEYS */}
      {activeTab === "keys" && (
        <div className="w-full space-y-4">
          <div className="w-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold">Secure Credential Storage</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                API keys are encrypted and stored in PostgreSQL. They are used securely on server-side model routing and never exposed in client bundles.
              </p>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {providers.map((p) => (
              <div
                key={p.id}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{p.name}</h3>
                    {p.hasKey ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Configured
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        Missing Key
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Active Key</span>
                      <p className="text-sm font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 mt-0.5 truncate">
                        {p.maskedKey}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Base URL</span>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate mt-0.5">
                        {p.baseUrl}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setKeyModalProvider(p);
                      setNewApiKey("");
                      setNewBaseUrl(p.baseUrl);
                      setTestResult(null);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Configure Key
                  </button>

                  <button
                    onClick={() => handleTestProvider(p.id)}
                    disabled={!p.hasKey || testingKey}
                    className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold rounded-lg transition-colors border border-blue-200 dark:border-blue-800 disabled:opacity-40 cursor-pointer"
                  >
                    Test Ping
                  </button>
                </div>
              </div>
            ))}

            {/* + Add Custom Provider Card */}
            <div
              onClick={() => {
                setCustomProviderName("");
                setCustomProviderId("");
                setCustomProviderBaseUrl("");
                setCustomProviderKey("");
                setShowCustomProviderModal(true);
              }}
              className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 rounded-xl p-5 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] group shadow-2xs"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-950 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center transition-colors mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                + Add Custom Provider
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                Connect LiteLLM, Ollama, LM Studio, vLLM, or self-hosted API endpoints
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AGENT & ASSISTANT BINDINGS */}
      {activeTab === "usage" && (
        <div className="w-full space-y-4">
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">Custom Agent & Assistant Model Mapping</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Inspect how the AI Finance platform routes requests to specialized models based on task domain and underwriting requirements.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    CreditWise Primary Assistant
                  </h4>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    User-Facing Default
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Handles general user loan queries, multi-turn dialogue, greetings, and chat responses.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Bound Engine:</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {activeDefaultModel?.name || "NVIDIA Nemotron 3 Ultra"}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    CreditWise Guardrail & Pre-Processor
                  </h4>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    Stage 1 Filter
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Filters non-salaried tokens (student, homemaker, unemployed) and handles company disavowals deterministically.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Bound Engine:</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    Deterministic Zero-Hallucination Guardrail
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Multi-Bank Eligibility Wizard
                  </h4>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    Stage 3 Tool
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Evaluates applicant profile across all 23 partner lenders without LLM guessing.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Bound Engine:</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    23-Lender Master Policy Engine
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Policy RAG & Parameter Retriever
                  </h4>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    Structured RAG
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Answers targeted questions on CIBIL, FOIR, and ROI using verified `.txt` policy files.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Bound Engine:</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    PolicyPgVector + Structured Formatter
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW MODEL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Register New Model</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterModel} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Model Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Claude 3.5 Sonnet, Llama 3.3 70B"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Model Identifier (API Slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g. claude-3-5-sonnet-20241022 or llama-3.3-70b-versatile"
                  value={formModelId}
                  onChange={(e) => setFormModelId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">Provider</label>
                  <select
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value as ModelProvider)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">Specific Purpose</label>
                  <select
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value as ModelPurpose)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {PURPOSE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={formRouteViaGateway}
                    onChange={(e) => setFormRouteViaGateway(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Route via OpenRouter / Unified Gateway
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      Inherits the active OpenRouter credentials. No direct provider API key is required.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      Set as Primary Assistant Default
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      Promotes this model to handle primary customer conversations in the central chat agent.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Register Model</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT REGISTERED MODEL */}
      {showEditModal && editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Edit Registered Model</h3>
                  <p className="text-xs text-slate-500">Modify model parameters, provider, and assistant default</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingModel(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Model Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gemini 2.0 Flash (Free), Claude 3.5 Sonnet"
                  value={editFormName}
                  onChange={(e) => setEditFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Model Identifier (API Slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g. google/gemini-2.0-flash-exp:free or deepseek/deepseek-v3"
                  value={editFormModelId}
                  onChange={(e) => setEditFormModelId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The exact model identifier string passed to the provider API.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Provider</label>
                  <select
                    value={editFormProvider}
                    onChange={(e) => setEditFormProvider(e.target.value as ModelProvider)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Specific Purpose</label>
                  <select
                    value={editFormPurpose}
                    onChange={(e) => setEditFormPurpose(e.target.value as ModelPurpose)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {PURPOSE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={editFormRouteViaGateway}
                    onChange={(e) => setEditFormRouteViaGateway(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      Route via OpenRouter / Unified Gateway
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Inherits active OpenRouter credentials. No direct provider API key is required.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={editFormIsDefault}
                    onChange={(e) => setEditFormIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      Set as Primary Assistant Default
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Promotes this model to handle customer conversations in the central chat agent.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingModel(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE MODEL CONFIRMATION */}
      {showDeleteModal && modelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Delete Model</h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{modelToDelete.name}"</span>?
            </p>

            {modelToDelete.is_assistant_default && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                ⚠️ This model is currently the primary assistant default. Deleting it will automatically promote the next available model.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setModelToDelete(null);
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE PROVIDER KEY */}
      {keyModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  Configure {keyModalProvider.name} API Key
                </h3>
              </div>
              <button
                onClick={() => {
                  setKeyModalProvider(null);
                  setTestResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProviderKey} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showRawKey ? "text" : "password"}
                    placeholder={`Paste ${keyModalProvider.name} API key...`}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  API Endpoint / Base URL
                </label>
                <input
                  type="text"
                  placeholder={keyModalProvider.defaultBaseUrl}
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium border ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    )}
                    {testResult.message}
                    {testResult.latencyMs && ` (${testResult.latencyMs}ms)`}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTestProvider(keyModalProvider.id, newApiKey)}
                  disabled={!newApiKey.trim() || testingKey}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold disabled:opacity-40"
                >
                  {testingKey ? "Testing..." : "Test Connection"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setKeyModalProvider(null);
                      setTestResult(null);
                    }}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Save Key"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM PROVIDER */}
      {showCustomProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleIn text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Add Custom Provider Endpoint</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomProviderModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomProvider} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Provider Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. LiteLLM Proxy, vLLM Cluster, LM Studio Local"
                  value={customProviderName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomProviderName(val);
                    if (!customProviderId || customProviderId === customProviderName.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
                      setCustomProviderId(val.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Provider Identifier Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. litellm, vllm, lmstudio"
                  value={customProviderId}
                  onChange={(e) => setCustomProviderId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  API Endpoint / Base URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. http://localhost:4000/v1 or https://ai-proxy.internal.corp/v1"
                  value={customProviderBaseUrl}
                  onChange={(e) => setCustomProviderBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>API Key (Optional / Bearer Token)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Leave empty for local Ollama/LM Studio</span>
                </label>
                <input
                  type="password"
                  placeholder="sk-... or leave blank if unauthenticated"
                  value={customProviderKey}
                  onChange={(e) => setCustomProviderKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomProviderModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add Provider</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
