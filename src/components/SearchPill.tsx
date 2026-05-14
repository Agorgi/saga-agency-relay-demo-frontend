"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAgencyStore } from "@/store/useAgencyStore";
import { useSagaNavigation } from "@/lib/useSagaNavigation";

const HERO_PROMPTS = [
  "I want to throw a mini anime con followed by a Pokémon warehosue rave",
  "Need a photographer and stylist for a J-fashion campaign in LA",
  "Looking for a producer, DP, and editor for an indie game trailer in New York",
  "Need fandom-native talent for an anime streetwear pop-up in San Francisco",
  "Book a creator-led beauty content team in Miami",
];

interface SearchPillProps {
  variant?: "hero" | "compact";
}

export function SearchPill({ variant = "hero" }: SearchPillProps) {
  const createProjectFromPrompt = useAgencyStore((state) => state.createProjectFromPrompt);
  const setTalentSearchQuery = useAgencyStore((state) => state.setTalentSearchQuery);
  const [localQuery, setLocalQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { goTalent, openProject } = useSagaNavigation();

  useEffect(() => {
    setLocalQuery("");
  }, [variant]);

  const isHero = variant === "hero";
  const hasText = localQuery.trim().length > 0;

  const handleSubmit = (value?: string) => {
    const nextQuery = (value || localQuery).trim();
    if (!nextQuery) return;
    if (isHero) {
      const nextProject = createProjectFromPrompt(nextQuery);
      openProject(nextProject.id);
    } else {
      setTalentSearchQuery(nextQuery);
      goTalent();
      setLocalQuery("");
    }
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <motion.div
        layout
        whileHover={{ boxShadow: "0 18px 54px rgba(64, 44, 128, 0.16)" }}
        className={`brand-surface-strong relative flex items-center gap-3 ${
          isHero
            ? "w-[640px] max-w-[calc(100vw-1.5rem)] rounded-[28px] px-4 py-3.5 sm:max-w-[92vw] sm:rounded-pill sm:px-5 sm:py-4"
            : "w-[520px] max-w-[calc(100vw-1rem)] rounded-[26px] px-3.5 py-3 sm:max-w-[88vw] sm:rounded-pill sm:px-4"
        }`}
      >
        <div
          className={`brand-surface-inset flex shrink-0 items-center justify-center rounded-full ${
            isHero ? "h-10 w-10 sm:h-11 sm:w-11" : "h-9 w-9"
          }`}
        >
          <svg
            width={isHero ? 18 : 15}
            height={isHero ? 18 : 15}
            viewBox="0 0 18 18"
            fill="none"
          >
            <circle cx="7.5" cy="7.5" r="5" stroke="#8f8b85" strokeWidth="1.5" />
            <path d="M11.5 11.5L16 16" stroke="#8f8b85" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          {!isHero && (
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
              Branch off
            </p>
          )}
          <input
            value={localQuery}
            type="text"
            placeholder={
              isHero
                ? "Describe the project. Saga finds the team."
                : "Search talent, tags, roles, or city..."
            }
            onChange={(event) => {
              setLocalQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSubmit();
              }
            }}
            className={`w-full bg-transparent text-ink outline-none placeholder:text-ink-light ${
              isHero
                ? "text-[15px] font-light tracking-tight sm:text-base"
                : "text-sm font-normal tracking-tight"
            }`}
          />
        </div>

        <motion.button
          onClick={() => handleSubmit()}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.2 }}
          className={`flex shrink-0 items-center justify-center rounded-full ${
            isHero ? "h-10 w-10 sm:h-11 sm:w-11" : "h-9 w-9"
          } ${hasText ? "brand-button-primary" : "brand-surface-inset"}`}
        >
          <svg
            width={isHero ? 16 : 14}
            height={isHero ? 16 : 14}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M3 8h10m0 0L9 4m4 4L9 12"
              stroke={hasText ? "#ffffff" : "#8f84ad"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </motion.div>

      {showSuggestions && isHero && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="brand-surface-strong absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[24px] sm:rounded-[28px]"
        >
          <div className="p-2">
            <p className="brand-kicker px-3 py-2 text-[10px] font-medium uppercase tracking-[0.24em]">
              Try a staffing prompt
            </p>
            {HERO_PROMPTS.map((item) => (
              <button
                key={item}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setLocalQuery(item);
                  handleSubmit(item);
                }}
                className="w-full rounded-2xl px-3 py-3 text-left text-sm font-light text-ink transition-colors duration-150 hover:bg-canvas"
              >
                {item}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
