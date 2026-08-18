"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the map component with SSR disabled.
// maplibre-gl accesses window/document at import time and renders blank
// when server-rendered. Loading it client-only fixes the first-visit blank screen.
const GeoMapClient = dynamic(() => import("./geo-map-client"), {
  ssr: false,
  loading: () => (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96" />
    </div>
  ),
});

export default function GeoMap() {
  return <GeoMapClient />;
}
