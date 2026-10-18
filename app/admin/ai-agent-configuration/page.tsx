"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab") || "instructions";
    router.replace(`/agent-studio?tab=${tab}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-slate-600">Redirecting to AI Agent Configuration...</p>
    </div>
  );
}

export default function AiAgentConfigurationAdminRedirectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RedirectHandler />
    </Suspense>
  );
}
