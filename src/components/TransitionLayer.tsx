"use client";

import { motion } from "framer-motion";

export function TransitionLayer() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-canvas/82 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.06, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/35">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
            className="h-8 w-8 rounded-full border-2 border-ink border-t-transparent"
          />
        </div>
        <p className="text-sm font-light tracking-wide text-ink-light">
          Spiraling deeper into the talent field...
        </p>
      </motion.div>
    </motion.div>
  );
}
