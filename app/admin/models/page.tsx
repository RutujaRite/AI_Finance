/**
 * CreditWise AI — AI Models Management Page (Admin Only)
 * Configure, deploy, and dynamically route Speech-to-Text, LLM Reasoning, and Voice Synthesis engines.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";

export type ModelCategory = "STT" | "LLM" | "TTS";

export interface AiModelItem {
  id: number;
  category: ModelCategory;
  model_name: string;
  provider: string;
  has_custom_api_key: boolean;
  base_url?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function AiModelsManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [models, setModels] = useState<AiModelItem[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "danger" | "info" } | null>(null);

  // Engine Cards Selected Dropdown Targets (for switching)
  const [selectedEngineModel, setSelectedEngineModel] = useState<Record<ModelCategory, number | null>>({
    STT: null,
    LLM: null,
    TTS: null,
  });

  // Filter / Search states
  const [selectedTab, setSelectedTab] = useState<"ALL" | ModelCategory>("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Add model form state
  const [addForm, setAddForm] = useState<{
    category: ModelCategory;
    model_name: string;
    api_key: string;
    is_active: boolean;
  }>({
    category: "LLM",
    model_name: "",
    api_key: "",
    is_active: false,
  });
  const [showAddKey, setShowAddKey] = useState(false);

  // Edit model form state
  const [editTarget, setEditTarget] = useState<AiModelItem | null>(null);
  const [editForm, setEditForm] = useState<{
    model_name: string;
    category: ModelCategory;
    api_key: string;
  }>({
    model_name: "",
    category: "LLM",
    api_key: "",
  });
  const [showEditKey, setShowEditKey] = useState(false);

  // Delete target state
  const [deleteTarget, setDeleteTarget] = useState<AiModelItem | null>(null);

  useEffect(() => {
    checkAuth();
    fetchModels();
  }, []);

  function showToast(message: string, type: "success" | "danger" | "info" = "success") {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "include" });
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data.success) {
        const isAdmin =
          String(data.user?.role || "").trim().toLowerCase() === "admin" ||
          data.user?.is_admin === true ||
          String(data.user?.email || "").toLowerCase() === "admin@gmail.com" ||
          String(data.user?.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
          String(data.user?.email || "").toLowerCase().startsWith("admin");

        if (!isAdmin) {
          router.replace("/home?section=assistant");
          return;
        }
        setUser(data.user);
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }

  async function fetchModels() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/models", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace("/login");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        const list: AiModelItem[] = data.models || [];
        setModels(list);
        setProviders(data.providers || []);

        const activeSTT = list.find((m) => m.category === "STT" && m.is_active);
        const activeLLM = list.find((m) => m.category === "LLM" && m.is_active);
        const activeTTS = list.find((m) => m.category === "TTS" && m.is_active);

        setSelectedEngineModel((prev) => ({
          STT: prev.STT !== null && list.some((m) => m.id === prev.STT && m.category === "STT") ? prev.STT : (activeSTT ? activeSTT.id : (list.find((m) => m.category === "STT")?.id || null)),
          LLM: prev.LLM !== null && list.some((m) => m.id === prev.LLM && m.category === "LLM") ? prev.LLM : (activeLLM ? activeLLM.id : (list.find((m) => m.category === "LLM")?.id || null)),
          TTS: prev.TTS !== null && list.some((m) => m.id === prev.TTS && m.category === "TTS") ? prev.TTS : (activeTTS ? activeTTS.id : (list.find((m) => m.category === "TTS")?.id || null)),
        }));
      } else {
        showToast(data.message || "Failed to load models", "danger");
      }
    } catch (err: any) {
      showToast("Error loading models: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  }

  // Active models per category
  const activeModels = useMemo(() => {
    return {
      STT: models.find((m) => m.category === "STT" && m.is_active) || null,
      LLM: models.find((m) => m.category === "LLM" && m.is_active) || null,
      TTS: models.find((m) => m.category === "TTS" && m.is_active) || null,
    };
  }, [models]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      ALL: models.length,
      STT: models.filter((m) => m.category === "STT").length,
      LLM: models.filter((m) => m.category === "LLM").length,
      TTS: models.filter((m) => m.category === "TTS").length,
    };
  }, [models]);

  // Filtered models list
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (selectedTab !== "ALL" && m.category !== selectedTab) return false;
      if (providerFilter !== "ALL" && m.provider.toLowerCase() !== providerFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.model_name.toLowerCase().includes(q);
        const matchProvider = m.provider.toLowerCase().includes(q);
        const matchId = String(m.id).includes(q);
        const matchCategory = m.category.toLowerCase().includes(q);
        if (!matchName && !matchProvider && !matchId && !matchCategory) return false;
      }
      return true;
    });
  }, [models, selectedTab, providerFilter, searchQuery]);

  /* ---------------- Actions ---------------- */

  async function handleActivateModel(id: number) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/models/${id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Model activated successfully!", "success");
        await fetchModels();
      } else {
        showToast(data.message || "Failed to activate model", "danger");
      }
    } catch (err: any) {
      showToast("Activation error: " + err.message, "danger");
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenEdit(model: AiModelItem) {
    setEditTarget(model);
    setEditForm({
      model_name: model.model_name,
      category: model.category,
      api_key: "",
    });
    setShowEditKey(false);
    setShowEditModal(true);
  }

  function handleOpenDelete(model: AiModelItem) {
    setDeleteTarget(model);
    setShowDeleteModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.model_name.trim()) {
      showToast("Model name is required", "danger");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/models/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model_name: editForm.model_name.trim(),
          category: editForm.category,
          api_key: editForm.api_key.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Model updated successfully!", "success");
        setShowEditModal(false);
        setEditTarget(null);
        await fetchModels();
      } else {
        showToast(data.message || "Failed to update model", "danger");
      }
    } catch (err: any) {
      showToast("Update error: " + err.message, "danger");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.is_active) {
      showToast(`Please activate another model before deleting this model ("${deleteTarget.model_name}" is currently active).`, "danger");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/models/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Model deleted successfully!", "success");
        setShowDeleteModal(false);
        setDeleteTarget(null);
        await fetchModels();
      } else {
        showToast(data.message || "Failed to delete model", "danger");
      }
    } catch (err: any) {
      showToast("Delete error: " + err.message, "danger");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.model_name.trim()) {
      showToast("Model name is required", "danger");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: addForm.category,
          model_name: addForm.model_name.trim(),
          api_key: addForm.api_key.trim() || undefined,
          is_active: addForm.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Model added successfully!", "success");
        setShowAddModal(false);
        setAddForm({
          category: "LLM",
          model_name: "",
          api_key: "",
          is_active: false,
        });
        await fetchModels();
      } else {
        showToast(data.message || "Failed to add model", "danger");
      }
    } catch (err: any) {
      showToast("Creation error: " + err.message, "danger");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmRestore() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/models/restore-defaults", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Default models restored successfully!", "success");
        setShowRestoreModal(false);
        await fetchModels();
      } else {
        showToast(data.message || "Failed to restore defaults", "danger");
      }
    } catch (err: any) {
      showToast("Restore error: " + err.message, "danger");
    } finally {
      setActionLoading(false);
    }
  }

  if (!user) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "var(--ink-soft)", fontWeight: 500 }}>Verifying admin authorization...</p>
      </main>
    );
  }

  return (
    <div className="home-body admin-fullpage-layout" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", width: "100%" }}>
      <Topbar user={user} pathname="/admin/models" />

      {/* Floating Action Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 72,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            background: toast.type === "success" ? "#10b981" : toast.type === "danger" ? "#ef4444" : "#3b82f6",
            color: "#ffffff",
            fontWeight: 500,
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <i className={`bi ${toast.type === "success" ? "bi-check-circle-fill" : toast.type === "danger" ? "bi-exclamation-octagon-fill" : "bi-info-circle-fill"}`} />
          <span>{toast.message}</span>
        </div>
      )}

      <main
        className="admin-workspace-fullwidth animate-fade-in"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "28px 32px 64px 32px",
          boxSizing: "border-box",
        }}
      >
        {/* Header / Navigation */}
        <div className="page-header" style={{ marginBottom: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                <i className="bi bi-cpu" style={{ color: "var(--accent)" }} />
                AI Models Management
              </h1>
              <span className="badge badge-primary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>Dynamic Routing</span>
            </div>
            <p className="page-subtitle" style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              Configure, deploy, and dynamically route Speech-to-Text, LLM Reasoning, and Voice Synthesis engines
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchModels}
              disabled={loading || actionLoading}
              title="Refresh models from database"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", height: "38px" }}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRestoreModal(true)}
              disabled={loading || actionLoading}
              title="Restore system defaults"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", height: "38px" }}
            >
              <i className="bi bi-arrow-counterclockwise" />
              Restore Defaults
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAddForm({
                  category: "LLM",
                  model_name: "",
                  api_key: "",
                  is_active: false,
                });
                setShowAddKey(false);
                setShowAddModal(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                height: "38px",
                background: "#0d9488",
                borderColor: "#0d9488",
                color: "#ffffff",
                fontWeight: 600,
                padding: "0 16px",
              }}
            >
              <i className="bi bi-plus-lg" />
              Add New Model
            </button>
          </div>
        </div>

        {/* ---------------- THREE ENGINE CARDS ---------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {/* 1. STT ENGINE (Blue Accent) */}
          {(() => {
            const active = activeModels.STT;
            const catModels = models.filter((m) => m.category === "STT");
            const selectedId = selectedEngineModel.STT;
            const targetModel = catModels.find((m) => m.id === selectedId) || active || catModels[0] || null;
            const isTargetActive = targetModel?.is_active || false;

            return (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid #bfdbfe",
                  boxShadow: "0 4px 20px -2px rgba(59, 130, 246, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header ribbon */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)",
                    padding: "16px 20px",
                    borderBottom: "1px solid #dbeafe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "#2563eb",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.1rem",
                      }}
                    >
                      <i className="bi bi-mic" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a" }}>STT Engine</h2>
                      <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 500 }}>Speech-to-Text Transcriber</span>
                    </div>
                  </div>

                  {active ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }}></span>
                      Active
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#fef2f2",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                      }}
                    >
                      No active model
                    </span>
                  )}
                </div>

                {/* Body info */}
                <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Active Model:</span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--ink)", wordBreak: "break-all" }}>
                        {active ? active.model_name : <span style={{ color: "var(--ink-soft)" }}>None configured</span>}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>ID:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{active ? `#${active.id}` : "--"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Provider:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#2563eb" }}>{active ? active.provider : "--"}</span>
                    </div>
                  </div>

                  {/* Switch dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--ink-soft)" }}>
                      Switch STT Model
                    </label>
                    <select
                      className="form-select"
                      style={{ fontSize: "0.875rem", padding: "8px 12px", borderRadius: "8px", borderColor: "#cbd5e1" }}
                      value={targetModel?.id || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSelectedEngineModel((prev) => ({ ...prev, STT: val || null }));
                      }}
                    >
                      {catModels.length === 0 && <option value="">No STT models configured</option>}
                      {catModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.model_name} ({m.provider}) {m.is_active ? "— [Active]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: isTargetActive ? "#e2e8f0" : "#2563eb",
                        color: isTargetActive ? "#94a3b8" : "#ffffff",
                        borderColor: isTargetActive ? "#e2e8f0" : "#2563eb",
                        fontWeight: 600,
                        cursor: isTargetActive ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                      disabled={isTargetActive || !targetModel || actionLoading}
                      onClick={() => targetModel && handleActivateModel(targetModel.id)}
                    >
                      <i className="bi bi-power" />
                      {isTargetActive ? "Active" : "Activate"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      title="Edit selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenEdit(targetModel)}
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                      title="Delete selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenDelete(targetModel)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2. LLM REASONING (Purple Accent) */}
          {(() => {
            const active = activeModels.LLM;
            const catModels = models.filter((m) => m.category === "LLM");
            const selectedId = selectedEngineModel.LLM;
            const targetModel = catModels.find((m) => m.id === selectedId) || active || catModels[0] || null;
            const isTargetActive = targetModel?.is_active || false;

            return (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid #ddd6fe",
                  boxShadow: "0 4px 20px -2px rgba(139, 92, 246, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header ribbon */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.04) 100%)",
                    padding: "16px 20px",
                    borderBottom: "1px solid #ede9fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "#7c3aed",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.1rem",
                      }}
                    >
                      <i className="bi bi-robot" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#5b21b6" }}>LLM Reasoning</h2>
                      <span style={{ fontSize: "0.75rem", color: "#a78bfa", fontWeight: 500 }}>Central Intelligence Engine</span>
                    </div>
                  </div>

                  {active ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }}></span>
                      Active
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#fef2f2",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                      }}
                    >
                      No active model
                    </span>
                  )}
                </div>

                {/* Body info */}
                <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Active Model:</span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--ink)", wordBreak: "break-all" }}>
                        {active ? active.model_name : <span style={{ color: "var(--ink-soft)" }}>None configured</span>}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>ID:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{active ? `#${active.id}` : "--"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Provider:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#7c3aed" }}>{active ? active.provider : "--"}</span>
                    </div>
                  </div>

                  {/* Switch dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--ink-soft)" }}>
                      Switch LLM Model
                    </label>
                    <select
                      className="form-select"
                      style={{ fontSize: "0.875rem", padding: "8px 12px", borderRadius: "8px", borderColor: "#cbd5e1" }}
                      value={targetModel?.id || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSelectedEngineModel((prev) => ({ ...prev, LLM: val || null }));
                      }}
                    >
                      {catModels.length === 0 && <option value="">No LLM models configured</option>}
                      {catModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.model_name} ({m.provider}) {m.is_active ? "— [Active]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: isTargetActive ? "#e2e8f0" : "#7c3aed",
                        color: isTargetActive ? "#94a3b8" : "#ffffff",
                        borderColor: isTargetActive ? "#e2e8f0" : "#7c3aed",
                        fontWeight: 600,
                        cursor: isTargetActive ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                      disabled={isTargetActive || !targetModel || actionLoading}
                      onClick={() => targetModel && handleActivateModel(targetModel.id)}
                    >
                      <i className="bi bi-power" />
                      {isTargetActive ? "Active" : "Activate"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      title="Edit selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenEdit(targetModel)}
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                      title="Delete selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenDelete(targetModel)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. TTS VOICE ENGINE (Orange/Amber Accent) */}
          {(() => {
            const active = activeModels.TTS;
            const catModels = models.filter((m) => m.category === "TTS");
            const selectedId = selectedEngineModel.TTS;
            const targetModel = catModels.find((m) => m.id === selectedId) || active || catModels[0] || null;
            const isTargetActive = targetModel?.is_active || false;

            return (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid #fed7aa",
                  boxShadow: "0 4px 20px -2px rgba(249, 115, 22, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header ribbon */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.04) 100%)",
                    padding: "16px 20px",
                    borderBottom: "1px solid #ffedd5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "#ea580c",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.1rem",
                      }}
                    >
                      <i className="bi bi-volume-up" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#9a3412" }}>TTS Voice Engine</h2>
                      <span style={{ fontSize: "0.75rem", color: "#fb923c", fontWeight: 500 }}>Voice Synthesis &amp; Playback</span>
                    </div>
                  </div>

                  {active ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }}></span>
                      Active
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#fef2f2",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                      }}
                    >
                      No active model
                    </span>
                  )}
                </div>

                {/* Body info */}
                <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Active Model:</span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--ink)", wordBreak: "break-all" }}>
                        {active ? active.model_name : <span style={{ color: "var(--ink-soft)" }}>None configured</span>}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>ID:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{active ? `#${active.id}` : "--"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 500, display: "block", marginBottom: "2px" }}>Provider:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ea580c" }}>{active ? active.provider : "--"}</span>
                    </div>
                  </div>

                  {/* Switch dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--ink-soft)" }}>
                      Switch TTS Model
                    </label>
                    <select
                      className="form-select"
                      style={{ fontSize: "0.875rem", padding: "8px 12px", borderRadius: "8px", borderColor: "#cbd5e1" }}
                      value={targetModel?.id || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSelectedEngineModel((prev) => ({ ...prev, TTS: val || null }));
                      }}
                    >
                      {catModels.length === 0 && <option value="">No TTS models configured</option>}
                      {catModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.model_name} ({m.provider}) {m.is_active ? "— [Active]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: isTargetActive ? "#e2e8f0" : "#ea580c",
                        color: isTargetActive ? "#94a3b8" : "#ffffff",
                        borderColor: isTargetActive ? "#e2e8f0" : "#ea580c",
                        fontWeight: 600,
                        cursor: isTargetActive ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                      disabled={isTargetActive || !targetModel || actionLoading}
                      onClick={() => targetModel && handleActivateModel(targetModel.id)}
                    >
                      <i className="bi bi-power" />
                      {isTargetActive ? "Active" : "Activate"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      title="Edit selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenEdit(targetModel)}
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                      title="Delete selected model"
                      disabled={!targetModel || actionLoading}
                      onClick={() => targetModel && handleOpenDelete(targetModel)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ---------------- MODEL LISTING SECTION ---------------- */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          {/* Filter Bar Header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            {/* Category Tabs */}
            <div style={{ display: "flex", gap: "6px", background: "var(--bg)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
              {(["ALL", "STT", "LLM", "TTS"] as const).map((tab) => {
                const label = tab === "ALL" ? "All Models" : tab;
                const count = tabCounts[tab];
                const isActive = selectedTab === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedTab(tab)}
                    style={{
                      border: "none",
                      background: isActive ? "var(--surface)" : "transparent",
                      color: isActive ? "var(--ink)" : "var(--ink-soft)",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: "0.85rem",
                      padding: "6px 14px",
                      borderRadius: "7px",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{label}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: isActive ? "rgba(13, 148, 136, 0.12)" : "rgba(0,0,0,0.05)",
                        color: isActive ? "#0d9488" : "inherit",
                        fontWeight: 600,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Provider Filter & Search Input */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Provider Dropdown */}
              <select
                className="form-select"
                style={{
                  fontSize: "0.85rem",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  borderColor: "var(--border)",
                  minWidth: "150px",
                }}
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
              >
                <option value="ALL">All Providers</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Search Bar */}
              <div style={{ position: "relative", minWidth: "240px" }}>
                <i
                  className="bi bi-search"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-soft)",
                    fontSize: "0.85rem",
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    fontSize: "0.85rem",
                    padding: "7px 12px 7px 34px",
                    borderRadius: "8px",
                    borderColor: "var(--border)",
                    width: "100%",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Model Rows / Cards */}
          {loading ? (
            <div style={{ padding: "64px 20px", textAlign: "center" }}>
              <div className="spinner-border text-primary" style={{ width: 32, height: 32, marginBottom: "12px" }}></div>
              <p style={{ color: "var(--ink-soft)", fontSize: "0.875rem", margin: 0 }}>Loading models configuration...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            /* Empty State */
            <div style={{ padding: "64px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  marginBottom: "16px",
                }}
              >
                <i className="bi bi-cpu" />
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: 600 }}>No models found</h3>
              <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "0.875rem", maxWidth: "400px" }}>
                {searchQuery || providerFilter !== "ALL" || selectedTab !== "ALL"
                  ? "No models match your current search and filter criteria."
                  : "No AI models have been added yet. Click Add New Model to register an engine."}
              </p>
              {(searchQuery || providerFilter !== "ALL" || selectedTab !== "ALL") ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setProviderFilter("ALL");
                    setSelectedTab("ALL");
                  }}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setAddForm({ category: "LLM", model_name: "", api_key: "", is_active: false });
                    setShowAddModal(true);
                  }}
                  style={{ background: "#0d9488", borderColor: "#0d9488" }}
                >
                  <i className="bi bi-plus-lg me-1" /> Add Model
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <th style={{ padding: "14px 24px", fontWeight: 600 }}>Model Name &amp; ID</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600 }}>Category</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600 }}>Provider</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600 }}>API Key</th>
                    <th style={{ padding: "14px 16px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "14px 24px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((m) => {
                    const isSTT = m.category === "STT";
                    const isLLM = m.category === "LLM";
                    const isTTS = m.category === "TTS";

                    return (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: m.is_active ? "rgba(13, 148, 136, 0.02)" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Model name & ID */}
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                background: isSTT ? "#eff6ff" : isLLM ? "#f5f3ff" : "#fff7ed",
                                color: isSTT ? "#2563eb" : isLLM ? "#7c3aed" : "#ea580c",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.95rem",
                                flexShrink: 0,
                              }}
                            >
                              <i className={isSTT ? "bi bi-mic" : isLLM ? "bi bi-robot" : "bi bi-volume-up"} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)", wordBreak: "break-all" }}>
                                {m.model_name}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", display: "flex", gap: "8px", marginTop: "2px" }}>
                                <span>ID: #{m.id}</span>
                                {m.is_default && (
                                  <span style={{ color: "#0d9488", fontWeight: 600 }}>• Baseline Default</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: "16px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              letterSpacing: "0.03em",
                              background: isSTT ? "#dbeafe" : isLLM ? "#ede9fe" : "#ffedd5",
                              color: isSTT ? "#1e40af" : isLLM ? "#5b21b6" : "#9a3412",
                            }}
                          >
                            {m.category}
                          </span>
                        </td>

                        {/* Provider */}
                        <td style={{ padding: "16px 16px" }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>
                            {m.provider}
                          </span>
                        </td>

                        {/* API Key Status */}
                        <td style={{ padding: "16px 16px" }}>
                          {m.has_custom_api_key ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.75rem",
                                color: "#059669",
                                fontWeight: 500,
                              }}
                            >
                              <i className="bi bi-shield-lock-fill" /> Custom Secret
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.75rem",
                                color: "var(--ink-soft)",
                              }}
                            >
                              <i className="bi bi-gear" /> Inherited Env
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "16px 16px" }}>
                          {m.is_active ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "20px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }}></span>
                              Active
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "20px",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                background: "#f1f5f9",
                                color: "#64748b",
                              }}
                            >
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                background: m.is_active ? "#f1f5f9" : "#0d9488",
                                color: m.is_active ? "#94a3b8" : "#ffffff",
                                borderColor: m.is_active ? "#e2e8f0" : "#0d9488",
                                cursor: m.is_active ? "default" : "pointer",
                              }}
                              disabled={m.is_active || actionLoading}
                              onClick={() => !m.is_active && handleActivateModel(m.id)}
                            >
                              {m.is_active ? "Active" : "Activate"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                              title="Edit model"
                              disabled={actionLoading}
                              onClick={() => handleOpenEdit(m)}
                            >
                              <i className="bi bi-pencil" />
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.8rem", color: "#ef4444" }}
                              title="Delete model"
                              disabled={actionLoading}
                              onClick={() => handleOpenDelete(m)}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ---------------- ADD CUSTOM MODEL MODAL ---------------- */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !actionLoading && setShowAddModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              maxWidth: 540,
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.28)",
              border: "1px solid var(--border)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  Add Custom Model
                </h2>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  Provide Category, Model Name, and API Key
                </p>
              </div>
              <button
                type="button"
                onClick={() => !actionLoading && setShowAddModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleAddModel} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px" }}>
                  Category <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value as ModelCategory })}
                  required
                  style={{ fontSize: "0.875rem", padding: "8px 12px" }}
                >
                  <option value="STT">STT (Speech-to-Text)</option>
                  <option value="LLM">LLM (Reasoning &amp; Chat)</option>
                  <option value="TTS">TTS (Voice Synthesis)</option>
                </select>
                {addForm.category === "LLM" && (
                  <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "#7c3aed" }}>
                    <i className="bi bi-info-circle me-1" /> LLM models handle intent routing, policy reasoning, and financial advisory chat.
                  </p>
                )}
              </div>

              {/* Model Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px" }}>
                  Model Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. meta-llama/llama-3.3-70b-instruct or deepseek/deepseek-chat"
                  value={addForm.model_name}
                  onChange={(e) => setAddForm({ ...addForm, model_name: e.target.value })}
                  required
                  style={{ fontSize: "0.875rem", padding: "8px 12px", fontFamily: "monospace" }}
                />
              </div>

              {/* API Key */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0 }}>
                    API Key (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddKey(!showAddKey)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--ink-soft)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <i className={`bi ${showAddKey ? "bi-eye-slash" : "bi-eye"}`} />
                    {showAddKey ? "Hide" : "Show"}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showAddKey ? "text" : "password"}
                    className="form-control"
                    placeholder="e.g. sk-or-v1-... or your provider key"
                    value={addForm.api_key}
                    onChange={(e) => setAddForm({ ...addForm, api_key: e.target.value })}
                    style={{ fontSize: "0.875rem", padding: "8px 12px", fontFamily: "monospace" }}
                  />
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                  Leave blank to inherit your system default environment API key.
                </p>
              </div>

              {/* Activate immediately checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="activate_immediately"
                  checked={addForm.is_active}
                  onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#0d9488" }}
                />
                <label htmlFor="activate_immediately" style={{ fontSize: "0.8125rem", cursor: "pointer", margin: 0, fontWeight: 500 }}>
                  Activate this model immediately upon creation
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                  style={{ padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                  style={{
                    background: "#0d9488",
                    borderColor: "#0d9488",
                    padding: "8px 20px",
                    fontWeight: 600,
                  }}
                >
                  {actionLoading ? "Adding..." : "Add Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EDIT MODEL MODAL ---------------- */}
      {showEditModal && editTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !actionLoading && setShowEditModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              maxWidth: 540,
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.28)",
              border: "1px solid var(--border)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  Edit Model
                </h2>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  Update model name, category, or replace secret API key
                </p>
              </div>
              <button
                type="button"
                onClick={() => !actionLoading && setShowEditModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px" }}>
                  Category
                </label>
                <select
                  className="form-select"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ModelCategory })}
                  style={{ fontSize: "0.875rem", padding: "8px 12px" }}
                >
                  <option value="STT">STT (Speech-to-Text)</option>
                  <option value="LLM">LLM (Reasoning &amp; Chat)</option>
                  <option value="TTS">TTS (Voice Synthesis)</option>
                </select>
              </div>

              {/* Model Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px" }}>
                  Model Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.model_name}
                  onChange={(e) => setEditForm({ ...editForm, model_name: e.target.value })}
                  required
                  style={{ fontSize: "0.875rem", padding: "8px 12px", fontFamily: "monospace" }}
                />
              </div>

              {/* API Key */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0 }}>
                    API Secret Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEditKey(!showEditKey)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--ink-soft)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <i className={`bi ${showEditKey ? "bi-eye-slash" : "bi-eye"}`} />
                    {showEditKey ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showEditKey ? "text" : "password"}
                  className="form-control"
                  placeholder={editTarget.has_custom_api_key ? "API key configured (leave blank to keep unchanged)" : "Leave blank to inherit system environment key"}
                  value={editForm.api_key}
                  onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })}
                  style={{ fontSize: "0.875rem", padding: "8px 12px", fontFamily: "monospace" }}
                />
                <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                  {editTarget.has_custom_api_key
                    ? "A custom secret key is currently configured. Enter a new key only if you wish to replace it."
                    : "No model-specific key is saved. This model currently inherits your environment API key."}
                </p>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowEditModal(false)}
                  disabled={actionLoading}
                  style={{ padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                  style={{
                    background: "#0d9488",
                    borderColor: "#0d9488",
                    padding: "8px 20px",
                    fontWeight: 600,
                  }}
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- DELETE CONFIRMATION MODAL ---------------- */}
      {showDeleteModal && deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !actionLoading && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: "24px 28px",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.28)",
              border: "1px solid var(--border)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-exclamation-triangle" />
              </div>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>
                  Delete this model?
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  {deleteTarget.model_name} (#{deleteTarget.id})
                </span>
              </div>
            </div>

            {deleteTarget.is_active ? (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 20,
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <i className="bi bi-slash-circle-fill" style={{ fontSize: "1rem", marginTop: 2 }} />
                <div>
                  <strong>Active Model Protection</strong>
                  <p style={{ margin: "4px 0 0 0" }}>
                    Please activate another model before deleting this model. The active {deleteTarget.category} engine cannot be deleted while in service.
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ margin: "0 0 20px 0", fontSize: "0.875rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                The model configuration will be permanently removed from the database. Any custom settings and credentials for this model will be erased.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                style={{ padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDelete}
                disabled={deleteTarget.is_active || actionLoading}
                style={{
                  padding: "8px 20px",
                  fontWeight: 600,
                  cursor: deleteTarget.is_active ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading ? "Deleting..." : "Delete Model"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- RESTORE DEFAULTS MODAL ---------------- */}
      {showRestoreModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !actionLoading && setShowRestoreModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: "24px 28px",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.28)",
              border: "1px solid var(--border)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#e0f2fe",
                  color: "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-arrow-counterclockwise" />
              </div>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>
                  Restore Default Models?
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  Reset active engines to platform baseline
                </span>
              </div>
            </div>

            <p style={{ margin: "0 0 20px 0", fontSize: "0.875rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
              This will reset the active engines to the system defaults: <strong>OpenRouter Auto</strong> for LLM, <strong>Whisper Large v3</strong> for STT, and <strong>TTS-1</strong> for TTS. Custom models will <strong>not</strong> be deleted.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRestoreModal(false)}
                disabled={actionLoading}
                style={{ padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmRestore}
                disabled={actionLoading}
                style={{
                  background: "#0d9488",
                  borderColor: "#0d9488",
                  padding: "8px 20px",
                  fontWeight: 600,
                }}
              >
                {actionLoading ? "Restoring..." : "Confirm Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
