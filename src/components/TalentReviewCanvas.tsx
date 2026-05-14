"use client";

import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateTalentPositions, getTalentTileBaseWidth, TALENT_TILE_ASPECT_RATIO } from "@/lib/seededRandom";
import { useThemeMode } from "@/lib/useThemeMode";
import type { CreativeProject, TalentRecommendation } from "@/types/sagaAgency";

interface TalentReviewCanvasProps {
  recommendations: TalentRecommendation[];
  activeProject: CreativeProject | null;
  shortlistTarget: CreativeProject | null;
  onOpenProfile: (talentId: string) => void;
  onAddToShortlist: (talentId: string, roleName: string) => void;
  onAskSagaToReachOut: (talentId: string, roleName: string) => void;
  onBranchFromSelection?: (talentIds: string[]) => void;
  onOpenCrewBoard?: () => void;
  focusLabel?: string;
  showCanvasHeader?: boolean;
  canvasHeightClass?: string;
  maxVisibleDesktop?: number;
  maxVisibleMobile?: number;
  lightModeBoxes?: boolean;
  fullBleedDesktop?: boolean;
}

function clampOffset(
  nextOffset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  viewportSize: { w: number; h: number },
  restingOffset: { x: number; y: number }
) {
  const horizontalPadding = 120;
  const verticalPadding = 110;
  const minX = viewportSize.w - canvasW - horizontalPadding - restingOffset.x;
  const maxX = horizontalPadding - restingOffset.x;
  const minY = viewportSize.h - canvasH - verticalPadding - restingOffset.y;
  const maxY = verticalPadding - restingOffset.y;

  return {
    x: Math.max(minX, Math.min(maxX, nextOffset.x)),
    y: Math.max(minY, Math.min(maxY, nextOffset.y)),
  };
}

function fitScore(recommendation: TalentRecommendation) {
  return Math.round(
    recommendation.portfolioFitScore * 0.38 +
      recommendation.styleFitScore * 0.18 +
      recommendation.budgetFitScore * 0.14 +
      recommendation.availabilityLikelihood * 0.12 +
      recommendation.distributionScore * 0.18
  );
}

function shortlistCount(project: CreativeProject | null) {
  return project?.shortlistedTalentIds.length || 0;
}

type RoleAccent = {
  glow: string;
  border: string;
  pillBg: string;
  pillText: string;
  wash: string;
  edge: string;
};

function getRoleAccent(role: string): RoleAccent {
  const normalized = role.toLowerCase();

  if (/(photographer|videographer|director|dp|editor|motion)/.test(normalized)) {
    return {
      glow: "rgba(142,124,255,0.24)",
      border: "rgba(142,124,255,0.34)",
      pillBg: "rgba(142,124,255,0.16)",
      pillText: "#f4f1ff",
      wash: "rgba(142,124,255,0.2)",
      edge: "rgba(142,124,255,0.4)",
    };
  }

  if (/(illustrator|art director|creative director|set designer|designer|art)/.test(normalized)) {
    return {
      glow: "rgba(243,205,105,0.24)",
      border: "rgba(243,205,105,0.34)",
      pillBg: "rgba(243,205,105,0.18)",
      pillText: "#fff9e5",
      wash: "rgba(243,205,105,0.18)",
      edge: "rgba(243,205,105,0.42)",
    };
  }

  if (/(producer|host|social|vendor|event)/.test(normalized)) {
    return {
      glow: "rgba(139,205,168,0.24)",
      border: "rgba(139,205,168,0.34)",
      pillBg: "rgba(139,205,168,0.18)",
      pillText: "#eefcf4",
      wash: "rgba(139,205,168,0.18)",
      edge: "rgba(139,205,168,0.42)",
    };
  }

  if (/(stylist|hmua|hair|makeup|beauty)/.test(normalized)) {
    return {
      glow: "rgba(244,170,206,0.24)",
      border: "rgba(244,170,206,0.34)",
      pillBg: "rgba(244,170,206,0.18)",
      pillText: "#fff1f7",
      wash: "rgba(244,170,206,0.18)",
      edge: "rgba(244,170,206,0.42)",
    };
  }

  if (/(cosplayer|performer|talent|creator|dj|model)/.test(normalized)) {
    return {
      glow: "rgba(123,198,255,0.22)",
      border: "rgba(123,198,255,0.34)",
      pillBg: "rgba(123,198,255,0.18)",
      pillText: "#eef9ff",
      wash: "rgba(123,198,255,0.16)",
      edge: "rgba(123,198,255,0.42)",
    };
  }

  return {
    glow: "rgba(194,204,223,0.18)",
    border: "rgba(194,204,223,0.3)",
    pillBg: "rgba(194,204,223,0.16)",
    pillText: "#f8fbff",
    wash: "rgba(194,204,223,0.14)",
    edge: "rgba(194,204,223,0.36)",
  };
}

export function TalentReviewCanvas({
  recommendations,
  activeProject,
  shortlistTarget,
  onOpenProfile,
  onAddToShortlist,
  onAskSagaToReachOut,
  onBranchFromSelection,
  onOpenCrewBoard,
  focusLabel,
  showCanvasHeader = true,
  canvasHeightClass = "h-[640px] sm:h-[700px] xl:h-[780px]",
  maxVisibleDesktop = 26,
  maxVisibleMobile = 16,
  lightModeBoxes = false,
  fullBleedDesktop = false,
}: TalentReviewCanvasProps) {
  const themeMode = useThemeMode();
  const isDark = !lightModeBoxes && themeMode === "dark";
  const shouldReduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 1440, h: 860 });
  const dragStateRef = useRef({
    isDragging: false,
    didPan: false,
    dragStart: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
  });
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [focusedTalentId, setFocusedTalentId] = useState<string | null>(null);
  const [canvasGestureActive, setCanvasGestureActive] = useState(false);
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const smoothOffsetX = useSpring(offsetX, {
    stiffness: shouldReduceMotion ? 380 : 140,
    damping: shouldReduceMotion ? 42 : 28,
    mass: 0.72,
  });
  const smoothOffsetY = useSpring(offsetY, {
    stiffness: shouldReduceMotion ? 380 : 140,
    damping: shouldReduceMotion ? 42 : 28,
    mass: 0.72,
  });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({
        w: Math.max(320, Math.round(rect.width)),
        h: Math.max(420, Math.round(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const visibleLimit = useMemo(() => {
    if (viewportSize.w < 640) return Math.min(maxVisibleMobile, 12);
    if (viewportSize.w < 960) return Math.min(maxVisibleMobile, 14);
    if (viewportSize.w < 1280) return Math.min(maxVisibleDesktop, 20);
    if (viewportSize.w < 1536) return Math.min(maxVisibleDesktop, 24);
    return maxVisibleDesktop;
  }, [maxVisibleDesktop, maxVisibleMobile, viewportSize.w]);

  const visibleRecommendations = useMemo(
    () => recommendations.slice(0, visibleLimit),
    [recommendations, visibleLimit]
  );

  const activeRoles = useMemo(
    () => [...new Set(visibleRecommendations.map((recommendation) => recommendation.primaryRole))],
    [visibleRecommendations]
  );

  const isMobile = viewportSize.w < 1024;
  const tileBaseWidth = useMemo(() => getTalentTileBaseWidth(viewportSize.w), [viewportSize.w]);

  const canvasW = useMemo(() => {
    const widthMultiplier = isMobile ? 1.44 : viewportSize.w < 1280 ? 1.78 : 1.9;
    const minimumWidth = isMobile ? 1080 : 1800;
    return Math.max(viewportSize.w * widthMultiplier, minimumWidth, visibleRecommendations.length * 118);
  }, [isMobile, viewportSize.w, visibleRecommendations.length]);

  const canvasH = useMemo(() => {
    const heightMultiplier = isMobile ? 1.28 : viewportSize.h < 760 ? 1.66 : 1.78;
    const minimumHeight = isMobile ? 980 : 1500;
    return Math.max(viewportSize.h * heightMultiplier, minimumHeight, visibleRecommendations.length * 92);
  }, [isMobile, viewportSize.h, visibleRecommendations.length]);

  const positions = useMemo(() => {
    const seed =
      visibleRecommendations.length * 91 +
      activeRoles.join("").length * 17 +
      (activeProject?.title.charCodeAt(0) || 0) * 13;

    return generateTalentPositions(
      visibleRecommendations.map((recommendation) => ({
        bestRole: recommendation.primaryRole,
        primaryRole: recommendation.primaryRole,
        portfolioFitScore: recommendation.portfolioFitScore,
        styleFitScore: recommendation.styleFitScore,
        distributionScore: recommendation.distributionScore,
      })),
      seed,
      viewportSize.w,
      viewportSize.h,
      activeRoles,
      {
        canvasWidth: canvasW,
        canvasHeight: canvasH,
        spacingScale: isMobile
          ? 1.34
          : activeRoles.length > 1
            ? fullBleedDesktop
              ? 1.22
              : viewportSize.w < 1360
                ? 1.14
                : 1.18
            : fullBleedDesktop
              ? 1.06
              : viewportSize.w < 1360
                ? 1.04
                : 1.08,
      }
    );
  }, [activeProject?.title, activeRoles, canvasH, canvasW, fullBleedDesktop, isMobile, viewportSize.h, viewportSize.w, visibleRecommendations]);

  const restingOffset = useMemo(() => {
    if (!positions.length) {
      return {
        x: -(canvasW - viewportSize.w) / 2,
        y: -(canvasH - viewportSize.h) / 2,
      };
    }

    const sourcePositions = activeRoles.length > 1 ? positions : positions.slice(0, Math.min(positions.length, isMobile ? 10 : 12));

    const bounds = sourcePositions.reduce(
      (acc, position) => {
        const width = tileBaseWidth * position.scale;
        const height = width * TALENT_TILE_ASPECT_RATIO;
        return {
          minX: Math.min(acc.minX, position.x),
          minY: Math.min(acc.minY, position.y),
          maxX: Math.max(acc.maxX, position.x + width),
          maxY: Math.max(acc.maxY, position.y + height),
        };
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      }
    );

    const collageCenterX = (bounds.minX + bounds.maxX) / 2;
    const collageCenterY = (bounds.minY + bounds.maxY) / 2;
    const insets =
      isMobile
        ? { left: 16, right: 16, top: 56, bottom: 226 }
        : fullBleedDesktop
        ? { left: 330, right: 44, top: 88, bottom: 104 }
        : { left: 0, right: 0, top: 0, bottom: 0 };
    const visibleCenterX =
      insets.left + (viewportSize.w - insets.left - insets.right) / 2;
    const visibleCenterY =
      insets.top + (viewportSize.h - insets.top - insets.bottom) / 2 + (isMobile ? -10 : 12);

    return {
      x: visibleCenterX - collageCenterX,
      y: visibleCenterY - collageCenterY,
    };
  }, [activeRoles.length, canvasH, canvasW, fullBleedDesktop, isMobile, positions, tileBaseWidth, viewportSize.h, viewportSize.w]);

  const canvasTranslateX = useTransform(smoothOffsetX, (latest) => latest + restingOffset.x);
  const canvasTranslateY = useTransform(smoothOffsetY, (latest) => latest + restingOffset.y);

  const applyOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      const clamped = clampOffset(nextOffset, canvasW, canvasH, viewportSize, restingOffset);
      offsetRef.current = clamped;
      offsetX.set(clamped.x);
      offsetY.set(clamped.y);
      return clamped;
    },
    [canvasH, canvasW, offsetX, offsetY, restingOffset, viewportSize]
  );

  const scheduleOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      pendingOffsetRef.current = nextOffset;
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!pendingOffsetRef.current) return;
        applyOffset(pendingOffsetRef.current);
        pendingOffsetRef.current = null;
      });
    },
    [applyOffset]
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      scheduleOffset({
        x: offsetRef.current.x - event.deltaX * 0.52,
        y: offsetRef.current.y - event.deltaY * 0.52,
      });
    };

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleNativeWheel);
  }, [scheduleOffset]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("canvas-scroll-lock", canvasGestureActive);

    return () => root.classList.remove("canvas-scroll-lock");
  }, [canvasGestureActive]);

  useEffect(() => {
    applyOffset({ x: 0, y: 0 });
  }, [applyOffset]);

  useEffect(() => {
    if (!focusedTalentId) return;
    if (!visibleRecommendations.some((recommendation) => recommendation.id === focusedTalentId)) {
      setFocusedTalentId(null);
    }
  }, [focusedTalentId, visibleRecommendations]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".canvas-card") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }

      dragStateRef.current.isDragging = true;
      dragStateRef.current.didPan = false;
      dragStateRef.current.dragStart = { x: event.clientX, y: event.clientY };
      dragStateRef.current.startOffset = offsetRef.current;
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const dx = event.clientX - dragStateRef.current.dragStart.x;
      const dy = event.clientY - dragStateRef.current.dragStart.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragStateRef.current.didPan = true;
      }
      scheduleOffset({
        x: dragStateRef.current.startOffset.x + dx,
        y: dragStateRef.current.startOffset.y + dy,
      });
    },
    [scheduleOffset]
  );

  const handleMouseUp = useCallback(() => {
    dragStateRef.current.isDragging = false;
  }, []);

  const handlePointerEnterCanvas = useCallback(() => {
    setCanvasGestureActive(true);
  }, []);

  const handlePointerLeaveCanvas = useCallback(() => {
    setCanvasGestureActive(false);
    dragStateRef.current.isDragging = false;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;
      dragStateRef.current.isDragging = true;
      dragStateRef.current.didPan = false;
      dragStateRef.current.dragStart = { x: touch.clientX, y: touch.clientY };
      dragStateRef.current.startOffset = offsetRef.current;
    },
    []
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragStateRef.current.dragStart.x;
      const dy = touch.clientY - dragStateRef.current.dragStart.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragStateRef.current.didPan = true;
      }
      scheduleOffset({
        x: dragStateRef.current.startOffset.x + dx,
        y: dragStateRef.current.startOffset.y + dy,
      });
    },
    [scheduleOffset]
  );

  const handleTouchEnd = useCallback(() => {
    dragStateRef.current.isDragging = false;
  }, []);

  const focusedRecommendation =
    visibleRecommendations.find((recommendation) => recommendation.id === focusedTalentId) || null;

  if (!visibleRecommendations.length) {
    return (
      <section
        className={`rounded-[32px] border p-6 shadow-[0_16px_40px_rgba(17,17,17,0.06)] backdrop-blur-xl ${
          isDark ? "border-white/8 bg-[#101624]/88 text-white" : "border-black/8 bg-white/84 text-ink"
        }`}
      >
        <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/46" : "text-ink-light"}`}>Visual review</p>
        <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>No talent matches this filter set yet.</h2>
        <p className={`mt-3 max-w-[620px] text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
          Try widening the city, role, or tag filters and the canvas will repopulate with a broader creative roster.
        </p>
      </section>
    );
  }

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[34px] border shadow-[0_30px_80px_rgba(6,10,18,0.18)] lg:h-full ${
          isDark
            ? "border-white/8 bg-[linear-gradient(135deg,#0e1525,#111b31,#09111d)]"
            : "border-black/8 bg-[linear-gradient(135deg,#fbfaf7,#eef6ff,#f4f1ea)]"
        } ${fullBleedDesktop ? "lg:rounded-none lg:border-0 lg:shadow-none" : ""}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${
            isDark
              ? "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_48%)]"
              : "bg-[radial-gradient(circle_at_top,rgba(123,198,255,0.22),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.55),transparent_34%)]"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${
            isDark
              ? "bg-[linear-gradient(180deg,rgba(9,17,29,0.92),rgba(9,17,29,0))]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))]"
          }`}
        />

        {showCanvasHeader ? (
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex flex-col gap-3 lg:left-6 lg:right-6 lg:flex-row lg:items-start lg:justify-between">
            <div
              className={`pointer-events-auto max-w-[430px] rounded-[26px] border px-4 py-4 backdrop-blur-xl ${
                isDark ? "border-white/10 bg-white/[0.06] text-white" : "border-black/8 bg-white/84 text-ink"
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/40" : "text-ink-light"}`}>Visual review</p>
              <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>Pan the roster. Click into a portfolio.</h2>
              <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/64" : "text-ink-light"}`}>
                The old artist review flow is back: spatial canvas, controlled overlap, and a centered portfolio focus state.
              </p>
            </div>

            <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-start lg:justify-end">
              {activeProject ? (
                <div className={`rounded-pill border px-4 py-2 text-xs font-medium ${isDark ? "border-white/10 bg-white/[0.06] text-white/80" : "border-black/8 bg-white/84 text-ink"}`}>
                  {activeProject.title}
                </div>
              ) : null}
              <div className={`rounded-pill border px-4 py-2 text-xs font-medium ${isDark ? "border-white/10 bg-white/[0.06] text-white/80" : "border-black/8 bg-white/84 text-ink"}`}>
                {visibleRecommendations.length} in frame
              </div>
              <div className={`rounded-pill border px-4 py-2 text-xs font-medium ${isDark ? "border-white/10 bg-white/[0.06] text-white/80" : "border-black/8 bg-white/84 text-ink"}`}>
                {shortlistCount(shortlistTarget)} shortlisted
              </div>
            </div>
          </div>
        ) : null}

        <div
          ref={viewportRef}
          className={`canvas-gesture-trap relative cursor-grab overflow-hidden touch-none active:cursor-grabbing ${canvasHeightClass}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onPointerEnter={handlePointerEnterCanvas}
          onPointerLeave={handlePointerLeaveCanvas}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClickCapture={(event) => {
            if (!dragStateRef.current.didPan) return;
            event.preventDefault();
            event.stopPropagation();
            dragStateRef.current.didPan = false;
          }}
        >
          <motion.div
            className="absolute left-0 top-0 will-change-transform"
            style={{
              x: canvasTranslateX,
              y: canvasTranslateY,
              width: canvasW,
              height: canvasH,
            }}
          >
            {visibleRecommendations.map((recommendation, index) => {
              const position = positions[index];
              if (!position) return null;
              return (
                <TalentCanvasCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  position={position}
                  index={index}
                  offsetX={smoothOffsetX}
                  offsetY={smoothOffsetY}
                  reduceMotion={!!shouldReduceMotion}
                  tileBaseWidth={tileBaseWidth}
                  onOpen={() => setFocusedTalentId(recommendation.id)}
                  onQuickShortlist={() =>
                    onAddToShortlist(recommendation.id, recommendation.primaryRole)
                  }
                />
              );
            })}
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {focusedRecommendation ? (
          <TalentCanvasFocusOverlay
            recommendation={focusedRecommendation}
            recommendations={visibleRecommendations}
            activeProject={activeProject}
            shortlistTarget={shortlistTarget}
            focusLabel={focusLabel}
            dark={isDark}
            onClose={() => setFocusedTalentId(null)}
            onAddToShortlist={() =>
              onAddToShortlist(focusedRecommendation.id, focusedRecommendation.primaryRole)
            }
            onAskSagaToReachOut={() =>
              onAskSagaToReachOut(focusedRecommendation.id, focusedRecommendation.primaryRole)
            }
            onBranchFromSelection={onBranchFromSelection}
            onOpenCrewBoard={onOpenCrewBoard}
            onOpenProfile={() => onOpenProfile(focusedRecommendation.id)}
            onSwapFocus={(talentId) => setFocusedTalentId(talentId)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

const TalentCanvasCard = memo(function TalentCanvasCard({
  recommendation,
  position,
  index,
  offsetX,
  offsetY,
  reduceMotion,
  tileBaseWidth,
  onOpen,
  onQuickShortlist,
}: {
  recommendation: TalentRecommendation;
  position: { x: number; y: number; scale: number; rotate: number; depth: number };
  index: number;
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  reduceMotion: boolean;
  tileBaseWidth: number;
  onOpen: () => void;
  onQuickShortlist: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const width = tileBaseWidth * position.scale;
  const height = width * TALENT_TILE_ASPECT_RATIO;
  const depthMultiplier = reduceMotion ? 0.18 : 0.16 + position.depth * 1.08;
  const parallaxStrength = reduceMotion ? 0.06 : 0.18;
  const parallaxX = useTransform(offsetX, (latest) => -latest * depthMultiplier * parallaxStrength);
  const parallaxY = useTransform(offsetY, (latest) => -latest * depthMultiplier * parallaxStrength);
  const depthLift = Math.max(0, position.depth - 0.3) * 18;
  const zIndex = Math.round(position.scale * 120 + position.depth * 160);
  const overallFit = fitScore(recommendation);
  const roleAccent = getRoleAccent(recommendation.primaryRole);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.36 : 0.72,
        delay: Math.min(index * 0.015, 1.5),
        ease: [0.23, 1, 0.32, 1],
      }}
      style={{ left: position.x, top: position.y, width, height, zIndex }}
      className="canvas-card group absolute text-left"
    >
      <motion.div
        style={{ x: parallaxX, y: parallaxY }}
        animate={{ rotate: position.rotate }}
        transition={{ type: "spring", stiffness: 86, damping: 24, mass: 1.05 }}
        whileHover={reduceMotion ? undefined : { y: -6, rotate: position.rotate + (position.scale > 1.05 ? -0.4 : 0.4) }}
        className="relative h-full w-full"
      >
        <motion.div
          initial={false}
          whileHover={{ opacity: 0.54, scale: 1.1 }}
          className="pointer-events-none absolute -inset-4 rounded-[38%_62%_56%_44%/58%_42%_58%_42%] opacity-0"
          style={{ filter: "blur(16px)", backgroundColor: roleAccent.glow }}
        />

        <div
          className="relative h-full w-full overflow-hidden rounded-[28px] border bg-white/60 backdrop-blur-xl"
          style={{
            boxShadow: `0 ${18 + position.depth * 14}px ${42 + position.depth * 18}px rgba(5,8,16,${0.08 + position.depth * 0.05})`,
            transform: `translateY(${-depthLift}px)`,
            borderColor: roleAccent.border,
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-1 h-1.5"
            style={{ background: `linear-gradient(90deg, ${roleAccent.edge}, transparent 82%)` }}
          />
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0 z-10"
            aria-label={`Open ${recommendation.name} profile card`}
          />
          {!imgError ? (
            <Image
              src={recommendation.portfolioImages[0]}
              alt={recommendation.name}
              fill
              sizes="(max-width: 640px) 38vw, (max-width: 1024px) 240px, 280px"
              className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : null}

          {(!loaded || imgError) && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#d7d2cb,#f6f3ee)]" />
          )}

          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${roleAccent.wash} 0%, rgba(15,15,15,0.02) 42%, rgba(7,9,15,0.8) 100%)`,
            }}
          />

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-pill bg-white/86 px-2.5 py-1 text-[10px] font-medium text-ink shadow-sm">
              {overallFit}
            </span>
            <span
              className="rounded-pill px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ backgroundColor: roleAccent.pillBg, color: roleAccent.pillText }}
            >
              {recommendation.primaryRole}
            </span>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQuickShortlist();
            }}
            className="absolute right-3 top-3 z-20 rounded-full bg-white/88 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
            style={{ border: `1px solid ${roleAccent.border}` }}
          >
            + shortlist
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-base font-medium tracking-tight text-white">{recommendation.name}</p>
            <p className="mt-1 line-clamp-2 text-xs font-light leading-5 text-white/76">
              {recommendation.whySagaMatched[0] || recommendation.bio}
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-white/72">
              <span>{recommendation.city}</span>
              <span className="max-w-[48%] truncate text-right">{recommendation.credits[0]}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
});

function TalentCanvasFocusOverlay({
  recommendation,
  recommendations,
  activeProject,
  shortlistTarget,
  focusLabel,
  dark,
  onClose,
  onAddToShortlist,
  onAskSagaToReachOut,
  onBranchFromSelection,
  onOpenCrewBoard,
  onOpenProfile,
  onSwapFocus,
}: {
  recommendation: TalentRecommendation;
  recommendations: TalentRecommendation[];
  activeProject: CreativeProject | null;
  shortlistTarget: CreativeProject | null;
  focusLabel?: string;
  dark: boolean;
  onClose: () => void;
  onAddToShortlist: () => void;
  onAskSagaToReachOut: () => void;
  onBranchFromSelection?: (talentIds: string[]) => void;
  onOpenCrewBoard?: () => void;
  onOpenProfile: () => void;
  onSwapFocus: (talentId: string) => void;
}) {
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<string[]>([]);

  const similarRecommendations = useMemo(() => {
    return recommendations
      .filter((entry) => entry.id !== recommendation.id)
      .map((entry) => {
        const sharedTags = entry.tags.filter((tag) => recommendation.tags.includes(tag)).length;
        const sharedRole = entry.primaryRole === recommendation.primaryRole ? 22 : 0;
        const sharedCity = entry.city === recommendation.city ? 8 : 0;
        return {
          entry,
          score: sharedTags * 12 + sharedRole + sharedCity + fitScore(entry) * 0.15,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ entry }) => entry);
  }, [recommendation, recommendations]);

  useEffect(() => {
    setSelectedSimilarIds([]);
  }, [recommendation.id]);

  const skillFit = Math.max(16, Math.round(recommendation.portfolioFitScore * 0.34));
  const brandRelevance = Math.max(
    12,
    Math.round((recommendation.categoryExperienceScore * 0.12 + recommendation.priorProjectRelevance * 0.1))
  );
  const styleMatch = Math.max(14, Math.round(recommendation.styleFitScore * 0.24));
  const headerLabel =
    focusLabel ||
    `${activeProject?.title || recommendation.primaryRole} · ${recommendations.length} matches`;

  const selectedSimilar = similarRecommendations.filter((entry) => selectedSimilarIds.includes(entry.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50"
    >
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={`absolute inset-0 backdrop-blur-md ${dark ? "bg-canvas/84" : "bg-[#f4f1eb]/82"}`}
      />

      <div className={`absolute left-4 right-16 top-4 z-20 mx-auto w-fit max-w-[calc(100vw-5rem)] rounded-pill border px-4 py-2 text-xs font-medium tracking-tight shadow-[0_12px_30px_rgba(6,10,18,0.14)] backdrop-blur-xl sm:left-1/2 sm:right-auto sm:top-6 sm:max-w-none sm:-translate-x-1/2 ${
        dark
          ? "border-white/10 bg-white/[0.08] text-white/82"
          : "border-black/8 bg-white/86 text-ink"
      }`}>
        {headerLabel}
      </div>

      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 pb-24 pt-20 sm:px-6 sm:pb-28 sm:pt-24 lg:items-center lg:overflow-hidden lg:px-6 lg:py-5">
        <div className="flex w-full max-w-[1360px] flex-col gap-4 lg:grid lg:h-[min(700px,calc(100vh-6.5rem))] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-x-5 lg:gap-y-4 lg:overflow-hidden xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)_minmax(220px,250px)]">
          <div className="order-2 flex w-full flex-col gap-4 md:flex-row md:items-start lg:order-1 lg:col-start-1 lg:row-start-1 lg:grid lg:min-h-0 lg:w-full lg:grid-cols-[112px_minmax(0,1fr)] lg:items-start lg:gap-4 xl:pr-2">
            <div className="flex flex-row gap-3 md:flex-col lg:sticky lg:top-0">
              <button
                onClick={onAddToShortlist}
                className={`rounded-[24px] px-4 py-4 text-sm font-medium shadow-[0_18px_42px_rgba(124,199,255,0.2)] transition-transform hover:-translate-y-0.5 md:min-w-[140px] lg:min-w-[112px] ${
                  dark ? "bg-[#7cc7ff] text-white" : "bg-[#7bc6ff] text-[#08111f]"
                }`}
              >
                Lock as {recommendation.primaryRole}
              </button>
              <button
                onClick={onOpenProfile}
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_16px_34px_rgba(6,10,18,0.14)] ${
                  dark ? "bg-[#141d31] text-white/88" : "bg-white text-[#0f1728]"
                }`}
                aria-label="Open full profile"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="3" y="3" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="9" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="13.2" cy="4.8" r="0.8" fill="currentColor" />
                </svg>
              </button>
              <button
                onClick={onAskSagaToReachOut}
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_16px_34px_rgba(6,10,18,0.14)] ${
                  dark ? "bg-[#141d31] text-white/88" : "bg-white text-[#0f1728]"
                }`}
                aria-label="Ask Saga to reach out"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 9.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6ZM4.4 14.6c.8-2.2 2.5-3.3 4.6-3.3 2.1 0 3.8 1.1 4.6 3.3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="14.2" cy="13.8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M13.2 13.8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <section className={`w-full max-w-[420px] rounded-[30px] border p-5 shadow-[0_28px_80px_rgba(6,10,18,0.18)] sm:p-5 lg:min-h-0 lg:max-w-none lg:overflow-y-auto ${
              dark ? "border-white/10 bg-[#11192b]/95 text-white" : "border-black/8 bg-white/92 text-ink"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.26em] ${dark ? "text-white/42" : "text-ink-light"}`}>Creator profile</p>
                  <h2 className="mt-3 text-[2rem] font-semibold leading-[1.02] tracking-tight">{recommendation.name}</h2>
                  <p className={`mt-2 text-sm ${dark ? "text-white/62" : "text-ink-light"}`}>
                    {recommendation.primaryRole} · {recommendation.city}
                  </p>
                </div>
                <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full shadow-[0_16px_34px_rgba(124,199,255,0.16)] ${
                  dark ? "bg-[#7cc7ff]/30 text-[#d6eeff]" : "bg-[#7bc6ff]/24 text-[#163b68]"
                }`}>
                  <span className="text-[1.65rem] font-semibold leading-none">{fitScore(recommendation)}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.16em]">Match</span>
                </div>
              </div>

              <div className={`mt-5 rounded-[24px] p-4 ${dark ? "bg-[#0d1526]" : "bg-[#edf5ff]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/44" : "text-ink-light"}`}>Best slot</span>
                  <span className={`rounded-pill px-3 py-1 text-xs font-medium ${
                    dark ? "bg-white/[0.08] text-white/84" : "bg-white text-ink shadow-sm"
                  }`}>
                    {recommendation.primaryRole}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <OverlayMetric label="Skill fit" value={skillFit} max={36} dark={dark} />
                  <OverlayMetric label="Brand relevance" value={brandRelevance} max={20} dark={dark} />
                  <OverlayMetric label="Style match" value={styleMatch} max={24} dark={dark} />
                </div>
              </div>

              <div className="mt-5">
                <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/42" : "text-ink-light"}`}>Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendation.tags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-pill px-3 py-1.5 text-[11px] font-medium ${
                        dark ? "bg-[#0d1526] text-white/78" : "bg-[#edf5ff] text-[#173250]"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/42" : "text-ink-light"}`}>Clients</p>
                  <p className={`mt-2 text-sm leading-6 lg:line-clamp-3 ${dark ? "text-white/82" : "text-ink"}`}>
                    {recommendation.credits.slice(0, 5).join(" · ")}
                  </p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/42" : "text-ink-light"}`}>Style note</p>
                  <p className={`mt-2 text-sm leading-6 lg:line-clamp-5 ${dark ? "text-white/68" : "text-ink-light"}`}>{recommendation.bio}</p>
                </div>
              </div>
            </section>
          </div>

          <motion.div
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.86, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="order-1 flex w-full flex-col items-center lg:order-2 lg:col-start-2 lg:row-start-1 lg:min-w-0 lg:w-full lg:min-h-0 lg:justify-center"
          >
            <div className={`w-full max-w-[520px] overflow-hidden rounded-[34px] border shadow-[0_30px_80px_rgba(6,10,18,0.14)] lg:max-w-[min(100%,520px)] ${
              dark ? "border-white/12 bg-white/6" : "border-black/8 bg-white/72"
            }`}>
              <div className="relative h-[300px] sm:h-[360px] lg:h-[360px]">
                <Image
                  src={recommendation.portfolioImages[0]}
                  alt={recommendation.name}
                  fill
                  sizes="(max-width: 768px) 90vw, 520px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="mt-3 grid w-full max-w-[520px] grid-cols-2 gap-3">
              {recommendation.portfolioImages.slice(1, 5).map((image, index) => (
                <div
                  key={image}
                  className={`relative overflow-hidden rounded-[24px] border shadow-[0_12px_30px_rgba(6,10,18,0.08)] ${
                    dark ? "border-white/10 bg-white/6" : "border-black/8 bg-white/70"
                  }`}
                >
                  <div className="relative h-[94px] sm:h-[112px] lg:h-[108px]">
                    <Image
                      src={image}
                      alt={`${recommendation.name} detail ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 42vw, 264px"
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="order-3 w-full lg:col-span-2 lg:row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:w-full">
            <div className="space-y-3 xl:h-full xl:overflow-hidden">
              <p className={`px-1 text-[10px] uppercase tracking-[0.24em] ${dark ? "text-white/42" : "text-ink-light"}`}>Similar creators</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:h-[calc(100%-1.4rem)] xl:grid-cols-1 xl:overflow-y-auto">
                {similarRecommendations.map((entry) => {
                  const isSelected = selectedSimilarIds.includes(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`flex w-full items-center gap-3 rounded-[26px] border px-3 py-3 text-left shadow-[0_18px_40px_rgba(6,10,18,0.12)] transition-transform hover:-translate-y-0.5 ${
                        dark
                          ? `${isSelected ? "border-[#7cc7ff]/70" : "border-white/10"} bg-white/[0.03] text-white`
                          : `${isSelected ? "border-[#7bc6ff]/60" : "border-black/8"} bg-white/90 text-ink`
                      }`}
                    >
                      <button
                        onClick={() => onSwapFocus(entry.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="relative h-16 w-16 overflow-hidden rounded-full">
                          <Image src={entry.portfolioImages[0]} alt={entry.name} fill sizes="64px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium tracking-tight ${dark ? "text-white" : "text-ink"}`}>{entry.name}</p>
                          <p className={`mt-1 text-[11px] uppercase tracking-[0.18em] ${dark ? "text-white/38" : "text-ink-light"}`}>
                            {entry.primaryRole}
                          </p>
                          <p className={`mt-2 text-xs ${dark ? "text-white/72" : "text-ink"}`}>{fitScore(entry)} match</p>
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          setSelectedSimilarIds((current) =>
                            current.includes(entry.id)
                              ? current.filter((id) => id !== entry.id)
                              : current.length >= 5
                                ? current
                                : [...current, entry.id]
                          )
                        }
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-[#7cc7ff]/70 bg-[#7cc7ff] text-[#08111f]"
                            : dark
                              ? "border-white/12 bg-white/[0.04] text-white/72"
                              : "border-black/10 bg-[#edf5ff] text-[#173250]"
                        }`}
                        aria-label={isSelected ? "Remove from go deeper selection" : "Select for go deeper"}
                      >
                        {isSelected ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.2 6.2 4.7 8.6 9.8 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 lg:static lg:bottom-auto lg:left-auto lg:col-span-3 lg:row-start-2 lg:w-full lg:max-w-none lg:translate-x-0 lg:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={`flex items-center justify-between gap-3 rounded-[30px] border px-4 py-3 shadow-[0_22px_60px_rgba(6,10,18,0.16)] backdrop-blur-xl ${
            dark ? "border-white/10 bg-[#131a2b]/95 text-white" : "border-black/8 bg-white/92 text-ink"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${dark ? "text-white/54" : "text-ink-light"}`}>
              {selectedSimilar.length
                ? `${selectedSimilar.length} creator${selectedSimilar.length === 1 ? "" : "s"} selected to spiral deeper.`
                : "Select up to five creators to spiral deeper."}
            </p>
            {shortlistTarget ? (
              <p className={`mt-1 truncate text-xs ${dark ? "text-white/34" : "text-ink-light"}`}>Shortlisting into {shortlistTarget.title}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBranchFromSelection?.(selectedSimilarIds)}
              disabled={!selectedSimilarIds.length || !onBranchFromSelection}
              className={`rounded-pill px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed ${
                dark
                  ? "bg-white text-ink disabled:bg-white/16 disabled:text-white/34"
                  : "bg-[#7bc6ff] text-[#08111f] disabled:bg-[#e5edf8] disabled:text-[#8da0b7]"
              }`}
            >
              Go Deeper
            </button>
            <button
              onClick={onOpenCrewBoard || onOpenProfile}
              className={`rounded-pill border px-5 py-2.5 text-sm font-medium ${
                dark ? "border-white/10 bg-white/[0.04] text-white" : "border-black/8 bg-white text-ink"
              }`}
            >
              {activeProject ? "Crew Board" : "Open Profile"}
            </button>
          </div>
        </motion.div>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        onClick={onClose}
        className={`fixed right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full shadow-[0_12px_30px_rgba(6,10,18,0.14)] backdrop-blur-xl sm:right-8 sm:top-6 ${
          dark ? "bg-white/[0.06] text-white/88" : "bg-white/88 text-[#0f1728]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.button>
    </motion.div>
  );
}

function OverlayMetric({
  label,
  value,
  max,
  dark,
}: {
  label: string;
  value: number;
  max: number;
  dark: boolean;
}) {
  const width = `${Math.max(16, (value / max) * 100)}%`;

  return (
    <div>
      <div className={`mb-1.5 flex items-center justify-between text-xs ${dark ? "text-white/56" : "text-ink-light"}`}>
        <span>{label}</span>
        <span className={`font-medium ${dark ? "text-white" : "text-ink"}`}>{Math.round(value)}</span>
      </div>
      <div className={`h-2 rounded-full ${dark ? "bg-white/[0.06]" : "bg-[#d9e9fb]"}`}>
        <div className="h-full rounded-full bg-[#7cc7ff]" style={{ width }} />
      </div>
    </div>
  );
}
