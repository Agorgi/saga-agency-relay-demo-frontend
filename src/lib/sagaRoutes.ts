export const sagaRoutes = {
  landing: "/",
  talent: "/talent",
  explore: "/explore",
  feed: "/feed",
  me: "/me",
  spaces: "/spaces",
  projects: "/projects",
  myEvents: "/projects",
  profile: "/profile",
  postProject: "/post-project",
  create: "/post-project",
  relay: "/relay",
  chat: "/chat",
  talentProfile: (slug: string) => `/talent/${slug}`,
  project: (slug: string) => `/projects/${slug}`,
  projectDiscover: (slug: string) => `/projects/${slug}/discover`,
  event: (slug: string) => `/events/${slug}`,
  tickets: (slug: string) => `/events/${slug}/tickets`,
  apply: (slug: string) => `/events/${slug}/apply`,
  workspace: (slug: string) => `/events/${slug}/workspace`,
  discover: (slug: string) => `/events/${slug}/workspace/discover`,
  outreach: (slug: string) => `/events/${slug}/workspace/outreach`,
};

export function withRoleFilter(pathname: string, role?: string | null) {
  if (!role) return pathname;
  const params = new URLSearchParams({ role });
  return `${pathname}?${params.toString()}`;
}
