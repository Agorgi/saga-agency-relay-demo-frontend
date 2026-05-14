"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function SelectionTray() {
  const similarCreators = useAppStore((state) => state.similarCreators);
  const selectedCreatorIds = useAppStore((state) => state.selectedCreatorIds);
  const goDeeper = useAppStore((state) => state.goDeeper);
  const openAssembly = useAppStore((state) => state.openAssembly);
  const teamCount = Object.keys(useAppStore((state) => state.teamSlots)).length;

  const selectedCreators = similarCreators.filter((creator) =>
    selectedCreatorIds.has(creator.id)
  );
  const boardLabel = teamCount
    ? `Build Team (${teamCount})`
    : selectedCreators.length
      ? `Crew Board (${selectedCreators.length})`
      : "Crew Board";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-[28px] border border-white/60 bg-white/84 px-4 py-3 shadow-[0_20px_50px_rgba(17,17,17,0.08)] backdrop-blur-xl lg:w-auto lg:max-w-none lg:flex-row lg:items-center lg:gap-4 lg:rounded-pill"
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar lg:overflow-visible">
        <AnimatePresence mode="popLayout">
          {selectedCreators.map((creator) => (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-accent"
            >
              <TrayThumb src={creator.imageUrl} alt={creator.name} />
            </motion.div>
          ))}
        </AnimatePresence>
        {selectedCreators.length === 0 && (
          <span className="px-2 text-xs font-light text-ink-light">
            Select up to five creators to spiral deeper.
          </span>
        )}
      </div>

      {selectedCreators.length > 0 && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-ink">
          {selectedCreators.length}
        </span>
      )}

      <div className="flex w-full items-center gap-2 lg:w-auto">
        <motion.button
          onClick={goDeeper}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={selectedCreators.length === 0}
          className="flex-1 rounded-pill bg-accent px-4 py-2.5 text-sm font-medium tracking-tight text-ink disabled:cursor-not-allowed disabled:bg-canvas-dark disabled:text-ink-light lg:flex-none lg:py-2"
        >
          Go Deeper
        </motion.button>
        <motion.button
          onClick={openAssembly}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex-1 rounded-pill bg-canvas px-4 py-2.5 text-sm font-medium tracking-tight text-ink lg:flex-none lg:py-2"
        >
          {boardLabel}
        </motion.button>
      </div>
    </motion.div>
  );
}

function TrayThumb({ src, alt }: { src: string; alt: string }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!imgError ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="40px"
          className={`object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : null}
      {(!loaded || imgError) && (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#ddd5cb,#f0ece6)]" />
      )}
    </>
  );
}
