export function SagaCandidatesView() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="saga-brief-page">
        <div className="saga-chip-strip">
          <span className="chip-dot" aria-hidden="true" />
          <span className="chip">Formal ball</span>
          <span className="chip-sep">/</span>
          <span className="chip">LA</span>
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

        <div className="saga-candidate-head">
          <div className="saga-candidate-overline">
            <span>· role ·</span>
            <span className="ov-sep">·</span>
            <span>
              <span className="ov-dot" aria-hidden="true" /> one contacted
            </span>
            <span className="ov-sep">·</span>
            <span>3 candidates</span>
            <span className="ov-sep">·</span>
            <span>1 approved</span>
          </div>
          <h1 className="saga-candidate-display">producer</h1>
        </div>

        <div className="saga-candidate-card">
          <div className="saga-candidate-hero">
            <div className="hero-tag">
              <span>The Crimson Hour</span>
              <span>·</span>
              <span>200 guests</span>
            </div>
          </div>
          <div className="saga-candidate-body">
            <div className="cb-name">Maya Okafor</div>
            <div className="cb-meta">Los Angeles · producer</div>
            <p className="cb-blurb">
              Recently produced a 200-guest themed gala in Pasadena with a
              romantic, cinematic brief — managed vendor calendar, timeline,
              $40k production budget. Comfortable on $15k all-in.
            </p>
            <div className="saga-evidence-row">
              <span className="saga-evidence-chip">
                <span className="ev-kind">▽ portfolio</span>
                <span>↗ mayaokofor.studio</span>
              </span>
              <span className="saga-evidence-chip">
                <span>@maya.okafor</span>
                <span className="ev-kind">/ instagram</span>
              </span>
            </div>
            <span className="saga-contactability">contactability verified</span>
            <div className="saga-decision-row">
              <button type="button" className="saga-decision-btn saga-decision-approve">
                ✓ approve
              </button>
              <button type="button" className="saga-decision-btn saga-decision-pass">
                ✗ pass
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
