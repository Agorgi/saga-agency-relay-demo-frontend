"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAppStore } from "@/store/useAppStore";

export function FanFeedView() {
  const events = useAppStore((state) => state.events);
  const { openEvent } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[980px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[30px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
            Discover
          </p>
          <h1
            data-copy-lint="header"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            Plans for tonight.
          </h1>
          <p
            data-copy-lint="subhead"
            className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}
          >
            Pick something nearby.
          </p>
        </motion.section>

        <div className="space-y-4">
          {events.slice(0, 5).map((event, index) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`overflow-hidden rounded-[28px] border ${
                isDark
                  ? "border-white/8 bg-white/[0.04]"
                  : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
              }`}
            >
              <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                <div className="relative h-[220px] md:h-full">
                  <Image
                    src={event.heroImage || "/branding/saga-mark-cobalt.png"}
                    alt={event.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 220px"
                    className="object-cover"
                  />
                </div>
                <div className="p-5">
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/40" : "text-ink-light"}`}>
                    {event.city}
                  </p>
                  <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                    {event.title}
                  </h2>
                  <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/60" : "text-ink-light"}`}>
                    {event.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {event.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                          isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink-light"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => openEvent(event.id)}
                    className="brand-button-primary mt-5 rounded-pill px-4 py-2.5 text-sm font-medium"
                  >
                    See details
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}
