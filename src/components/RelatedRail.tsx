"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function RelatedRail() {
  const similarCreators = useAppStore((state) => state.similarCreators);
  const selectedCreatorIds = useAppStore((state) => state.selectedCreatorIds);
  const toggleCreatorSelection = useAppStore((state) => state.toggleCreatorSelection);
  const visibleCreators = similarCreators.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.5, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full gap-3 overflow-x-auto no-scrollbar pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      <p className="sticky left-0 px-1 pt-2 text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light lg:pt-0">
        Similar creators
      </p>
      {visibleCreators.map((creator, index) => (
        <RelatedCard
          key={creator.id}
          creator={creator}
          index={index}
          isSelected={selectedCreatorIds.has(creator.id)}
          onToggle={() => toggleCreatorSelection(creator.id)}
        />
      ))}
    </motion.div>
  );
}

function RelatedCard({
  creator,
  index,
  isSelected,
  onToggle,
}: {
  creator: ReturnType<typeof useAppStore.getState>["similarCreators"][number];
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.42,
        delay: 0.2 + index * 0.05,
        ease: [0.23, 1, 0.32, 1],
      }}
      onClick={onToggle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex min-w-[190px] items-center gap-3 rounded-[24px] border bg-white/76 p-3 text-left shadow-[0_14px_30px_rgba(17,17,17,0.06)] backdrop-blur-xl lg:min-w-0 lg:px-3 lg:py-2.5 ${
        index >= 5 ? "lg:hidden" : ""
      } ${
        isSelected ? "border-accent" : "border-white/60"
      }`}
    >
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[36%_64%_56%_44%/52%_48%_52%_48%] lg:h-[72px] lg:w-[58px]">
        {!imgError ? (
          <Image
            src={creator.imageUrl}
            alt={creator.name}
            fill
            sizes="80px"
            className={`object-cover transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : null}
        {(!loaded || imgError) && (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#ddd5cb,#f0ece6)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight text-ink lg:text-[13px]">
          {creator.name}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-light lg:text-[10px]">
          {creator.bestRole}
        </p>
        <p className="mt-2 text-xs text-ink-light lg:mt-1.5 lg:text-[11px]">
          {creator.overallScore} match
        </p>
      </div>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
}
