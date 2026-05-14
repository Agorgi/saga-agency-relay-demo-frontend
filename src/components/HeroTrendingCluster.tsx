"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FEATURED_CREATORS } from "@/data/talentData";
import { seededRandom } from "@/lib/seededRandom";
import { useState } from "react";

export function HeroTrendingCluster() {
  const creators = FEATURED_CREATORS.slice(0, 18);
  const [heroError, setHeroError] = useState(false);
  const featured = FEATURED_CREATORS[3];
  const rand = seededRandom(82);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="relative h-[430px] w-[420px]"
    >
      <div className="pointer-events-none absolute left-[126px] top-[54px] z-1 h-[340px] w-[240px] overflow-hidden">
        <Image
          src="/branding/saga-san-hero.png"
          alt="Saga mascot"
          fill
          sizes="240px"
          className="object-contain object-center drop-shadow-[0_30px_50px_rgba(71,37,255,0.26)]"
        />
      </div>

      {creators.map((creator, index) => {
        const angle = (index / creators.length) * Math.PI * 2 + rand() * 0.55;
        const radius = 118 + rand() * 64;
        const x = Math.cos(angle) * radius + 136;
        const y = Math.sin(angle) * radius + 160;
        const size = 34 + rand() * 24;

        return (
          <motion.div
            key={creator.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.74, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 0.45 + index * 0.03,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="absolute z-10 overflow-hidden rounded-[40%_60%_55%_45%/55%_45%_60%_40%] border border-white/60 shadow-[0_12px_25px_rgba(17,17,17,0.06)]"
            style={{ left: x, top: y, width: size, height: size }}
          >
            <Image
              src={creator.imageUrl}
              alt={creator.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          </motion.div>
        );
      })}

      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="brand-surface-strong absolute left-[170px] top-[226px] z-20 w-[182px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[30px] p-2"
      >
        <div className="relative h-[126px] overflow-hidden rounded-[22px]">
          {!heroError ? (
            <Image
              src={featured.imageUrl}
              alt={featured.name}
              fill
              sizes="174px"
              className="object-cover"
              onError={() => setHeroError(true)}
            />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#ddd5cb,#f1efe9)]" />
          )}
          <div className="brand-chip-signal absolute left-2 top-2 rounded-pill px-2 py-1 text-[9px] font-medium uppercase tracking-[0.22em]">
            Real talent
          </div>
        </div>
        <div className="px-1 pb-1 pt-3">
          <p className="text-sm font-medium tracking-tight text-ink">{featured.name}</p>
          <p className="mt-1 text-[11px] font-light text-ink-light">
            {featured.primaryRole} with {featured.clients.slice(0, 2).join(" + ")}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
