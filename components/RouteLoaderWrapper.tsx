"use client";

import { Suspense } from "react";
import RouteLoader from "./RouteLoader";

export default function RouteLoaderWrapper() {
  return (
    <Suspense fallback={null}>
      <RouteLoader />
    </Suspense>
  );
}
