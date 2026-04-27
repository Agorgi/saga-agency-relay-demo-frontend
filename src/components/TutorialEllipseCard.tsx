"use client";

import { motion } from "framer-motion";

const steps = ["Describe", "Discover", "Assemble", "Launch"];

export function TutorialEllipseCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.55, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.02 }}
      className="relative h-[178px] w-[340px] cursor-default"
    >
      <div
        className="absolute inset-0 border border-white/60 bg-white/60 backdrop-blur-xl shadow-[0_20px_50px_rgba(17,17,17,0.06)]"
        style={{ borderRadius: "50% / 46%" }}
      />

      <div className="relative z-10 flex h-full items-center gap-6 px-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-accent/50 text-ink shadow-[0_10px_30px_rgba(86,201,255,0.22)]">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14h16M14 6l8 8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            How it works
          </p>
          <p className="mt-2 text-sm font-medium leading-snug text-ink">
            Move from a loose vibe to a staffed project in one spiral.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.map((step) => (
              <span
                key={step}
                className="rounded-pill bg-canvas px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light"
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
