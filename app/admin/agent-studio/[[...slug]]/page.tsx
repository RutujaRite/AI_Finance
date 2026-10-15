"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function AdminAgentStudioCatchAllPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const slugArray = params?.slug;
    const subRoute = Array.isArray(slugArray) ? slugArray[0] : slugArray || "";

    let targetTab = "instructions";
    if (subRoute === "model-config" || subRoute === "models") {
      targetTab = "models";
    } else if (subRoute === "analytics" || subRoute === "tokens") {
      targetTab = "tokens";
    } else if (subRoute === "settings") {
      targetTab = "settings";
    } else if (subRoute === "knowledge") {
      targetTab = "knowledge";
    } else if (subRoute === "demo" || subRoute === "test") {
      targetTab = "demo";
    } else if (subRoute === "instructions") {
      targetTab = "instructions";
    }

    router.replace(`/agent-studio?tab=${targetTab}`);
  }, [router, params]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-slate-600">Loading AI Agent Studio...</p>
    </div>
  );
}
