"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState, type DragEvent } from "react";
import { CreatorMatch } from "@/data/talentData";
import { TALENT_TILE_ASPECT_RATIO, TALENT_TILE_BASE_WIDTH } from "@/lib/seededRandom";
import { useAppStore } from "@/store/useAppStore";

interface ImageTileProps {
  creator: CreatorMatch;
  style?: React.CSSProperties;
  scale?: number;
  index?: number;
  rotate?: number;
  parallaxDepth?: number;
  viewportOffset?: { x: number; y: number };
}

export function ImageTile({
  creator,
  style,
  scale = 1,
  index = 0,
  rotate = 0,
  parallaxDepth = 0,
  viewportOffset = { x: 0, y: 0 },
}: ImageTileProps) {
  const hoveredCreatorId = useAppStore((state) => state.hoveredCreatorId);
  const setHoveredCreator = useAppStore((state) => state.setHoveredCreator);
  const focusCreator = useAppStore((state) => state.focusCreator);
  const addCreatorToShortlist = useAppStore((state) => state.addCreatorToShortlist);
  const isHovered = hoveredCreatorId === creator.id;
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const width = TALENT_TILE_BASE_WIDTH * scale;
  const height = width * TALENT_TILE_ASPECT_RATIO;
  const depthMultiplier = 0.16 + parallaxDepth * 1.18;
  const parallaxX = -viewportOffset.x * depthMultiplier * 0.18;
  const parallaxY = -viewportOffset.y * depthMultiplier * 0.18;
  const depthLift = Math.max(0, parallaxDepth - 0.35) * 18;
  const tileDepth = Math.round((scale * 120) + parallaxDepth * 160);
  const tileShadow = `0 ${18 + parallaxDepth * 14}px ${42 + parallaxDepth * 18}px rgba(17,17,17,${0.07 + parallaxDepth * 0.06})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.72,
        delay: Math.min(index * 0.015, 1.5),
        ease: [0.23, 1, 0.32, 1],
      }}
      style={{ ...style, width, height, zIndex: tileDepth }}
      onMouseEnter={() => setHoveredCreator(creator.id)}
      onMouseLeave={() => setHoveredCreator(null)}
      onClick={() => focusCreator(creator)}
      onDoubleClick={() => addCreatorToShortlist(creator.id)}
      className="group image-tile-click absolute cursor-pointer"
    >
      <div
        draggable
        onDragStart={(event: DragEvent<HTMLDivElement>) => {
          event.dataTransfer.setData("text/plain", creator.id);
          event.dataTransfer.effectAllowed = "copy";
        }}
        className="h-full w-full"
      >
        <motion.div
          animate={{ x: parallaxX, y: parallaxY - depthLift, rotate }}
          transition={{ type: "spring", stiffness: 86, damping: 24, mass: 1.05 }}
          whileHover={{ y: -6, rotate: rotate + (scale > 1.2 ? -0.4 : 0.4) }}
          className="relative h-full w-full"
          style={{ willChange: "transform" }}
        >
          <motion.div
            animate={{
              opacity: isHovered ? 0.56 : 0,
              scale: isHovered ? 1.12 : 1,
            }}
            transition={{ duration: 0.28 }}
            className="pointer-events-none absolute -inset-4 rounded-[38%_62%_56%_44%/58%_42%_58%_42%] bg-accent"
            style={{ filter: "blur(16px)" }}
          />

          <div
            className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/56 backdrop-blur-xl"
            style={{ boxShadow: tileShadow }}
          >
            {!imgError ? (
              <Image
                src={creator.imageUrl}
                alt={creator.name}
                fill
                sizes="(max-width: 640px) 38vw, (max-width: 768px) 42vw, 240px"
                className={`object-cover transition-all duration-500 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setLoaded(true)}
                onError={() => setImgError(true)}
              />
            ) : null}

            {(!loaded || imgError) && (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,_#dfd9cf,_#f6f3ee)]" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(15,15,15,0)_45%,rgba(15,15,15,0.74)_100%)]" />

            <div className="absolute left-2 top-2 flex items-center gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
              <span className="rounded-pill bg-white/82 px-2 py-1 text-[9px] font-medium text-ink shadow-sm sm:px-2.5 sm:text-[10px]">
                {creator.overallScore}
              </span>
              <span className="rounded-pill bg-ink/72 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/88 sm:px-2.5 sm:text-[10px]">
                {creator.bestRole}
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <p className="text-sm font-medium tracking-tight text-white sm:text-base">
                {creator.name}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-light text-white/76 sm:text-xs">
                {creator.matchReasons[0] || creator.style}
              </p>
              <div className="mt-2 flex items-center justify-between sm:mt-3">
                <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/72 sm:text-[10px]">
                  {creator.primaryRole}
                </span>
                <span className="max-w-[42%] truncate text-right text-[9px] font-medium uppercase tracking-[0.16em] text-white/72 sm:text-[10px]">
                  {creator.clients[0]}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
