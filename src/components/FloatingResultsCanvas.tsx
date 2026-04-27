"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CREATORS,
  CreatorMatch,
  matchCreatorToQuery,
} from "@/data/talentData";
import {
  generateTalentPositions,
  TALENT_TILE_ASPECT_RATIO,
  TALENT_TILE_BASE_WIDTH,
} from "@/lib/seededRandom";
import { useAppStore } from "@/store/useAppStore";
import { ImageTile } from "./ImageTile";

function clampOffset(
  nextOffset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  viewportSize: { w: number; h: number },
  initialOffset: { x: number; y: number }
) {
  const horizontalPadding = 140;
  const verticalPadding = 120;
  const minX = viewportSize.w - canvasW - horizontalPadding - initialOffset.x;
  const maxX = horizontalPadding - initialOffset.x;
  const minY = viewportSize.h - canvasH - verticalPadding - initialOffset.y;
  const maxY = verticalPadding - initialOffset.y;

  return {
    x: Math.max(minX, Math.min(maxX, nextOffset.x)),
    y: Math.max(minY, Math.min(maxY, nextOffset.y)),
  };
}

export function FloatingResultsCanvas() {
  const analysis = useAppStore((state) => state.analysis);
  const query = useAppStore((state) => state.query);
  const canvasCreators = useAppStore((state) => state.canvasCreators);
  const activeRoleFilter = useAppStore((state) => state.activeRoleFilter);
  const depthLevel = useAppStore((state) => state.depthLevel);
  const teamSlots = useAppStore((state) => state.teamSlots);
  const shortlistIds = useAppStore((state) => state.shortlistIds);
  const updateLiveBrief = useAppStore((state) => state.updateLiveBrief);
  const setLiveBriefRoles = useAppStore((state) => state.setLiveBriefRoles);
  const addCreatorToShortlist = useAppStore((state) => state.addCreatorToShortlist);
  const removeCreatorFromShortlist = useAppStore((state) => state.removeCreatorFromShortlist);
  const roleOrder = useMemo(
    () => new Map((analysis?.roles || []).map((role, index) => [role, index])),
    [analysis?.roles]
  );
  const teamCount = Object.keys(teamSlots).length;
  const [viewportSize, setViewportSize] = useState({ w: 1440, h: 960 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [didPan, setDidPan] = useState(false);
  const [isShortlistOver, setIsShortlistOver] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"brief" | "shortlist" | null>(null);

  useEffect(() => {
    setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    const handleResize = () =>
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const visibleCreators = useMemo(() => {
    if (!activeRoleFilter) {
      return [...canvasCreators].sort((a, b) => {
        const aIndex = roleOrder.get(a.bestRole) ?? 99;
        const bIndex = roleOrder.get(b.bestRole) ?? 99;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return b.overallScore - a.overallScore;
      });
    }

    return canvasCreators
      .map((creator) => ({
        creator,
        roleScore:
          creator.roleMatches[activeRoleFilter]?.score ||
          (creator.bestRole === activeRoleFilter ? creator.overallScore : 0),
      }))
      .filter(
        ({ creator, roleScore }) =>
          creator.bestRole === activeRoleFilter ||
          creator.primaryRole === activeRoleFilter ||
          roleScore >= 42
      )
      .sort((a, b) => b.roleScore - a.roleScore || b.creator.overallScore - a.creator.overallScore)
      .map(({ creator }) => creator);
  }, [activeRoleFilter, canvasCreators, roleOrder]);

  const canvasW = Math.max(viewportSize.w * 2.65, 3400);
  const canvasH = Math.max(viewportSize.h * 2.85, 2800);
  const isMobileViewport = viewportSize.w < 1024;

  const positions = useMemo(() => {
    const seed = depthLevel * 1000 + (query.charCodeAt(0) || 0) * 100;
    return generateTalentPositions(
      visibleCreators,
      seed,
      viewportSize.w,
      viewportSize.h,
      activeRoleFilter ? [activeRoleFilter] : analysis?.roles || []
    );
  }, [activeRoleFilter, analysis?.roles, depthLevel, query, viewportSize, visibleCreators]);

  const restingOffset = useMemo(() => {
    if (!positions.length) {
      return {
        x: -(canvasW - viewportSize.w) / 2,
        y: -(canvasH - viewportSize.h) / 2.05,
      };
    }

    const bounds = positions.reduce(
      (acc, position) => {
        const width = TALENT_TILE_BASE_WIDTH * position.scale;
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
    const visibleCenterX = viewportSize.w / 2 + (isMobileViewport ? 0 : 140);
    const visibleCenterY = viewportSize.h / 2 + (isMobileViewport ? 20 : 12);

    return {
      x: visibleCenterX - collageCenterX,
      y: visibleCenterY - collageCenterY,
    };
  }, [canvasH, canvasW, isMobileViewport, positions, viewportSize]);

  useEffect(() => {
    setOffset(clampOffset({ x: 0, y: 0 }, canvasW, canvasH, viewportSize, restingOffset));
  }, [activeRoleFilter, canvasH, canvasW, depthLevel, query, restingOffset, viewportSize]);

  const shortlistCreators = useMemo(() => {
    if (!analysis) return [];

    return [...shortlistIds]
      .map((id) => {
        const currentMatch = canvasCreators.find((creator) => creator.id === id);
        if (currentMatch) return currentMatch;
        const baseCreator = CREATORS.find((creator) => creator.id === id);
        return baseCreator ? matchCreatorToQuery(baseCreator, query, analysis.roles) : null;
      })
      .filter(Boolean) as CreatorMatch[];
  }, [analysis, canvasCreators, query, shortlistIds]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".image-tile-click") ||
        target.closest(".floating-panel") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }

      setIsDragging(true);
      setDidPan(false);
      setDragStart({ x: event.clientX, y: event.clientY });
      setStartOffset(offset);
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        setDidPan(true);
      }
      setOffset(
        clampOffset(
          { x: startOffset.x + dx, y: startOffset.y + dy },
          canvasW,
          canvasH,
          viewportSize,
          restingOffset
        )
      );
    },
    [canvasH, canvasW, dragStart, isDragging, restingOffset, startOffset, viewportSize]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".image-tile-click") ||
        target.closest(".floating-panel") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;
      setIsDragging(true);
      setDidPan(false);
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setStartOffset(offset);
    },
    [offset]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        setDidPan(true);
      }
      setOffset(
        clampOffset(
          { x: startOffset.x + dx, y: startOffset.y + dy },
          canvasW,
          canvasH,
          viewportSize,
          restingOffset
        )
      );
    },
    [canvasH, canvasW, dragStart, isDragging, restingOffset, startOffset, viewportSize]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      setOffset((current) =>
        clampOffset(
          {
            x: current.x - event.deltaX * 0.58,
            y: current.y - event.deltaY * 0.58,
          },
          canvasW,
          canvasH,
          viewportSize,
          restingOffset
        )
      );
    },
    [canvasH, canvasW, restingOffset, viewportSize]
  );

  const handleShortlistDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const creatorId = event.dataTransfer.getData("text/plain");
    if (creatorId) {
      addCreatorToShortlist(creatorId);
    }
    setIsShortlistOver(false);
  };

  return (
    <div
      className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={(event) => {
        if (!didPan) return;
        event.preventDefault();
        event.stopPropagation();
        setDidPan(false);
      }}
    >
      {analysis && (
        <div className="pointer-events-none absolute left-8 top-28 z-30 hidden lg:block">
          <div className="pointer-events-auto floating-panel flex w-[300px] flex-col items-start gap-4">
            <div className="w-[260px] rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
                    Live brief
                  </p>
                  <h3 className="mt-2 text-xl font-medium tracking-tight text-ink">
                    {query}
                  </h3>
                </div>
                <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
                  {teamCount} locked
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-ink-light">
                <EditableField
                  label="Location"
                  value={analysis.location}
                  onChange={(value) => updateLiveBrief({ location: value })}
                />
                <EditableField
                  label="Budget"
                  value={analysis.budget}
                  onChange={(value) => updateLiveBrief({ budget: value })}
                />
                <EditableField
                  label="Timeline"
                  value={analysis.timeline}
                  onChange={(value) => updateLiveBrief({ timeline: value })}
                />
                <EditableField
                  label="Roles"
                  value={summarizeRoles(analysis.roles)}
                  editValue={analysis.roles.join(", ")}
                  onChange={setLiveBriefRoles}
                />
                {activeRoleFilter && (
                  <div className="flex items-center justify-between">
                    <span>Filter</span>
                    <span className="font-medium text-ink">{activeRoleFilter}</span>
                  </div>
                )}
              </div>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsShortlistOver(true);
              }}
              onDragLeave={() => setIsShortlistOver(false)}
              onDrop={handleShortlistDrop}
              className={`w-full rounded-[30px] border p-5 shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl transition-colors ${
                isShortlistOver
                  ? "border-accent bg-white/86"
                  : "border-white/60 bg-white/74"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
                    Short list
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-light">
                    Drag profiles in here to prep the crew board.
                  </p>
                </div>
                <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
                  {shortlistCreators.length}/8
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {shortlistCreators.length ? (
                  shortlistCreators.map((creator) => (
                    <div
                      key={creator.id}
                      className="flex items-center justify-between gap-3 rounded-[22px] bg-canvas/88 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium tracking-tight text-ink">
                          {creator.name}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-light">
                          {creator.bestRole} · {creator.overallScore} match
                        </p>
                      </div>
                      <button
                        onClick={() => removeCreatorFromShortlist(creator.id)}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/70 bg-canvas/86 px-4 py-6 text-center text-sm text-ink-light">
                    Drop creator cards here to keep a running short list while you branch out.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis && isMobileViewport && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.7rem+env(safe-area-inset-bottom))] z-30 px-4 lg:hidden">
          <motion.div layout className="pointer-events-auto">
            <AnimatePresence initial={false}>
              {mobilePanel === "brief" && (
                <motion.div
                  key="mobile-brief"
                  initial={{ opacity: 0, y: 14, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  className="mb-3 overflow-hidden rounded-[24px] border border-white/60 bg-white/78 p-4 shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
                        Live brief
                      </p>
                      <h3 className="mt-2 truncate text-base font-medium tracking-tight text-ink">
                        {query}
                      </h3>
                    </div>
                    <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
                      {teamCount} locked
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-ink-light">
                    <EditableField
                      label="Location"
                      value={analysis.location}
                      onChange={(value) => updateLiveBrief({ location: value })}
                    />
                    <EditableField
                      label="Budget"
                      value={analysis.budget}
                      onChange={(value) => updateLiveBrief({ budget: value })}
                    />
                    <EditableField
                      label="Timeline"
                      value={analysis.timeline}
                      onChange={(value) => updateLiveBrief({ timeline: value })}
                    />
                    <EditableField
                      label="Roles"
                      value={summarizeRoles(analysis.roles)}
                      editValue={analysis.roles.join(", ")}
                      onChange={setLiveBriefRoles}
                    />
                    {activeRoleFilter ? (
                      <div className="flex items-center justify-between">
                        <span>Filter</span>
                        <span className="font-medium text-ink">{activeRoleFilter}</span>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}

              {mobilePanel === "shortlist" && (
                <motion.div
                  key="mobile-shortlist"
                  initial={{ opacity: 0, y: 14, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsShortlistOver(true);
                  }}
                  onDragLeave={() => setIsShortlistOver(false)}
                  onDrop={handleShortlistDrop}
                  className={`mb-3 overflow-hidden rounded-[24px] border p-4 shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl transition-colors ${
                    isShortlistOver
                      ? "border-accent bg-white/86"
                      : "border-white/60 bg-white/78"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
                        Short list
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink-light">
                        Double tap a tile or drag here to prep the crew board.
                      </p>
                    </div>
                    <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
                      {shortlistCreators.length}/8
                    </span>
                  </div>

                  <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {shortlistCreators.length ? (
                      shortlistCreators.map((creator) => (
                        <div
                          key={creator.id}
                          className="flex items-center justify-between gap-3 rounded-[18px] bg-canvas/88 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium tracking-tight text-ink">
                              {creator.name}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-light">
                              {creator.bestRole} · {creator.overallScore} match
                            </p>
                          </div>
                          <button
                            onClick={() => removeCreatorFromShortlist(creator.id)}
                            className="rounded-pill bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-white/70 bg-canvas/86 px-4 py-5 text-center text-sm text-ink-light">
                        Keep a short list here while you branch into new taste pockets.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-2">
              <MobileCanvasToggle
                label="Live Brief"
                meta={`${teamCount} locked`}
                active={mobilePanel === "brief"}
                onClick={() =>
                  setMobilePanel((current) => (current === "brief" ? null : "brief"))
                }
              />
              <MobileCanvasToggle
                label="Shortlist"
                meta={`${shortlistCreators.length}/8`}
                active={mobilePanel === "shortlist"}
                onClick={() =>
                  setMobilePanel((current) => (current === "shortlist" ? null : "shortlist"))
                }
              />
            </div>
          </motion.div>
        </div>
      )}

      {depthLevel > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed left-1/2 top-[7.35rem] z-20 w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 px-4 sm:top-28 sm:max-w-none sm:px-0"
        >
          <span className="mx-auto block w-fit rounded-pill bg-white/80 px-4 py-2 text-xs font-medium tracking-tight text-ink shadow-sm backdrop-blur-xl">
            {query} · depth {depthLevel}
          </span>
        </motion.div>
      )}

      <motion.div
        animate={{
          x: restingOffset.x + offset.x,
          y: restingOffset.y + offset.y,
        }}
        transition={
          isDragging
            ? { duration: 0 }
            : { type: "spring", stiffness: 82, damping: 28, mass: 1.08 }
        }
        style={{ width: canvasW, height: canvasH }}
        className="relative"
      >
        {visibleCreators.map((creator, index) => {
          const position = positions[index];
          if (!position) return null;

          return (
            <ImageTile
              key={`${creator.id}-${depthLevel}-${activeRoleFilter || "all"}`}
              creator={creator}
              scale={position.scale}
              index={index}
              rotate={position.rotate}
              parallaxDepth={position.depth}
              viewportOffset={offset}
              style={{ left: position.x, top: position.y }}
            />
          );
        })}
      </motion.div>

      {visibleCreators.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-[28px] bg-white/80 px-6 py-5 text-center shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl">
            <p className="text-sm font-medium text-ink">No talent in this pocket yet.</p>
            <p className="mt-2 text-xs text-ink-light">
              Clear the role filter or branch off from a different cue set.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  editValue,
  onChange,
}: {
  label: string;
  value: string;
  editValue?: string;
  onChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(editValue || value);

  useEffect(() => {
    setDraft(editValue || value);
  }, [editValue, value]);

  const commit = () => {
    const nextValue = draft.trim();
    if (nextValue) {
      onChange(nextValue);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      {isEditing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }
            if (event.key === "Escape") {
              setDraft(editValue || value);
              setIsEditing(false);
            }
          }}
          className="w-[132px] rounded-pill border border-white/70 bg-canvas/86 px-3 py-1.5 text-right text-xs font-medium text-ink outline-none transition-colors focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="max-w-[140px] truncate text-right font-medium text-ink transition-colors hover:text-ink-light"
          title={editValue || value}
        >
          {value}
        </button>
      )}
    </div>
  );
}

function summarizeRoles(roles: string[]) {
  if (roles.length <= 2) return roles.join(", ");
  return `${roles.slice(0, 2).join(", ")} +${roles.length - 2}`;
}

function MobileCanvasToggle({
  label,
  meta,
  active,
  onClick,
}: {
  label: string;
  meta: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center justify-between rounded-pill border px-4 py-3 text-left shadow-[0_14px_34px_rgba(17,17,17,0.06)] backdrop-blur-xl transition-colors ${
        active
          ? "border-accent bg-white/92 text-ink"
          : "border-white/60 bg-white/78 text-ink"
      }`}
    >
      <span className="text-sm font-medium tracking-tight">{label}</span>
      <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-light">
        {meta}
      </span>
    </motion.button>
  );
}
