"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { FocusInfoCard } from "./FocusInfoCard";
import { LeftActionButtons } from "./LeftActionButtons";
import { RelatedRail } from "./RelatedRail";
import { SelectionTray } from "./SelectionTray";

export function FocusOverlay() {
  const focusedCreator = useAppStore((state) => state.focusedCreator);
  const query = useAppStore((state) => state.query);
  const closeFocus = useAppStore((state) => state.closeFocus);
  const canvasCreators = useAppStore((state) => state.canvasCreators);
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!focusedCreator) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeFocus}
        className="absolute inset-0 bg-canvas/86 backdrop-blur-md"
      />

      <div className="absolute left-4 right-16 top-4 z-20 mx-auto w-fit max-w-[calc(100vw-5rem)] rounded-pill bg-white/80 px-4 py-2 text-xs font-medium tracking-tight text-ink shadow-sm backdrop-blur-xl sm:left-1/2 sm:right-auto sm:top-6 sm:max-w-none sm:-translate-x-1/2">
        {query} · {canvasCreators.length} matches
      </div>

      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-20 sm:px-6 sm:py-24 lg:items-center lg:overflow-hidden lg:px-8 lg:py-16">
        <div className="flex w-full max-w-[1340px] flex-col gap-5 lg:h-[calc(100vh-11rem)] lg:max-h-[780px] lg:flex-row lg:items-center lg:justify-center lg:gap-6 lg:overflow-hidden">
          <div className="order-2 flex w-full flex-col gap-4 md:flex-row md:items-start lg:order-1 lg:w-[312px] lg:flex-shrink-0 lg:flex-col lg:items-stretch xl:w-auto xl:flex-row xl:items-center xl:gap-4">
            <LeftActionButtons />
            <FocusInfoCard creator={focusedCreator} />
          </div>

          <motion.div
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.86, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="order-1 flex w-full flex-col items-center lg:order-2 lg:max-w-[500px] lg:flex-1 xl:max-w-[520px] xl:flex-none"
          >
            <div className="w-full max-w-[540px] overflow-hidden rounded-[30px] border border-white/60 bg-white/60 shadow-[0_30px_80px_rgba(17,17,17,0.12)] sm:rounded-[34px]">
              {!imgError ? (
                <Image
                  src={focusedCreator.portfolioUrls[0]}
                  alt={focusedCreator.name}
                  width={540}
                  height={420}
                  sizes="(max-width: 768px) 90vw, 540px"
                  className={`h-[300px] w-full object-cover transition-opacity duration-500 sm:h-[360px] lg:h-[340px] xl:h-[390px] sm:w-[540px] ${
                    loaded ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => setLoaded(true)}
                  onError={() => setImgError(true)}
                />
              ) : null}
              {(!loaded || imgError) && (
                <div className="h-[300px] w-full bg-[linear-gradient(135deg,#ddd5cb,#f5f3ef)] sm:h-[360px] lg:h-[340px] xl:h-[390px] sm:w-[540px]" />
              )}
            </div>

            <div className="mt-3 grid w-full max-w-[540px] grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3">
              {focusedCreator.portfolioUrls.slice(1).map((src, index) => (
                <div
                  key={src}
                  className="overflow-hidden rounded-[24px] border border-white/55 bg-white/60 shadow-[0_12px_30px_rgba(17,17,17,0.05)]"
                >
                  <Image
                    src={src}
                    alt={`${focusedCreator.name} detail ${index + 1}`}
                    width={264}
                    height={136}
                    sizes="(max-width: 768px) 42vw, 264px"
                    className="h-[104px] w-full object-cover sm:h-[120px] lg:h-[96px] xl:h-[112px]"
                  />
                </div>
              ))}
            </div>
          </motion.div>

          <div className="order-3 w-full shrink-0 lg:w-[220px] xl:w-[240px]">
            <RelatedRail />
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 lg:bottom-8 lg:w-auto lg:max-w-none lg:px-0">
        <SelectionTray />
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        onClick={closeFocus}
        className="fixed right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm backdrop-blur-xl sm:right-8 sm:top-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.button>
    </motion.div>
  );
}
