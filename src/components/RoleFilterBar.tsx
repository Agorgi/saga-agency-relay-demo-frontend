"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";

export function RoleFilterBar() {
  const detectedRoles = useAppStore((state) => state.detectedRoles);
  const activeRoleFilter = useAppStore((state) => state.activeRoleFilter);
  const setActiveRoleFilter = useAppStore((state) => state.setActiveRoleFilter);
  const canvasCreators = useAppStore((state) => state.canvasCreators);

  const counts = useMemo(() => {
    return detectedRoles.reduce<Record<string, number>>((acc, role) => {
      acc[role] = canvasCreators.filter(
        (creator) =>
          creator.bestRole === role ||
          creator.primaryRole === role ||
          creator.matchedRoles.includes(role)
      ).length;
      return acc;
    }, {});
  }, [canvasCreators, detectedRoles]);

  const visibleRoles = detectedRoles.filter((role) => (counts[role] || 0) > 0);

  return (
    <div className="pointer-events-auto overflow-x-auto no-scrollbar sm:w-fit sm:overflow-visible">
      <div className="flex min-w-max items-center gap-2 rounded-[24px] border border-white/60 bg-white/76 px-2.5 py-2 shadow-[0_18px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl sm:justify-center sm:rounded-pill sm:px-3">
        <FilterPill
          active={!activeRoleFilter}
          label={`All × ${canvasCreators.length}`}
          onClick={() => setActiveRoleFilter(null)}
        />
        {visibleRoles.map((role) => (
          <FilterPill
            key={role}
            active={activeRoleFilter === role}
            label={`${role} × ${counts[role] || 0}`}
            onClick={() => setActiveRoleFilter(activeRoleFilter === role ? null : role)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`whitespace-nowrap rounded-pill px-3 py-2 text-[11px] font-medium tracking-tight transition-colors sm:text-xs ${
        active ? "bg-accent text-ink" : "bg-canvas text-ink-light hover:text-ink"
      }`}
    >
      {label}
    </motion.button>
  );
}
