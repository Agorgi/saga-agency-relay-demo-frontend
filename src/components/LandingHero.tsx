"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { HeroTrendingCluster } from "./HeroTrendingCluster";
import { HeroChatMorph } from "@/components/web-chat/HeroChatMorph";
import { WEB_CHAT_RESET_EVENT } from "@/components/web-chat/useWebChat";
import { useSagaNavigation } from "@/lib/useSagaNavigation";

export function LandingHero() {
  const { openPostProject, goTalent } = useSagaNavigation();
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    function handleReset() {
      setIsConversationOpen(false);
      setResetKey((current) => current + 1);
    }

    window.addEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden px-4 pt-24 sm:px-6 sm:pt-20 lg:px-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[45vw] bg-[radial-gradient(circle_at_left_center,rgba(255,79,158,0.1),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[50vw] bg-[radial-gradient(circle_at_right_center,rgba(126,164,255,0.14),transparent_60%)]" />

      <div
        className={`relative z-10 mx-auto flex w-full items-center justify-center ${
          isConversationOpen ? "max-w-[460px]" : "max-w-[1320px] gap-12 xl:gap-16"
        }`}
      >
        <AnimatePresence>
          {!isConversationOpen ? (
            <motion.div
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              className="relative hidden h-[430px] w-[360px] shrink-0 lg:block xl:w-[420px]"
            >
              <div className="absolute left-[-1.75rem] top-[-0.5rem] xl:left-[-1rem]">
                <HeroTrendingCluster />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className={`flex w-full flex-col items-center text-center ${
            isConversationOpen ? "max-w-[440px] justify-center" : "max-w-[860px] gap-7"
          }`}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {!isConversationOpen ? (
              <motion.div
                key="landing-copy"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                className="flex w-full flex-col items-center gap-7"
              >
                <div className="brand-chip inline-flex rounded-pill px-4 py-2 text-[10px] font-medium tracking-[0.1em] text-ink-light sm:text-[11px]">
                  Real creatives for real creatives
                </div>

                <h1 className="brand-display max-w-[900px] text-[2.9rem] leading-[0.92] font-semibold tracking-[-0.04em] text-ink sm:text-5xl md:text-6xl lg:text-[4.6rem] xl:text-[5rem]">
                  Your personal creative <br className="hidden md:block" />
                  producer.
                </h1>

                <p className="max-w-[660px] text-[15px] font-light leading-7 text-ink-light sm:text-base md:text-lg">
                  Describe your project and Saga helps build a team with the taste, talent, and
                  cultural fluency your vision deserves.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div
            layout
            transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="w-full"
          >
            <HeroChatMorph
              key={resetKey}
              onExpandedChange={(expanded) => {
                setIsConversationOpen(expanded);
              }}
            />
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            {!isConversationOpen ? (
              <motion.div
                key="landing-actions"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                className="flex w-full flex-col items-center gap-6"
              >
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={openPostProject}
                    className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
                  >
                    Post a Project
                  </button>
                  <button
                    onClick={() => goTalent()}
                    className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
                  >
                    Explore Talent
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light sm:gap-3 sm:text-[11px]">
                  <span className="brand-chip rounded-pill px-3 py-1.5">Idea</span>
                  <span className="brand-chip rounded-pill px-3 py-1.5">Match</span>
                  <span className="brand-chip rounded-pill px-3 py-1.5">Relay</span>
                  <span className="brand-chip rounded-pill px-3 py-1.5">Book</span>
                  <span className="brand-chip rounded-pill px-3 py-1.5">Produce</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
