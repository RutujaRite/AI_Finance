"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AiAgentStudioRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/agent-studio?tab=models");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-slate-600">Redirecting to AI Agent Configuration...</p>
    </div>
  );
}
