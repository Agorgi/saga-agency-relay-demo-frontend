"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";
import { FloatingResultsCanvas } from "@/components/FloatingResultsCanvas";
import { FocusOverlay } from "@/components/FocusOverlay";
import { RoleFilterBar } from "@/components/RoleFilterBar";
import { SearchPill } from "@/components/SearchPill";
import { useAppStore } from "@/store/useAppStore";

export function WorkspaceDiscoverScene() {
  const phase = useAppStore((state) => state.phase);
  const query = useAppStore((state) => state.query);
  const depthLevel = useAppStore((state) => state.depthLevel);

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === "analyzing" ? (
          <motion.div
            key="discover-analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <AnalyzingScreen />
          </motion.div>
        ) : (
          <motion.div
            key={`discover-canvas-${depthLevel}-${query}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <FloatingResultsCanvas />
            <div className="fixed left-1/2 top-[4.75rem] z-40 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:w-auto sm:max-w-none sm:px-0">
              <RoleFilterBar />
            </div>
            <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:bottom-8 sm:w-auto sm:max-w-none sm:px-0">
              <SearchPill variant="compact" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === "focus" && <FocusOverlay />}</AnimatePresence>
    </>
  );
}
