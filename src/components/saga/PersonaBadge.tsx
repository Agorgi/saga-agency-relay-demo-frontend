import type { Persona } from "@/lib/sagasanPersonas";

const PERSONA_LABELS: Record<Persona, string> = {
  host: "Host",
  creative: "Creator",
  venue: "Venue",
  fan: "Fan",
};

/**
 * Small mono chip naming the current persona. Host is the default
 * tracer persona; the dot color distinguishes the creator / venue /
 * fan paths that otherwise share the same page-by-page flow.
 */
export function PersonaBadge({ persona }: { persona: Persona | null }) {
  if (!persona) {
    return null;
  }

  return (
    <span className="saga-persona-badge" data-persona={persona}>
      <span className="pb-dot" aria-hidden="true" />
      {PERSONA_LABELS[persona]}
    </span>
  );
}
