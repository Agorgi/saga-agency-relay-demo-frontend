"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

export function AnalyzingScreen() {
  const query = useAppStore((state) => state.query);
  const analysis = useAppStore((state) => state.analysis);

  const roles = analysis?.roles || [];

  return (
    <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-[880px] rounded-[30px] border border-white/60 bg-white/70 p-5 shadow-[0_32px_80px_rgba(17,17,17,0.08)] backdrop-blur-xl sm:rounded-[36px] sm:p-8 md:p-10">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-8">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-ink-light">
              Saga Intelligence
            </p>
            <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-ink sm:text-3xl md:text-4xl">
              Reading the brief and mapping the crew.
            </h2>
            <p className="mt-4 max-w-[520px] text-sm leading-6 text-ink-light md:text-base">
              We&apos;re translating <span className="font-medium text-ink">{query}</span> into roles,
              visual cues, and taste signals before dropping you into the talent field.
            </p>

            <div className="mt-6 space-y-3">
              {[
                "Parsing the project vibe and production format",
                "Detecting the strongest roles to fill first",
                "Scoring the creative roster across fit, brand, and style",
              ].map((label, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.18 + index * 0.12 }}
                  className="flex items-center gap-3 rounded-[24px] bg-canvas/80 px-4 py-3"
                >
                  <motion.span
                    animate={{ scale: [1, 1.16, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.18 }}
                    className="h-2.5 w-2.5 rounded-full bg-accent"
                  />
                  <span className="text-sm text-ink">{label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] bg-canvas/82 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)] sm:rounded-[30px] sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
                Detected roles
              </p>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/35">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.25, ease: "linear" }}
                  className="h-6 w-6 rounded-full border-2 border-ink/80 border-t-transparent"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {roles.map((role, index) => (
                <motion.span
                  key={role}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.25 + index * 0.08 }}
                  className="rounded-pill bg-white/86 px-3 py-2 text-xs font-medium tracking-tight text-ink shadow-sm"
                >
                  {role}
                </motion.span>
              ))}
            </div>

            {analysis && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetaCard label="Location" value={analysis.location} />
                <MetaCard label="Budget" value={analysis.budget} />
                <MetaCard label="Timeline" value={analysis.timeline} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white/76 px-4 py-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-5 text-ink">{value}</p>
    </div>
  );
}
