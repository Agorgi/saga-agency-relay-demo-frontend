"use client";

import { motion } from "framer-motion";
import { CreatorMatch } from "@/data/talentData";
import { useAppStore } from "@/store/useAppStore";

interface FocusInfoCardProps {
  creator: CreatorMatch;
}

export function FocusInfoCard({ creator }: FocusInfoCardProps) {
  const teamSlots = useAppStore((state) => state.teamSlots);
  const assignedRole = Object.entries(teamSlots).find(
    ([, assignedCreator]) => assignedCreator.id === creator.id
  )?.[0];
  const primaryMatch = creator.roleMatches[assignedRole || creator.bestRole];

  return (
    <motion.div
      initial={{ opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.5, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-[420px] rounded-[28px] border border-white/65 bg-white/72 p-5 shadow-[0_22px_60px_rgba(17,17,17,0.08)] backdrop-blur-xl sm:rounded-[30px] sm:p-6 lg:max-w-none lg:p-5 xl:w-[308px]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            Creator profile
          </p>
          <h3 className="mt-2 text-xl font-medium tracking-tight text-ink sm:text-2xl">
            {creator.name}
          </h3>
          <p className="mt-1 text-sm font-light text-ink-light">
            {creator.primaryRole} · {creator.city}
          </p>
        </div>
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-accent/45 text-ink shadow-[0_12px_30px_rgba(86,201,255,0.2)] sm:h-16 sm:w-16">
          <span className="text-lg font-semibold">{creator.overallScore}</span>
          <span className="text-[10px] uppercase tracking-[0.16em]">Match</span>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] bg-canvas/82 p-4 lg:mt-4 lg:p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
            Best slot
          </span>
          <span className="rounded-pill bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm">
            {assignedRole || creator.bestRole}
          </span>
        </div>

        {primaryMatch && (
          <div className="mt-4 space-y-3 lg:mt-3 lg:space-y-2.5">
            <BreakdownRow label="Skill fit" value={primaryMatch.skillFit} max={54} />
            <BreakdownRow label="Brand relevance" value={primaryMatch.brandRelevance} max={24} />
            <BreakdownRow label="Style match" value={primaryMatch.styleMatch} max={21} />
          </div>
        )}
      </div>

      <div className="mt-5 lg:mt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
          Skills
        </p>
        <div className="mt-3 flex flex-wrap gap-2 lg:mt-2.5">
          {creator.skills.slice(0, 6).map((skill) => (
            <span
              key={skill}
              className="rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-medium text-ink-light"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:mt-4 lg:gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
            Clients
          </p>
          <p className="mt-2 text-sm leading-6 text-ink lg:leading-5">
            {creator.clients.slice(0, 5).join(" · ")}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
            Style note
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-light lg:leading-5">{creator.style}</p>
        </div>
      </div>
    </motion.div>
  );
}

function BreakdownRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = `${Math.max(14, (value / max) * 100)}%`;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-ink-light">
        <span>{label}</span>
        <span className="font-medium text-ink">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white">
        <div className="h-full rounded-full bg-accent" style={{ width }} />
      </div>
    </div>
  );
}
