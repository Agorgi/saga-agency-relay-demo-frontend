export const PUBLIC_TICKETING_COPY = {
  sidebarEyebrow: "External ticket info",
  sidebarTitle: "Ticket info",
  sidebarHelper: "Ticketing runs outside Sagasan in this demo. These tiers are illustrative only.",
  eventCta: "View ticket info",
  checkoutEyebrow: "External ticket info",
  checkoutHelper:
    "These are demo ticket tiers only. Ticketing runs outside Sagasan in this demo.",
  checkoutButtonIdle: "Select demo tiers",
  checkoutButtonAction: "Save demo pass",
} as const;

export function shouldShowPublicBackstagePanel() {
  return false;
}
