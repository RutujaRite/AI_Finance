'use client';

import React, { Suspense } from 'react';
import CreditWiseDashboard from '@/components/dashboard/CreditWiseDashboard';

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading CreditWise AI...</span>
        </div>
      </div>
    }>
      <CreditWiseDashboard />
    </Suspense>
  );
}
