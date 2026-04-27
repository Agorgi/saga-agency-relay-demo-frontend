"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";

export function LeftActionButtons() {
  const focusedCreator = useAppStore((state) => state.focusedCreator);
  const activeRoleFilter = useAppStore((state) => state.activeRoleFilter);
  const detectedRoles = useAppStore((state) => state.detectedRoles);
  const teamSlots = useAppStore((state) => state.teamSlots);
  const assignFocusedCreator = useAppStore((state) => state.assignFocusedCreator);
  const openAssembly = useAppStore((state) => state.openAssembly);

  const targetRole = useMemo(() => {
    if (!focusedCreator) return null;
    if (activeRoleFilter && detectedRoles.includes(activeRoleFilter)) return activeRoleFilter;
    if (!teamSlots[focusedCreator.bestRole]) return focusedCreator.bestRole;
    return detectedRoles.find((role) => !teamSlots[role]) || focusedCreator.bestRole;
  }, [activeRoleFilter, detectedRoles, focusedCreator, teamSlots]);

  if (!focusedCreator) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="flex w-full flex-wrap gap-3 md:w-auto lg:flex-col xl:w-auto"
    >
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => assignFocusedCreator(targetRole || undefined)}
        className="flex min-h-[56px] flex-1 items-center justify-center rounded-[22px] bg-accent px-4 text-center text-sm font-medium tracking-tight text-ink shadow-[0_14px_30px_rgba(86,201,255,0.24)] md:min-h-[64px] md:text-left lg:w-[168px] lg:flex-none xl:w-[168px]"
      >
        {targetRole ? `Lock as ${targetRole}` : "Lock into team"}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.open(focusedCreator.instagram, "_blank", "noopener,noreferrer")}
        className="flex h-12 min-w-[48px] flex-1 items-center justify-center gap-2 rounded-pill bg-white/82 px-4 text-ink shadow-sm backdrop-blur-lg md:h-14 md:flex-none md:rounded-full md:px-0 lg:w-14 xl:w-14"
        aria-label="Open Instagram"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2.5" y="2.5" width="13" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="13.2" cy="4.8" r="0.9" fill="currentColor" />
        </svg>
        <span className="text-sm md:hidden">Instagram</span>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={openAssembly}
        className="flex h-12 min-w-[48px] flex-1 items-center justify-center gap-2 rounded-pill bg-white/82 px-4 text-ink shadow-sm backdrop-blur-lg md:h-14 md:flex-none md:rounded-full md:px-0 lg:w-14 xl:w-14"
        aria-label="Open team assembly"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="5.2" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="12.8" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.8 14c.7-2 2-3 4.1-3 2.2 0 3.6 1 4.3 3M8.9 14c.7-2 2.1-3 4.2-3 1 0 1.9.2 2.7.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="text-sm md:hidden">Crew board</span>
      </motion.button>
    </motion.div>
  );
}
