"use client";

import { createContext, useContext, useState } from "react";
import type { CheckMeasurements } from "@/lib/resume/check";

const DEFAULT: CheckMeasurements = {
  pageCount: 1,
  overflowPx: 0,
  nearOverflowRatio: 0,
  unusedRatio: 0,
  renderFailed: false,
  clippedBulletIds: [],
  bulletLineCounts: {},
};

type MeasurementCtx = {
  measurements: CheckMeasurements;
  setMeasurements: (m: CheckMeasurements) => void;
};

const Ctx = createContext<MeasurementCtx | null>(null);

export function MeasurementProvider({ children }: { children: React.ReactNode }) {
  const [measurements, setMeasurements] = useState<CheckMeasurements>(DEFAULT);
  return <Ctx.Provider value={{ measurements, setMeasurements }}>{children}</Ctx.Provider>;
}

export function useMeasurements(): MeasurementCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMeasurements must be used within MeasurementProvider");
  return ctx;
}
