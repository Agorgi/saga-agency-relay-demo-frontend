type PositionableTalent = {
  bestRole?: string;
  primaryRole: string;
  overallScore?: number;
  portfolioFitScore?: number;
  styleFitScore?: number;
  distributionScore?: number;
};

export const TALENT_TILE_BASE_WIDTH = 70;
export const TALENT_TILE_ASPECT_RATIO = 1.2;

export function getTalentTileBaseWidth(viewportWidth: number) {
  return viewportWidth < 800 ? TALENT_TILE_BASE_WIDTH * 0.5 : TALENT_TILE_BASE_WIDTH;
}

type GenerateTalentPositionOptions = {
  canvasWidth?: number;
  canvasHeight?: number;
  spacingScale?: number;
};

export function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807 + 0) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

type RoleAnchor = {
  x: number;
  y: number;
  angle: number;
};

function scaleForScore(score: number, rand: () => number) {
  const normalized = score / 99;
  if (normalized > 0.88) return 1.18 + rand() * 0.15;
  if (normalized > 0.75) return 1.02 + rand() * 0.14;
  if (normalized > 0.58) return 0.84 + rand() * 0.12;
  if (normalized > 0.42) return 0.69 + rand() * 0.1;
  return 0.56 + rand() * 0.08;
}

function getVisualScore(talent: PositionableTalent) {
  if (typeof talent.overallScore === "number") return talent.overallScore;

  return clamp(
    Math.round(
      (talent.portfolioFitScore || 66) * 0.52 +
        (talent.styleFitScore || 64) * 0.24 +
        (talent.distributionScore || 62) * 0.24
    ),
    42,
    98
  );
}

function buildRoleAnchorMap(roles: string[], viewportWidth: number) {
  const anchorMap = new Map<string, RoleAnchor>();
  const isMobile = viewportWidth < 800;
  const center = {
    x: isMobile ? 0.52 : 0.54,
    y: isMobile ? 0.5 : 0.51,
  };
  const radiusX = isMobile
    ? clamp(0.1 + roles.length * 0.01, 0.13, 0.18)
    : clamp(0.12 + roles.length * 0.012, 0.16, 0.24);
  const radiusY = isMobile
    ? clamp(0.1 + roles.length * 0.008, 0.13, 0.19)
    : clamp(0.11 + roles.length * 0.01, 0.15, 0.22);

  roles.forEach((role, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(roles.length, 1)) * Math.PI * 2;
    anchorMap.set(role, {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
      angle,
    });
  });

  return anchorMap;
}

export function generateTalentPositions(
  creators: PositionableTalent[],
  seed: number,
  viewportWidth: number,
  viewportHeight: number,
  activeRoles: string[],
  options: GenerateTalentPositionOptions = {}
) {
  const rand = seededRandom(seed);
  const spacingScale = options.spacingScale ?? 1;
  const tileBaseWidth = getTalentTileBaseWidth(viewportWidth);
  const canvasW = options.canvasWidth || Math.max(viewportWidth * 2.65, 3400);
  const canvasH = options.canvasHeight || Math.max(viewportHeight * 2.85, 2800);
  const roles = unique(
    (activeRoles.length
      ? activeRoles
      : creators.map((creator) => creator.bestRole || creator.primaryRole)
    ).filter((role): role is string => Boolean(role))
  ).sort((a, b) => a.localeCompare(b));
  const anchorMap = new Map<string, RoleAnchor>();
  const isFocusedRole = roles.length === 1;

  if (isFocusedRole) {
    anchorMap.set(roles[0], { x: 0.54, y: 0.5, angle: -Math.PI / 2 });
  } else {
    buildRoleAnchorMap(roles, viewportWidth).forEach((anchor, role) => {
      anchorMap.set(role, anchor);
    });
  }

  const positions: Array<{
    x: number;
    y: number;
    scale: number;
    rotate: number;
    depth: number;
  }> = [];
  const rolePlacementCounts = new Map<string, number>();

  creators.forEach((creator) => {
    const roleKey = creator.bestRole || creator.primaryRole;
    const anchor =
      anchorMap.get(roleKey) ||
      anchorMap.get(creator.primaryRole) ||
      { x: 0.54, y: 0.5, angle: -Math.PI / 2 };
    const rolePlacementIndex = rolePlacementCounts.get(roleKey) || 0;
    rolePlacementCounts.set(roleKey, rolePlacementIndex + 1);

    const scale = scaleForScore(getVisualScore(creator), rand);
    const tileWidth = tileBaseWidth * scale;
    const tileHeight = tileWidth * TALENT_TILE_ASPECT_RATIO;
    const depth = 0.22 + rand() * 1.46;
    const normalizedScore = getVisualScore(creator) / 99;
    const slotsPerRing = isFocusedRole ? 7 : viewportWidth < 800 ? 4 : 7;
    const ringIndex = Math.floor(rolePlacementIndex / slotsPerRing);
    const slotIndex = rolePlacementIndex % slotsPerRing;
    const angleStep = (Math.PI * 2) / slotsPerRing;
    const baseAngle =
      (isFocusedRole ? -Math.PI / 2 : anchor.angle) +
      slotIndex * angleStep +
      ringIndex * 0.18 +
      rand() * 0.34 -
      0.17;

    let x = canvasW * anchor.x;
    let y = canvasH * anchor.y;
    let attempts = 0;
    let tooClose = false;

    do {
      const angle = baseAngle + rand() * 0.18 - 0.09;
      const scoreBias = 1.08 - normalizedScore * 0.24;
      const baseRadius = isFocusedRole
        ? viewportWidth < 800
          ? 236 + ringIndex * 282
          : 184 + ringIndex * 222
        : viewportWidth < 800
          ? 226 + ringIndex * 258
          : 176 + ringIndex * 208;
      const radiusX = (baseRadius * scoreBias + rand() * (viewportWidth < 800 ? 16 : 12)) * spacingScale;
      const radiusY = (baseRadius * 0.92 * scoreBias + rand() * (viewportWidth < 800 ? 14 : 10)) * spacingScale;
      const driftX = (rand() - 0.5) * (viewportWidth < 800 ? 14 : 10) * Math.min(spacingScale, 1.02);
      const driftY = (rand() - 0.5) * (viewportWidth < 800 ? 12 : 8) * Math.min(spacingScale, 1.02);

      x = canvasW * anchor.x + Math.cos(angle) * radiusX + driftX;
      y = canvasH * anchor.y + Math.sin(angle) * radiusY + driftY;
      tooClose = positions.some((position) => {
        const previousWidth = tileBaseWidth * position.scale;
        const previousHeight = previousWidth * TALENT_TILE_ASPECT_RATIO;
        const overlapWidth = Math.max(
          0,
          Math.min(position.x + previousWidth, x + tileWidth) - Math.max(position.x, x)
        );
        const overlapHeight = Math.max(
          0,
          Math.min(position.y + previousHeight, y + tileHeight) - Math.max(position.y, y)
        );
        const overlapArea = overlapWidth * overlapHeight;
        const minArea = Math.min(previousWidth * previousHeight, tileWidth * tileHeight);
        const overlapRatio = minArea > 0 ? overlapArea / minArea : 0;
        const centerDx = Math.abs(position.x + previousWidth / 2 - (x + tileWidth / 2));
        const centerDy = Math.abs(position.y + previousHeight / 2 - (y + tileHeight / 2));
        const exceedsPixelOverlapCap = viewportWidth < 800 ? overlapWidth > 1 && overlapHeight > 1 : overlapWidth > 2 && overlapHeight > 2;
        const needsMoreBreathingRoom =
          centerDx < Math.min(previousWidth, tileWidth) * (viewportWidth < 800 ? 1.28 : 1.16) * spacingScale &&
          centerDy < Math.min(previousHeight, tileHeight) * (viewportWidth < 800 ? 1.22 : 1.1) * spacingScale;

        return overlapRatio > (viewportWidth < 800 ? 0.001 : 0.01) || exceedsPixelOverlapCap || needsMoreBreathingRoom;
      });
      attempts += 1;
    } while (tooClose && attempts < 220);

    positions.push({
      x: clamp(x, 112, canvasW - tileWidth - 112),
      y: clamp(y, 112, canvasH - tileHeight - 112),
      scale,
      rotate: -5 + rand() * 10,
      depth,
    });
  });

  return positions;
}
