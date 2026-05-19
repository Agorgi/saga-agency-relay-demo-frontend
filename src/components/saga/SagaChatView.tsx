"use client";

import Link from "next/link";

type ChatTurn = {
  role: "user" | "saga";
  text: string;
};

const DEMO_TURNS: ChatTurn[] = [
  { role: "user", text: "Formal ball in July. Romantic, otherworldly." },
  {
    role: "saga",
    text: "Got it. To shape the crew — where, how many, what should we help with?",
  },
  {
    role: "user",
    text: "LA, ~150. Need a producer, stylist, venue lead, and performers. $15k all in.",
  },
  {
    role: "saga",
    text: "Locked in. $15k is tight but workable in LA in July — pulled it into a brief.",
  },
];

const BRIEF_FIELDS = [
  "Idea",
  "Where",
  "When",
  "Attendance",
  "Vibe",
  "Budget",
  "Help needed",
  "Existing crew",
];

export function SagaChatView() {
  return (
    <div className="relative flex flex-1 flex-col">
      <SagaRhizomeChat />
      <div className="saga-chat-thread">
        {DEMO_TURNS.map((turn, idx) => (
          <div
            key={idx}
            className={`saga-chat-row ${turn.role === "user" ? "is-user" : "is-saga"}`}
          >
            {turn.role === "saga" ? (
              <div className="saga-chat-avatar" aria-hidden="true" />
            ) : null}
            <div
              className={`saga-chat-bubble ${turn.role === "user" ? "is-user" : "is-saga"}`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        <div className="saga-brief-card">
          <div className="bc-header">
            <span>Brief — what we have</span>
            <span className="bc-count">8 of 8</span>
          </div>
          <div className="bc-grid">
            {BRIEF_FIELDS.map((field) => (
              <span key={field} className="bc-field">
                {field}
              </span>
            ))}
          </div>
        </div>

        <Link href="/demo/brief" className="saga-cta-outline">
          view your project <span className="arrow">→</span>
        </Link>
      </div>

      <form
        className="saga-chat-composer"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="saga-chat-composer-row">
          <input
            type="text"
            placeholder="reply to Sagasan…"
            aria-label="Reply to Sagasan"
          />
          <button type="submit" aria-label="Send">
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

function SagaRhizomeChat() {
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

        <circle className="rnode-d" cx="40" cy="540" r="1.5" />
        <circle className="rnode-d" cx="200" cy="500" r="1.5" />
        <circle className="rnode-d" cx="360" cy="560" r="1.5" />
        <circle className="rnode-d" cx="80" cy="640" r="1.5" />
        <circle className="rnode-d" cx="220" cy="660" r="1.5" />
        <circle className="rnode-d" cx="380" cy="640" r="1.5" />
        <circle className="rnode-d" cx="60" cy="720" r="1.5" />
        <circle className="rnode-d" cx="180" cy="720" r="1.5" />
        <circle className="rnode-d" cx="340" cy="680" r="1.5" />
        <circle className="rnode-d" cx="120" cy="780" r="1.5" />
        <circle className="rnode-d" cx="280" cy="780" r="1.5" />
        <circle className="rnode-d" cx="380" cy="770" r="1.5" />
      </svg>
      <span
        className="label label-you"
        style={{ left: "29%", top: "64%" }}
      >
        you
      </span>
      <span
        className="label label-saga"
        style={{ left: "60%", top: "74%" }}
      >
        sagasan
      </span>
    </div>
  );
}
