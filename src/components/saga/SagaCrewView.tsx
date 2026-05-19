import Link from "next/link";

type Role = {
  name: string;
  tag: "CORE" | "NICE-TO-HAVE";
  body: string;
  candidates?: string;
  approved?: string;
  contacted?: boolean;
  reviewed?: boolean;
  href?: string;
};

const ROLES: Role[] = [
  {
    name: "Producer",
    tag: "CORE",
    body: "Coordinates vendors, timeline, day-of-show.",
    candidates: "3 candidates",
    approved: "1 approved",
    contacted: true,
    reviewed: true,
    href: "/demo/candidates",
  },
  {
    name: "Stylist / production designer",
    tag: "CORE",
    body: "Translates the vibe — sets, florals, lighting.",
    candidates: "3 candidates",
    approved: "0 approved",
    contacted: false,
    href: "/demo/candidates",
  },
  {
    name: "Venue lead",
    tag: "CORE",
    body: "Sources and books the location.",
    candidates: "3 candidates",
    approved: "0 approved",
    href: "/demo/candidates",
  },
  {
    name: "Performers",
    tag: "NICE-TO-HAVE",
    body: "Live music or a single setpiece — string trio, vocalist, aerialist.",
  },
];

export function SagaCrewView() {
  return (
    <div className="relative flex flex-1 flex-col">
      <SagaRhizomeCrew />
      <div className="saga-brief-page">
        <div className="saga-chip-strip">
          <span className="chip-dot" aria-hidden="true" />
          <span className="chip">Formal ball</span>
          <span className="chip-sep">/</span>
          <span className="chip">July</span>
          <span className="chip-sep">/</span>
          <span className="chip">150</span>
          <span className="chip-sep">/</span>
          <span className="chip">$15k</span>
          <span className="chip-status">
            <span className="chip-status-dot-cyan" aria-hidden="true" />
            the crew · in-progress
          </span>
        </div>

        <h1 className="saga-crew-display">
          four roles, <span className="accent-it">lined up.</span>
        </h1>

        <p className="saga-brief-subtitle">
          review candidates per role. skip a role you don&apos;t want — three is
          fine if the budget says three.
        </p>

        <div className="flex flex-col gap-3 pt-1">
          {ROLES.map((role) => (
            <RoleCard key={role.name} role={role} />
          ))}
        </div>

        <div className="saga-crew-approve-bar" aria-disabled="true">
          approve 1 per core role to continue
        </div>
      </div>
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <div className="saga-role-card">
      <div className="role-head">
        <div className="role-name">
          <span className="role-name-text">{role.name}</span>
          <span className="role-tag">{role.tag}</span>
        </div>
        {role.href ? (
          <Link
            href={role.href}
            className={`saga-role-pill ${
              role.reviewed ? "saga-role-pill-reviewed" : ""
            }`}
          >
            {role.reviewed ? "reviewed »" : "review »"}
          </Link>
        ) : null}
      </div>
      <p className="role-body">{role.body}</p>
      {(role.candidates || role.approved || role.contacted !== undefined) && (
        <div className="role-meta">
          {role.candidates ? <span>{role.candidates}</span> : null}
          {role.approved ? (
            <>
              <span className="meta-dot" aria-hidden="true" />
              <span>{role.approved}</span>
            </>
          ) : null}
          {role.contacted !== undefined ? (
            <>
              <span
                className={`meta-dot ${role.contacted ? "meta-dot-cyan" : ""}`}
                aria-hidden="true"
              />
              <span>{role.contacted ? "contacted" : "not contacted"}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SagaRhizomeCrew() {
  return (
    <div className="saga-rhizome-labels" aria-hidden="true">
      <svg
        className="rhizome-bg"
        viewBox="0 0 400 832"
        preserveAspectRatio="xMidYMax slice"
      >
        <path className="rline-soft" d="M-30 580 Q200 530 430 590" />
        <path className="rline-soft" d="M-30 660 Q230 620 430 700" />
        <path className="rline" d="M40 720 Q200 690 360 760" />
        <path className="rline-soft" d="M90 780 Q230 750 370 790" />
        <path className="rline-soft" d="M-30 700 Q200 720 380 740" />
        <path className="rline-soft" d="M260 580 Q300 660 340 720" />

        <circle className="rnode-d" cx="40" cy="640" r="1.5" />
        <circle className="rnode-d" cx="180" cy="660" r="1.5" />
        <circle className="rnode-d" cx="380" cy="600" r="1.5" />
        <circle className="rnode-d" cx="80" cy="700" r="1.5" />
        <circle className="rnode-d" cx="240" cy="720" r="1.5" />
        <circle className="rnode-d" cx="380" cy="720" r="1.5" />
        <circle className="rnode-d" cx="60" cy="760" r="1.5" />
        <circle className="rnode-d" cx="160" cy="780" r="1.5" />
        <circle className="rnode-d" cx="300" cy="790" r="1.5" />
      </svg>
    </div>
  );
}
