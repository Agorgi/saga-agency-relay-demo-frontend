export const sagaRoutes = {
  landing: "/",
  talent: "/talent",
  projects: "/projects",
  projectNew: "/projects/new",
  myEvents: "/projects",
  profile: "/profile",
  relay: "/relay",
  chat: "/chat",
  talentProfile: (slug: string) => `/talent/${slug}`,
  project: (slug: string) => `/projects/${slug}`,
  projectDiscover: (slug: string) => `/projects/${slug}/discover`,
  event: (slug: string) => `/events/${slug}`,
};

export function withRoleFilter(pathname: string, role?: string | null) {
  if (!role) return pathname;
  const params = new URLSearchParams({ role });
  return `${pathname}?${params.toString()}`;
}
