import Link from "next/link";

type BriefField = {
  label: string;
  value: string;
  missing?: boolean;
};

const BRIEF_FIELDS: BriefField[] = [
  { label: "When", value: "July 2026 (date TBD)", missing: true },
  { label: "Where", value: "Los Angeles · ~150 guests" },
  {
    label: "Vibe",
    value: "Romantic, otherworldly, cinematic",
    missing: true,
  },
  { label: "Budget", value: "$15k all-in" },
];

export function SagaBriefView() {
  return (
    <div className="relative flex flex-1 flex-col">
      <SagaRhizomeBrief />
      <div className="saga-brief-page">
        <p className="saga-brief-overline">YOUR PROJECT · IN-PROGRESS</p>

        <h1 className="saga-brief-display">
          a formal ball — <span className="accent-it">romantic, otherworldly</span>
        </h1>

        <p className="saga-brief-subtitle">
          here&apos;s what we have. tap any field marked{" "}
          <span className="missing">missing</span> to clarify.
        </p>

        <div className="saga-divider-thin" aria-hidden="true" />

        <div className="saga-brief-fields">
          <div className="saga-brief-fields-header">
            <span>Brief</span>
            <span className="step">{"// 01"}</span>
          </div>
          {BRIEF_FIELDS.map((field) => (
            <div key={field.label} className="saga-brief-row">
              <div className="row-label">
                <span>{field.label}</span>
                {field.missing ? (
                  <span className="saga-missing-badge">⚠ missing</span>
                ) : null}
              </div>
              <div className="row-value">{field.value}</div>
            </div>
          ))}
        </div>

        <div className="saga-contract-card">
          <div className="saga-contract-card-header">
            <span>What comes next…</span>
            <span>{"// 02"}</span>
          </div>
          <p className="saga-contract-card-body">
            We&apos;ll find a producer, stylist, venue lead, and performers,
            suggest 3–5 candidates per role with rationale, and prep
            outreach. Dw — nothing gets sent without your approval.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3">
          <Link href="/demo/crew" className="saga-cta-filled">
            build my crew <span>»</span>
          </Link>
          <Link href="/chat" className="saga-link-quiet">
            or keep talking through with Sagasan
          </Link>
        </div>
      </div>
    </div>
  );
}

function SagaRhizomeBrief() {
  return (
    <div className="saga-rhizome-labels" aria-hidden="true">
      <svg
        className="rhizome-bg"
        viewBox="0 0 400 832"
        preserveAspectRatio="xMidYMax slice"
      >
        <path className="rline-soft" d="M-30 540 Q200 470 430 560" />
        <path className="rline-soft" d="M-30 620 Q230 580 430 660" />
        <path className="rline" d="M40 700 Q200 660 360 740" />
        <path className="rline-soft" d="M90 770 Q230 720 370 790" />
        <path className="rline-soft" d="M-30 666 Q200 700 380 720" />
        <path className="rline-soft" d="M260 540 Q300 620 340 700" />
        <path className="rline-soft" d="M-30 468 Q200 510 430 555" />

        <circle className="rnode-d" cx="40" cy="600" r="1.5" />
        <circle className="rnode-d" cx="180" cy="620" r="1.5" />
        <circle className="rnode-d" cx="380" cy="540" r="1.5" />
        <circle className="rnode-d" cx="80" cy="660" r="1.5" />
        <circle className="rnode-d" cx="240" cy="700" r="1.5" />
        <circle className="rnode-d" cx="380" cy="680" r="1.5" />
        <circle className="rnode-d" cx="60" cy="740" r="1.5" />
        <circle className="rnode-d" cx="160" cy="760" r="1.5" />
        <circle className="rnode-d" cx="300" cy="780" r="1.5" />
        <circle className="rnode-d" cx="120" cy="500" r="1.5" />
        <circle className="rnode-d" cx="340" cy="460" r="1.5" />
      </svg>
      <span className="label label-you" style={{ left: "19%", top: "64%" }}>
        you
      </span>
      <span className="label label-cyan" style={{ left: "55%", top: "60%" }}>
        brief
      </span>
      <span className="label label-saga" style={{ left: "65%", top: "76%" }}>
        sagasan
      </span>
    </div>
  );
}
