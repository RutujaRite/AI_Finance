// app/agent-studio/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Header from "@/components/agent-studio/Header";
import Sidebar, { StudioTab } from "@/components/agent-studio/Sidebar";
import OverviewSection from "@/components/agent-studio/OverviewSection";
import SetupSection from "@/components/agent-studio/SetupSection";
import QualificationSection from "@/components/agent-studio/QualificationSection";
import CapabilitiesSection from "@/components/agent-studio/CapabilitiesSection";
import TestSection from "@/components/agent-studio/TestSection";
import PlansSection from "@/components/agent-studio/PlansSection";
import UpgradeModal from "@/components/agent-studio/UpgradeModal";
import CreateAgentModal from "@/components/agent-studio/CreateAgentModal";
import Toast from "@/components/agent-studio/Toast";
import { Agent, UserSubscriptionState } from "@/lib/agent-studio/types";
import "./agent-studio.css";

export default function AgentStudioPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent_loan_assistant");
  const [subscription, setSubscription] = useState<UserSubscriptionState>({
    plan: "basic",
    messagesUsed: 7,
    maxMessages: 10,
    agentsCount: 1,
    maxAgents: 1,
    knowledgeFilesCount: 1,
    maxKnowledgeFiles: 1,
    planLimits: {
      agents: 1,
      testMessages: 10,
      knowledgeFiles: 1,
    },
  });

  const [activeTab, setActiveTab] = useState<StudioTab>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Modals & Feedback
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "info" | "warning";
  } | null>(null);

  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    actionText?: string;
  }>({
    isOpen: false,
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    loadAgentsAndSubscription();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/verify");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch {
      // Allow fallback in development if verify fails
    }
  }

  async function loadAgentsAndSubscription() {
    try {
      setLoading(true);
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.agents) && data.agents.length > 0) {
            setAgents(data.agents);
            // Default to Loan Assistant if present, else first
            const defaultAgent =
              data.agents.find((a: Agent) => a.id === "agent_loan_assistant") ||
              data.agents[0];
            setSelectedAgentId(defaultAgent.id);
          }
          if (data.subscription) {
            setSubscription(data.subscription);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load agent studio data:", err);
    } finally {
      setLoading(false);
    }
  }

  const currentAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0] || null;

  function handleUpdateCurrentAgent(updates: Partial<Agent>) {
    if (!currentAgent) return;
    setAgents((prev) =>
      prev.map((a) => (a.id === currentAgent.id ? { ...a, ...updates } : a))
    );
  }

  async function handleSaveChanges() {
    if (!currentAgent) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/agents/${currentAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentAgent),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ message: "✓ Changes saved successfully", type: "success" });
        if (data.agent) {
          setAgents((prev) =>
            prev.map((a) => (a.id === data.agent.id ? data.agent : a))
          );
        }
      } else {
        setToast({
          message: data.error || "Failed to save changes",
          type: "warning",
        });
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setToast({ message: "Network error saving changes", type: "warning" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAgent(newAgentData: {
    name: string;
    description: string;
    purpose: string;
  }) {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAgentData),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (data.limitReached) {
        setUpgradeModal({
          isOpen: true,
          title: "You've reached your Basic plan limit.",
          subtitle:
            "Your Basic plan includes 1 AI agent. Upgrade to Pro to create up to 5 AI agents with expanded test messages and custom knowledge bases.",
          actionText: "View Plans",
        });
      }
      throw new Error(data.error || "Could not create agent");
    }

    if (data.agent) {
      setAgents((prev) => [...prev, data.agent]);
      setSelectedAgentId(data.agent.id);
      setActiveTab("overview");
      setToast({
        message: `✓ Created "${data.agent.name}"`,
        type: "success",
      });
    }

    if (data.subscription) {
      setSubscription(data.subscription);
    }
  }

  function handleOpenUpgradeModal(reason?: {
    title: string;
    subtitle: string;
    actionText: string;
  }) {
    setUpgradeModal({
      isOpen: true,
      title: reason?.title || "You've reached your free testing limit.",
      subtitle:
        reason?.subtitle ||
        "Your AI agent is saved and ready. Upgrade your plan to continue testing with more messages.",
      actionText: reason?.actionText || "View Plans",
    });
  }

  function handleCloseUpgradeModal() {
    setUpgradeModal({ isOpen: false });
  }

  function handleNavigateToPlans() {
    setUpgradeModal({ isOpen: false });
    setActiveTab("plans");
  }

  function handlePlanUpgraded(newSub: UserSubscriptionState) {
    setSubscription(newSub);
    // Update all agents with the new maxMessages limit
    setAgents((prev) =>
      prev.map((a) => ({
        ...a,
        usage: {
          ...a.usage,
          maxMessages: newSub.maxMessages,
        },
      }))
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Topbar user={user} pathname="/agent-studio" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-pulse border border-indigo-100">
              <i className="bi bi-robot text-xl" />
            </div>
            <p className="text-xs font-medium text-slate-500">
              Loading AI Agent Studio...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-900 font-sans antialiased">
      {/* 1. Global Topbar */}
      <Topbar user={user} pathname="/agent-studio" />

      {/* 2. Agent Studio Header */}
      <Header
        currentAgent={currentAgent}
        subscription={subscription}
        onTestAgent={() => setActiveTab("test")}
        onSaveChanges={handleSaveChanges}
        saving={saving}
        onUpgrade={() => setActiveTab("plans")}
        activeTab={activeTab}
      />

      {/* 3. Studio Layout: Compact Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          agents={agents}
          currentAgentId={selectedAgentId}
          onSelectAgent={(id) => {
            setSelectedAgentId(id);
            if (activeTab === "plans") {
              setActiveTab("overview");
            }
          }}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onCreateNew={() => setCreateModalOpen(true)}
          subscription={subscription}
          onUpgrade={() => setActiveTab("plans")}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 agent-studio-content">
          {activeTab === "overview" && currentAgent && (
            <OverviewSection
              agent={currentAgent}
              subscription={subscription}
              onTestAgent={() => setActiveTab("test")}
              onSaveChanges={handleSaveChanges}
              saving={saving}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "setup" && currentAgent && (
            <SetupSection
              agent={currentAgent}
              onChange={handleUpdateCurrentAgent}
              onSaveChanges={handleSaveChanges}
              saving={saving}
            />
          )}

          {activeTab === "qualification" && currentAgent && (
            <QualificationSection
              agent={currentAgent}
              subscription={subscription}
              onChange={handleUpdateCurrentAgent}
              onSaveChanges={handleSaveChanges}
              saving={saving}
              onUpgradeModal={handleOpenUpgradeModal}
            />
          )}

          {activeTab === "capabilities" && currentAgent && (
            <CapabilitiesSection
              agent={currentAgent}
              onChange={handleUpdateCurrentAgent}
              onSaveChanges={handleSaveChanges}
              saving={saving}
            />
          )}

          {activeTab === "test" && currentAgent && (
            <TestSection
              agent={currentAgent}
              subscription={subscription}
              onUsageUpdated={(newSub) => setSubscription(newSub)}
              onUpgradeModal={handleOpenUpgradeModal}
            />
          )}

          {activeTab === "plans" && (
            <PlansSection
              subscription={subscription}
              onPlanUpgraded={handlePlanUpgraded}
              onToast={(msg, type) =>
                setToast({ message: msg, type: type || "success" })
              }
            />
          )}
        </main>
      </div>

      {/* Modals & Toasts */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={handleCloseUpgradeModal}
        onViewPlans={handleNavigateToPlans}
        title={upgradeModal.title}
        subtitle={upgradeModal.subtitle}
        actionText={upgradeModal.actionText}
      />

      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        subscription={subscription}
        onCreate={handleCreateAgent}
        onViewPlans={handleNavigateToPlans}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type || "success"}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
