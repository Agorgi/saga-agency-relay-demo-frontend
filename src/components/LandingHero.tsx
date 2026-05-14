"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SearchPill } from "./SearchPill";
import { ChatWidget } from "@/components/web-chat/ChatWidget";
import { useSagaNavigation } from "@/lib/useSagaNavigation";

export function LandingHero() {
  const { openPostProject, goTalent } = useSagaNavigation();

  return (
    <div className="relative flex min-h-full w-full items-center overflow-visible px-4 pb-10 pt-24 sm:px-6 sm:pt-20 lg:px-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[45vw] bg-[radial-gradient(circle_at_left_center,rgba(255,79,158,0.1),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[50vw] bg-[radial-gradient(circle_at_right_center,rgba(126,164,255,0.14),transparent_60%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1320px] items-center gap-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,500px)_minmax(0,1fr)] xl:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="order-2 w-full lg:order-1"
        >
          <div className="mx-auto max-w-[520px] lg:mx-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="brand-chip rounded-pill px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-light">
                Talk to Saga
              </span>
              <span className="rounded-pill bg-white/60 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-light">
                Private relay
              </span>
            </div>
            <ChatWidget />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          className="order-1 flex flex-col items-center gap-7 text-center lg:order-2 lg:items-start lg:text-left"
        >
          <div className="brand-chip inline-flex rounded-pill px-4 py-2 text-[10px] font-medium tracking-[0.1em] text-ink-light sm:text-[11px]">
            Real creatives for real creatives
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
            className="brand-display max-w-[900px] text-[2.9rem] leading-[0.92] font-semibold tracking-[-0.04em] text-ink sm:text-5xl md:text-6xl lg:text-[4.6rem] xl:text-[5rem]"
          >
            The AI talent agency <br className="hidden md:block" />
            <span className="brand-accent-serif text-[1.05em] font-semibold text-[#3f2fff]">
              for creative production.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="max-w-[660px] text-[15px] font-light leading-7 text-ink-light sm:text-base md:text-lg"
          >
            Start with the chat. Saga helps shape the brief, finds the right creative team, and
            keeps outreach inside a private relay so no one has to cold DM or leak contact details.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <SearchPill variant="hero" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <Link
              href="/chat"
              className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Start with Chat
            </Link>
            <button
              onClick={openPostProject}
              className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Post a Project
            </button>
            <button
              onClick={() => goTalent()}
              className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Explore Talent
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light sm:gap-3 sm:text-[11px] lg:justify-start"
          >
            <span className="brand-chip rounded-pill px-3 py-1.5">Idea</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Brief</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Match</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Relay</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Book</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Produce</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.42 }}
            className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light sm:gap-3 sm:text-[11px] lg:justify-start"
          >
            <span className="brand-chip rounded-pill px-3 py-1.5">Portfolio-fit candidates</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">Budget-fit booking</span>
            <span className="brand-chip rounded-pill px-3 py-1.5">No contact leakage</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
