export type AdminNavIcon =
  | "activity"
  | "alertCircle"
  | "brain"
  | "checkSquare"
  | "circleDot"
  | "command"
  | "database"
  | "folderKanban"
  | "keyRound"
  | "messageSquare"
  | "network"
  | "rocket"
  | "rows3"
  | "scrollText"
  | "search"
  | "send"
  | "shieldCheck"
  | "testTube"
  | "users";

export type AdminNavBadgeKey =
  | "needsAttention"
  | "messages"
  | "projects"
  | "sourcing"
  | "qualitySafety"
  | "operations";

export type AdminNavItem = {
  label: string;
  shortLabel?: string;
  href: string;
  description: string;
  keywords: string[];
  badgeKey?: AdminNavBadgeKey;
  advanced?: boolean;
  icon: AdminNavIcon;
  activeMatchHrefs?: string[];
};

export type AdminNavSection = {
  id: string;
  label: string;
  plainEnglishDescription: string;
  defaultOpen: boolean;
  collapsible: boolean;
  advanced?: boolean;
  badgeKey?: AdminNavBadgeKey;
  items: AdminNavItem[];
};

export type AdminRoutePriority = "primary" | "secondary" | "advanced";

export type AdminRouteInventoryItem = {
  routePath: string;
  currentLabel: string;
  proposedLabel: string;
  proposedCategory: string;
  priority: AdminRoutePriority;
  appearsRedundant: boolean;
  canBeCombinedWith?: string;
  directAccessOnly: boolean;
  operatorPurpose: string;
  appearsInMainSidebar: boolean;
  notes?: string;
};

export const sidebarRendersItemDescriptions = false;

export const adminNavSections: AdminNavSection[] = [
  {
    id: "command-center",
    label: "Command Center",
    plainEnglishDescription: "Start here for status and next steps.",
    defaultOpen: true,
    collapsible: false,
    items: [
      {
        label: "Command Center",
        shortLabel: "Home",
        href: "/admin/command-center",
        description: "Operator home base for status, blockers, and next actions.",
        keywords: ["home", "status", "blockers", "next action", "safety"],
        icon: "command",
      },
    ],
  },
  {
    id: "needs-attention",
    label: "Needs Attention",
    plainEnglishDescription: "Review approvals, blockers, and warnings.",
    defaultOpen: true,
    collapsible: false,
    badgeKey: "needsAttention",
    items: [
      {
        label: "Needs Attention",
        href: "/admin/needs-attention",
        description: "One queue for items that need operator review.",
        keywords: ["approval", "review", "blocked", "attention"],
        icon: "alertCircle",
        badgeKey: "needsAttention",
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    plainEnglishDescription: "Briefs, projects, tasks, and ideas.",
    defaultOpen: false,
    collapsible: true,
    badgeKey: "projects",
    items: [
      {
        label: "Project Briefs",
        href: "/admin/projects",
        description: "Review project ideas and producer briefs.",
        keywords: ["projects", "briefs", "intake"],
        icon: "folderKanban",
        activeMatchHrefs: ["/admin/projects/"],
      },
      {
        label: "Projects",
        href: "/admin/network-projects",
        description: "Review canonical standalone network projects.",
        keywords: ["network", "projects", "canonical"],
        icon: "network",
        activeMatchHrefs: ["/admin/network-projects/"],
      },
      {
        label: "Staffing Needs",
        href: "/admin/role-openings",
        description: "Review roles needed for projects.",
        keywords: ["roles", "openings", "staffing"],
        icon: "checkSquare",
      },
      {
        label: "Opportunities",
        href: "/admin/opportunities",
        description: "Review opportunity records for role openings.",
        keywords: ["opportunities", "gigs"],
        icon: "send",
      },
      {
        label: "Tasks",
        href: "/admin/tasks",
        description: "Track admin and production tasks.",
        keywords: ["tasks", "todo"],
        icon: "checkSquare",
      },
      {
        label: "Interest Checks",
        href: "/admin/interest-checks",
        description: "Review ideas people want to see exist.",
        keywords: ["interest", "ideas", "community"],
        icon: "messageSquare",
      },
    ],
  },
  {
    id: "talent",
    label: "Talent",
    plainEnglishDescription: "People, creators, contacts, and relationships.",
    defaultOpen: false,
    collapsible: true,
    items: [
      {
        label: "People",
        href: "/admin/people",
        description: "Review people records in the standalone pilot database.",
        keywords: ["people", "person"],
        icon: "users",
      },
      {
        label: "Creator Profiles",
        href: "/admin/creator-profiles",
        description: "Review creator and gig-seeker profiles.",
        keywords: ["creators", "profiles", "gig seekers"],
        icon: "circleDot",
      },
      {
        label: "Contacts",
        href: "/admin/contacts",
        description: "Review contacts without exposing raw contact details.",
        keywords: ["contacts", "contactability"],
        icon: "users",
      },
      {
        label: "Relationships",
        href: "/admin/relationships",
        description: "Review relationship evidence used for matching.",
        keywords: ["relationships", "edges", "mutual"],
        icon: "circleDot",
      },
    ],
  },
  {
    id: "sourcing",
    label: "Sourcing",
    plainEnglishDescription: "Find, review, and rank collaborators.",
    defaultOpen: false,
    collapsible: true,
    badgeKey: "sourcing",
    items: [
      {
        label: "Talent Search",
        href: "/admin/sourcing",
        description: "Find possible collaborators using internal data and safe research plans.",
        keywords: ["sourcing", "talent", "search"],
        icon: "search",
      },
      {
        label: "Smart Matching",
        href: "/admin/matching",
        description: "Rank candidates for a project with explainable scores.",
        keywords: ["matching", "ranking", "recommendations"],
        icon: "network",
      },
      {
        label: "Candidate Reviews",
        href: "/admin/sourcing-quality",
        description: "Check candidate evidence before shortlist consideration.",
        keywords: ["quality", "review", "candidate"],
        icon: "search",
        badgeKey: "sourcing",
      },
      {
        label: "Public Web Research",
        href: "/admin/sourcing/public-web",
        description: "Queue or review gated public talent research plans.",
        keywords: ["public web", "research", "citations"],
        icon: "search",
      },
      {
        label: "Research Cleanup",
        href: "/admin/sourcing/public-web-review",
        description: "Review, discard, archive, and clean up public research results.",
        keywords: ["review", "cleanup", "citations"],
        icon: "search",
        badgeKey: "sourcing",
      },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    plainEnglishDescription: "Drafts and message review.",
    defaultOpen: false,
    collapsible: true,
    badgeKey: "messages",
    items: [
      {
        label: "Pending Replies",
        href: "/admin/needs-attention?type=pending_reply",
        description: "Review conversations and replies that need admin attention.",
        keywords: ["pending replies", "needs admin", "drafts"],
        icon: "messageSquare",
        badgeKey: "messages",
      },
      {
        label: "Outreach Drafts",
        href: "/admin/outbound-drafts",
        description: "Review draft-only outreach content.",
        keywords: ["drafts", "outreach"],
        icon: "send",
        badgeKey: "messages",
      },
      {
        label: "Group Chats",
        href: "/admin/groupchats",
        description: "Review group-chat planning records.",
        keywords: ["group chats", "chat"],
        icon: "messageSquare",
      },
      {
        label: "Web Chat Sessions",
        href: "/admin/web-chat-sessions",
        description: "Read recent anonymous web chat sessions and message history.",
        keywords: ["web chat", "sessions", "messages", "viewer"],
        icon: "messageSquare",
        activeMatchHrefs: ["/admin/web-chat-sessions/"],
      },
    ],
  },
  {
    id: "quality-safety",
    label: "Quality & Safety",
    plainEnglishDescription: "AI review, tuning, transcripts, and audit.",
    defaultOpen: false,
    collapsible: true,
    badgeKey: "qualitySafety",
    items: [
      {
        label: "AI Reply Review",
        href: "/admin/llm-review",
        description: "Review AI-assisted reply quality and safety.",
        keywords: ["llm", "ai", "quality"],
        icon: "brain",
        badgeKey: "qualitySafety",
      },
      {
        label: "Response Tuning",
        href: "/admin/llm-review?status=NEEDS_PROMPT_TUNING",
        description: "Review replies that suggest prompt or response tuning.",
        keywords: ["response tuning", "prompt tuning", "ai"],
        icon: "brain",
        badgeKey: "qualitySafety",
      },
      {
        label: "Transcript Dry Runs",
        href: "/admin/transcript-dry-runs",
        description: "Run simulated conversations and review reply quality.",
        keywords: ["transcripts", "dry runs"],
        icon: "testTube",
      },
      {
        label: "Audit Log",
        href: "/admin/audit",
        description: "Review redacted audit events.",
        keywords: ["audit", "events"],
        icon: "scrollText",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    plainEnglishDescription: "Health, pipeline, data, launch, and beta.",
    defaultOpen: false,
    collapsible: true,
    badgeKey: "operations",
    items: [
      {
        label: "System Health",
        href: "/admin/observability",
        description: "Review redacted health signals and risks.",
        keywords: ["observability", "system health", "risk"],
        icon: "activity",
        badgeKey: "operations",
      },
      {
        label: "Pipeline",
        href: "/admin/pipeline",
        description: "Review message pipeline state, blocked sends, and jobs.",
        keywords: ["pipeline", "jobs"],
        icon: "rows3",
        badgeKey: "operations",
      },
      {
        label: "Data Tools",
        href: "/admin/data-ops",
        description: "Export, redact, and review pilot data safely.",
        keywords: ["data ops", "exports", "redaction"],
        icon: "database",
      },
      {
        label: "Launch Checklist",
        href: "/admin/launch-drill",
        description: "Run safe readiness checks for self-test, pilot, and beta stages.",
        keywords: ["launch", "drill", "checklist", "readiness"],
        icon: "rocket",
        badgeKey: "operations",
      },
      {
        label: "Public Beta",
        href: "/admin/public-beta",
        description: "Inspect public beta readiness and waitlist state.",
        keywords: ["public beta", "waitlist", "launch"],
        icon: "rocket",
      },
      {
        label: "Public Beta Access",
        href: "/admin/access",
        description: "Review access decisions, caps, and waitlist behavior.",
        keywords: ["access", "allowlist", "waitlist", "caps"],
        icon: "keyRound",
      },
      {
        label: "Pilot Overview",
        href: "/admin/pilot",
        description: "Check pilot mode, safety gates, and next pilot steps.",
        keywords: ["pilot", "design partners", "readiness"],
        icon: "shieldCheck",
      },
      {
        label: "Pilot Participants",
        href: "/admin/pilot-participants",
        description: "Review pilot participant states without exposing raw numbers.",
        keywords: ["participants", "allowlist", "pilot"],
        icon: "users",
      },
      {
        label: "Pilot Feedback",
        href: "/admin/pilot-feedback",
        description: "Read and review pilot feedback safely.",
        keywords: ["feedback", "pilot"],
        icon: "messageSquare",
      },
      {
        label: "Beta Simulations",
        href: "/admin/beta-simulations",
        description: "Run simulated cohorts before inviting real people.",
        keywords: ["simulation", "cohort", "beta"],
        icon: "testTube",
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    plainEnglishDescription: "Diagnostics and legacy review tools.",
    defaultOpen: false,
    collapsible: true,
    advanced: true,
    items: [
      {
        label: "Dev Lab",
        href: "/admin/dev",
        description: "Advanced demo and internal API tools for operators and developers.",
        keywords: ["dev", "test lab", "internal api", "seed"],
        icon: "testTube",
        advanced: true,
      },
      {
        label: "Talent Map",
        href: "/admin/candidate-graph",
        description: "Inspect graph evidence, tags, locations, and relationships.",
        keywords: ["candidate graph", "talent map", "relationships"],
        icon: "network",
        advanced: true,
      },
      {
        label: "Recommendations",
        href: "/admin/recommendations",
        description: "Review suggested candidates before any user-facing step.",
        keywords: ["recommendations", "shortlist"],
        icon: "network",
        advanced: true,
      },
      {
        label: "Matching Evaluation",
        href: "/admin/matching-evaluation",
        description: "Run golden matching tests and see tuning suggestions.",
        keywords: ["evaluation", "tuning", "fixtures"],
        icon: "testTube",
        advanced: true,
      },
      {
        label: "Outreach Log",
        href: "/admin/outreach",
        description: "Inspect outreach records without sending anything.",
        keywords: ["outreach", "log"],
        icon: "send",
        advanced: true,
      },
    ],
  },
];

export const adminRouteInventory: AdminRouteInventoryItem[] = [
  { routePath: "/admin", currentLabel: "Admin sign in", proposedLabel: "Admin Sign In", proposedCategory: "Authentication", priority: "secondary", appearsRedundant: false, directAccessOnly: true, appearsInMainSidebar: false, operatorPurpose: "Sign in to the protected admin portal." },
  { routePath: "/admin/command-center", currentLabel: "Command Center", proposedLabel: "Command Center", proposedCategory: "Command Center", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Start here to see current stage, blockers, and next safe action." },
  { routePath: "/admin/needs-attention", currentLabel: "Needs Attention", proposedLabel: "Needs Attention", proposedCategory: "Needs Attention", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review approvals, failures, and warnings that need operator action." },
  { routePath: "/admin/projects", currentLabel: "Project Briefs", proposedLabel: "Project Briefs", proposedCategory: "Projects", priority: "primary", appearsRedundant: false, canBeCombinedWith: "/admin/network-projects", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review inbound ideas and producer briefs." },
  { routePath: "/admin/projects/[id]", currentLabel: "Project detail", proposedLabel: "Project Brief Detail", proposedCategory: "Projects", priority: "primary", appearsRedundant: false, directAccessOnly: true, appearsInMainSidebar: false, operatorPurpose: "Inspect one project brief and its review-only workflow." },
  { routePath: "/admin/network-projects", currentLabel: "Network Projects", proposedLabel: "Projects", proposedCategory: "Projects", priority: "secondary", appearsRedundant: true, canBeCombinedWith: "/admin/projects", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review canonical standalone project records created from briefs or imports." },
  { routePath: "/admin/network-projects/[id]", currentLabel: "Network project detail", proposedLabel: "Project Detail", proposedCategory: "Projects", priority: "secondary", appearsRedundant: true, canBeCombinedWith: "/admin/projects/[id]", directAccessOnly: true, appearsInMainSidebar: false, operatorPurpose: "Inspect one canonical project record." },
  { routePath: "/admin/role-openings", currentLabel: "Role Openings", proposedLabel: "Staffing Needs", proposedCategory: "Projects", priority: "secondary", appearsRedundant: true, canBeCombinedWith: "/admin/opportunities", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review roles a project may need." },
  { routePath: "/admin/opportunities", currentLabel: "Opportunities", proposedLabel: "Opportunities", proposedCategory: "Projects", priority: "secondary", appearsRedundant: true, canBeCombinedWith: "/admin/role-openings", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review opportunity records attached to staffing needs." },
  { routePath: "/admin/tasks", currentLabel: "Tasks", proposedLabel: "Tasks", proposedCategory: "Projects", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Track tasks and blocked work." },
  { routePath: "/admin/interest-checks", currentLabel: "Interest Checks", proposedLabel: "Interest Checks", proposedCategory: "Projects", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review ideas people want to see exist." },
  { routePath: "/admin/people", currentLabel: "People", proposedLabel: "People", proposedCategory: "Talent", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review people records in the standalone database." },
  { routePath: "/admin/creator-profiles", currentLabel: "Creator Profiles", proposedLabel: "Creator Profiles", proposedCategory: "Talent", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review creator and gig-seeker profiles." },
  { routePath: "/admin/contacts", currentLabel: "Contacts", proposedLabel: "Contacts", proposedCategory: "Talent", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review contacts with redacted contact details." },
  { routePath: "/admin/relationships", currentLabel: "Relationships", proposedLabel: "Relationships", proposedCategory: "Talent", priority: "secondary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review relationship evidence used by matching." },
  { routePath: "/admin/sourcing", currentLabel: "Talent Sourcing", proposedLabel: "Talent Search", proposedCategory: "Sourcing", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Find possible collaborators using internal data and reviewed research." },
  { routePath: "/admin/matching", currentLabel: "Smart Matching", proposedLabel: "Smart Matching", proposedCategory: "Sourcing", priority: "primary", appearsRedundant: false, canBeCombinedWith: "/admin/candidate-graph", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Rank candidates for a project with explainable scores." },
  { routePath: "/admin/sourcing-quality", currentLabel: "Candidate Quality Review", proposedLabel: "Candidate Reviews", proposedCategory: "Sourcing", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review candidate quality before shortlist consideration." },
  { routePath: "/admin/sourcing/public-web", currentLabel: "Public Talent Research", proposedLabel: "Public Web Research", proposedCategory: "Sourcing", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Queue or review gated public research plans without contacting anyone." },
  { routePath: "/admin/sourcing/public-web-review", currentLabel: "Research Review", proposedLabel: "Research Cleanup", proposedCategory: "Sourcing", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review, discard, archive, and clean up public research results." },
  { routePath: "/admin/candidate-graph", currentLabel: "Talent Map", proposedLabel: "Talent Map", proposedCategory: "Advanced", priority: "advanced", appearsRedundant: true, canBeCombinedWith: "/admin/matching", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Debug graph evidence behind smart matching." },
  { routePath: "/admin/recommendations", currentLabel: "Recommendations", proposedLabel: "Recommendations", proposedCategory: "Advanced", priority: "advanced", appearsRedundant: true, canBeCombinedWith: "/admin/matching", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review legacy recommendation records." },
  { routePath: "/admin/matching-evaluation", currentLabel: "Matching Evaluation", proposedLabel: "Matching Evaluation", proposedCategory: "Advanced", priority: "advanced", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Run synthetic matching QA and tuning reports." },
  { routePath: "/admin/outbound-drafts", currentLabel: "Outreach Drafts", proposedLabel: "Outreach Drafts", proposedCategory: "Messages", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review draft-only outreach and shortlist copy." },
  { routePath: "/admin/groupchats", currentLabel: "Group Chats", proposedLabel: "Group Chats", proposedCategory: "Messages", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review group chat planning records; no chats are created automatically." },
  { routePath: "/admin/outreach", currentLabel: "Outreach Log", proposedLabel: "Outreach Log", proposedCategory: "Advanced", priority: "advanced", appearsRedundant: true, canBeCombinedWith: "/admin/outbound-drafts", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Inspect legacy outreach records without sending anything." },
  { routePath: "/admin/llm-review", currentLabel: "AI Reply Review", proposedLabel: "AI Reply Review", proposedCategory: "Quality & Safety", priority: "primary", appearsRedundant: false, canBeCombinedWith: "Response Tuning", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review AI-assisted replies and tuning needs." },
  { routePath: "/admin/transcript-dry-runs", currentLabel: "Transcript Dry Runs", proposedLabel: "Transcript Dry Runs", proposedCategory: "Quality & Safety", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Run simulated conversations and inspect reply quality." },
  { routePath: "/admin/audit", currentLabel: "Audit Log", proposedLabel: "Audit Log", proposedCategory: "Quality & Safety", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review redacted audit events." },
  { routePath: "/admin/observability", currentLabel: "System Health", proposedLabel: "System Health", proposedCategory: "Operations", priority: "primary", appearsRedundant: true, canBeCombinedWith: "/admin/pipeline", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review redacted health and risk signals." },
  { routePath: "/admin/pipeline", currentLabel: "Pipeline", proposedLabel: "Pipeline", proposedCategory: "Operations", priority: "primary", appearsRedundant: true, canBeCombinedWith: "/admin/observability", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review message processing jobs and blocked sends." },
  { routePath: "/admin/data-ops", currentLabel: "Data Tools", proposedLabel: "Data Tools", proposedCategory: "Operations", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Export, redact, and review pilot data safely." },
  { routePath: "/admin/launch-drill", currentLabel: "Launch Checklist", proposedLabel: "Launch Checklist", proposedCategory: "Operations", priority: "primary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Run dry launch readiness checks." },
  { routePath: "/admin/public-beta", currentLabel: "Public Beta Waitlist", proposedLabel: "Public Beta", proposedCategory: "Operations", priority: "primary", appearsRedundant: false, canBeCombinedWith: "/admin/access", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Inspect public beta readiness and waitlist state." },
  { routePath: "/admin/access", currentLabel: "Public Beta Access", proposedLabel: "Public Beta Access", proposedCategory: "Operations", priority: "secondary", appearsRedundant: true, canBeCombinedWith: "/admin/public-beta", directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review access decisions, caps, and waitlist behavior." },
  { routePath: "/admin/pilot", currentLabel: "Pilot Overview", proposedLabel: "Pilot Overview", proposedCategory: "Operations", priority: "secondary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Check pilot mode, safety gates, and pilot counters." },
  { routePath: "/admin/pilot-participants", currentLabel: "Pilot Participants", proposedLabel: "Pilot Participants", proposedCategory: "Operations", priority: "secondary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review pilot participant state with redacted contact display." },
  { routePath: "/admin/pilot-feedback", currentLabel: "Pilot Feedback", proposedLabel: "Pilot Feedback", proposedCategory: "Operations", priority: "secondary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Review pilot feedback notes." },
  { routePath: "/admin/beta-simulations", currentLabel: "Beta Simulations", proposedLabel: "Beta Simulations", proposedCategory: "Operations", priority: "secondary", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Run simulated cohorts before inviting real people." },
  { routePath: "/admin/dev", currentLabel: "Admin Dev Lab", proposedLabel: "Dev Lab", proposedCategory: "Advanced", priority: "advanced", appearsRedundant: false, directAccessOnly: false, appearsInMainSidebar: true, operatorPurpose: "Use developer/demo tools that run without Twilio." },
];

export function normalizeAdminPath(pathname: string) {
  const withoutQuery = pathname.split("?")[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function flattenAdminNavItems() {
  return adminNavSections.flatMap((section) =>
    section.items.map((item) => ({ ...item, section })),
  );
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  const normalized = normalizeAdminPath(pathname);
  if (item.href.includes("?")) {
    return pathname === item.href || (item.activeMatchHrefs || []).some((matchHref) =>
      normalized.startsWith(normalizeAdminPath(matchHref)),
    );
  }
  const itemHref = normalizeAdminPath(item.href);
  if (normalized === itemHref) return true;
  return (item.activeMatchHrefs || []).some((matchHref) =>
    normalized.startsWith(normalizeAdminPath(matchHref)),
  );
}

export function isAdminNavSectionActive(pathname: string, section: AdminNavSection) {
  return section.items.some((item) => isAdminNavItemActive(pathname, item));
}

export function getDefaultAdminSectionOpen(pathname: string, section: AdminNavSection) {
  return section.defaultOpen || isAdminNavSectionActive(pathname, section);
}

export function getAdminSectionOpenState(
  pathname: string,
  storedOpenState: Record<string, boolean> = {},
) {
  return Object.fromEntries(
    adminNavSections.map((section) => [
      section.id,
      Object.prototype.hasOwnProperty.call(storedOpenState, section.id)
        ? storedOpenState[section.id]
        : getDefaultAdminSectionOpen(pathname, section),
    ]),
  ) as Record<string, boolean>;
}

export function getAdminChevronDirection(isOpen: boolean) {
  return isOpen ? "down" : "right";
}

export function getAdminNavItemForPath(pathname: string) {
  return flattenAdminNavItems().find((item) => isAdminNavItemActive(pathname, item));
}

export function getAdminBreadcrumbs(pathname: string) {
  const active = getAdminNavItemForPath(pathname);
  if (!active) return [];
  return [
    { label: "Command Center", href: "/admin/command-center" },
    { label: active.section.label, href: active.section.items[0]?.href || active.href },
    { label: active.label, href: active.href },
  ].filter(
    (crumb, index, crumbs) =>
      index === 0 || crumb.href !== crumbs[index - 1]?.href || crumb.label !== crumbs[index - 1]?.label,
  );
}
