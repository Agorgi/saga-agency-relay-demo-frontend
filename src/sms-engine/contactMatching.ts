import type { Contact, ProjectBrief } from "@prisma/client";
import { getDb } from "@/sms-engine/db";
import { parseRequiredRoles, type RequiredRole } from "@/sms-engine/workflow";

export type ContactMatch = {
  contact: Contact;
  role: RequiredRole;
  score: number;
  reasons: string[];
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function includesMatch(values: string[], needle: string) {
  const normalizedNeedle = normalize(needle);
  return values.some((value) => {
    const normalizedValue = normalize(value);
    return (
      normalizedValue === normalizedNeedle ||
      normalizedValue.includes(normalizedNeedle) ||
      normalizedNeedle.includes(normalizedValue)
    );
  });
}

export function scoreContactForRole({
  contact,
  role,
  city,
}: {
  contact: Contact;
  role: RequiredRole;
  city?: string | null;
}) {
  let score = 0;
  const reasons: string[] = [];
  const contactCity = normalize(contact.city);
  const projectCity = normalize(city);

  if (contactCity && projectCity && contactCity === projectCity) {
    score += 3;
    reasons.push("city match");
  }

  if (includesMatch(contact.roles, role.role)) {
    score += 2;
    reasons.push("role match");
  }

  for (const tag of role.tags || []) {
    if (includesMatch(contact.roles, tag)) {
      score += 2;
      reasons.push(`role tag: ${tag}`);
    }

    if (includesMatch(contact.tags, tag)) {
      score += 1;
      reasons.push(`tag: ${tag}`);
    }
  }

  if (contact.portfolioUrl || contact.instagramUrl) {
    score += 1;
    reasons.push("has portfolio/social");
  }

  return { score, reasons };
}

export async function findContactMatches(projectBrief: ProjectBrief) {
  const roles = parseRequiredRoles(projectBrief.requiredRoles);
  const contacts = await getDb().contact.findMany({
    where: {
      smsOptedOutAt: null,
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const matchesByRole = roles.map((role) => {
    const matches = contacts
      .map((contact) => {
        const scored = scoreContactForRole({
          contact,
          role,
          city: projectBrief.city,
        });

        return {
          contact,
          role,
          score: scored.score,
          reasons: scored.reasons,
        };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      role,
      matches,
    };
  });

  return matchesByRole;
}
