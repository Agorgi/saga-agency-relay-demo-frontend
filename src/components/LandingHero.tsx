"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { HeroChatMorph } from "@/components/web-chat/HeroChatMorph";
import { WEB_CHAT_RESET_EVENT } from "@/components/web-chat/useWebChat";

export function LandingHero() {
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
          isConversationOpen ? "max-w-[460px]" : "max-w-[900px]"
        }`}
      >
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
        </motion.div>
      </div>
    </div>
  );
}
