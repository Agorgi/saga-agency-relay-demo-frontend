# Page briefs

One-pagers for the designer. Each page in the tracer is described in plain English: what it is, who uses it, what they do, what they leave with, what's on it, and what's deliberately NOT on it.

This file lives next to the engineering canon (`CLAUDE.md`) but it's for design, not engineering. No code. No file paths. No types.

## Design principles

These apply to every page.

- **Minimal.** Every page has one primary action. Everything else is secondary. If a page is doing two things, it's two pages.
- **Honest.** Show review status, contactability, and "no one has been contacted" badges by default — not buried in tooltips. The user should never have to ask "is this real?"
- **The brief is the spine.** Once captured, the brief shows up on every downstream page as a snapshot bar. Users always know what they're looking at.
- **Producer voice, not assistant voice.** Saga talks like a senior producer who's seen this kind of project before. Not "How may I help you?" Not "Here are some options!" — calm, direct, opinionated when it has reason to be.
- **No fake people.** Candidate cards have real names or are visibly labeled as demo composites. No identical stock photos. No avatars without a vetted source. If we can't show evidence, we don't show a confident card.

## Color, type, spacing

The cosmetic pass introduces a unified system across all pages. Designer's call on the specifics — these are the constraints:

- **Two surface tones + one ink + one accent + one warning.** That's the entire color palette. No additional brand colors per page.
- **Five type sizes max.** Suggest: 12 / 14 / 16 / 20 / 28 px.
- **Five spacing units max.** Suggest: 4 / 8 / 16 / 24 / 48 px.
- **One shared component vocabulary.** Button, Card, ListItem, Field, Chip, Disclaimer. Reused on every page; not redesigned per page.

---

# Tracer pages

These four pages are the design-partner journey. They're the ones to rebuild against the contracts below.

## Page: Landing + Sagasan chat
**URL:** `/`

### What it is
The front door. A single chat composer with a brief introduction and four persona chips (host / creative / venue / fan). The chat morphs from the landing experience into the active conversation when the user sends their first message.

### Who uses it
A first-time visitor. No account, no context. They've heard about Saga and want to see what it does.

### What they do here
Tell Sagasan what they want to make, in their own words. Either by typing freely or by tapping a persona chip first (which biases the conversation).

### What they leave with
A `Project` that exists in the system, with whatever facts Sagasan extracted from the conversation. When the brief has enough essentials, they're handed off to the brief review page.

### Core components (top-to-bottom)
- **Hero line.** One sentence. "Your personal creative producer." or similar. Calm, not promotional.
- **Composer.** Single text input. Always visible. The most prominent element on the page.
- **Persona chips.** Four optional starting points: "I want to host something," "I'm a creative," "I run a space," "Find me something to do." Optional means the user can type without tapping.
- **Chat thread (after first message).** User messages right-aligned, Sagasan messages left-aligned. No avatars. No timestamps unless useful.
- **Brief progress (after Sagasan recognizes a brief).** Quiet visual indicator of what's known vs missing. Not a form to fill out — a transparency signal.
- **Handoff CTA (only when brief is ready).** Single button labeled "View your project." Appears only after enough essentials are captured.

### What's NOT on this page
- Login / signup before the first message (the conversation IS the onboarding)
- Feature tour or marketing pitch
- "How it works" sections
- Talent grid teasers
- Multiple CTAs competing for the user's attention

### Tone
Sagasan reflects what the user said in their own words. Doesn't say "Got it — I have project idea, timing, vibe." Says "Got it — a formal ball in July, romantic and otherworldly. To shape the team I need a bit more: where, how many people, and what you want me to help with."

---

## Page: Brief review
**URL:** `/projects/[id]`

### What it is
The user's project rendered as a structured artifact, after Sagasan has captured enough of the brief. This is the first time they see their idea reflected back, organized.

### Who uses it
The user who just finished intake. They've been redirected here automatically. Or, a returning user who's coming back to a project they started earlier.

### What they do here
Read what Saga understood. Tap any field marked "inferred" to clarify. Click the primary button to advance to the next step (Build my crew). Or click "Edit with Sagasan" to reopen the chat and revise.

### What they leave with
Confidence that Saga understood them. Permission to keep going to crew, or a clear path back to the chat to refine.

### Core components (top-to-bottom)
- **Back link.** "Edit with Sagasan" — top-left, quiet, always present.
- **Project title.** The project idea, in one short line.
- **Brief facts.** Two-column layout of essentials: idea, location, when, attendance, vibe, budget, existing crew, help needed. Each fact is a one-word label and a one-line value. Inferred facts have a small inferred tag with a tap target.
- **"What Saga will do" block.** A short translation of the help-needed list into action language: "Find a producer, stylist, venue lead, and performers. Suggest 3-5 candidates per role. Prepare outreach drafts — you review before anything sends."
- **Primary action button.** "Build my crew" — full-width or near it, at the bottom. The single most prominent action on the page.

### What's NOT on this page
- Photos of the user, their friends, or any people
- Event timelines, day-of-show details, RSVPs, ticketing
- "Share project" / social
- Talent previews (those live on the crew page)
- Multiple CTAs (only "Build my crew" + secondary "Edit with Sagasan")
- Pricing, payments, subscription prompts

### Tone
The brief facts read calmly, like a producer's notes. The "What Saga will do" block is a quiet contract — what we'll do for you, and what we won't (we don't send before you say).

---

## Page: Build my Crew
**URL:** `/projects/[id]/crew`

### What it is
The list of roles Saga has inferred from the brief, with candidate counts and a path to review each role's candidates.

### Who uses it
The user who just clicked "Build my crew" on the brief page. They've committed to seeing the team shape.

### What they do here
Look at the list of roles, decide if it feels right (skip a role they don't want, click into a role to review candidates), and approve candidates per role.

### What they leave with
A team shape they understand, with at least one approved candidate per core role. Saga starts drafting outreach in the background.

### Core components (top-to-bottom)
- **Back link.** "Edit brief" — top-left, returns to brief review page.
- **Project snapshot bar.** A compressed version of the brief: project idea + 4-5 key facts on one line ("Formal ball · LA · July · 150 people · $15k").
- **Roles list.** Each role is its own card with: title, "core" or "nice-to-have" tag, one-sentence "why needed," candidate count ("3 candidates · 0 approved · no one contacted"), and a "Review" link.
- **Page-level primary action.** "Approve candidates to prepare outreach" — disabled until at least one candidate per core role is approved. When disabled, the button shows why ("approve at least 1 per core role").

### What's NOT on this page
- Per-candidate previews (those live on the role-specific page)
- Photos of candidates (no avatars on this page)
- Outreach drafts (post-tracer)
- Cross-role browsing ("show me everyone in LA")
- "Add another role manually" (Saga inferred the roles — manual addition is post-tracer)
- Talent grid or explore view

### Tone
Each role's "why needed" sentence is producer-direct: "Coordinates vendors, timeline, day-of-show" for producer. "Sources and books the location" for venue lead. No marketing copy.

---

## Page: Candidate review (per role)
**URL:** `/projects/[id]/crew/[roleId]`

### What it is
A list of 3-5 candidates matched to a specific role on the project. Each candidate has a name, location, rationale, evidence links, contactability, and a review action.

### Who uses it
The user reviewing candidates for one role at a time. They've come from the Build my Crew page by clicking "Review" on a role.

### What they do here
Read each candidate card carefully. Approve, pass, or request more info per candidate. When at least one is approved, return to the crew page.

### What they leave with
At least one approved candidate for this role. Confidence in why those candidates were chosen.

### Core components (top-to-bottom)
- **Back link.** "Back to crew" — top-left.
- **Role context.** Role title, one-sentence why-needed, persistent reminder: "No one has been contacted."
- **Candidate cards.** 3-5 cards stacked vertically. Each card contains:
  - Name (real name OR "Demo candidate · Composite from public sources" if it's a fixture)
  - Location and primary role (one line: "Los Angeles · Producer / Production designer")
  - "Why she fits" — one paragraph, brief-specific, max 2 sentences
  - Evidence row — 2-3 links: portfolio, IG handle, recent project. Each shows the domain.
  - Status row — "Contactability: verified" / "Status: pending review · not contacted · not confirmed"
  - Three action buttons inline: Approve, Pass, Need more info
- **Page-level primary action.** "Approve at least 1 candidate to continue" (disabled state) or "Save and return to crew" (enabled). Single button at the bottom.

### What's NOT on this page
- Candidate avatars (deferred until vetted source exists)
- Links to candidate profile pages (the card has everything; we don't drop the user into a different surface)
- Outreach copy preview (post-tracer)
- "Favorite" or generic engagement actions
- SMS / phone numbers (those are admin-only and gated)
- Other roles' candidates (per-role focus is the point of this page)

### Tone
"Why she fits" reads like a producer's pitch: concrete, references the brief, names the specific project type or city. Not "Great fit for your vibe!" — "Recently produced a 200-guest themed gala in Pasadena with a romantic, cinematic brief."

---

# Cosmetic-pass pages

These pages exist and stay roughly as they are. The cosmetic pass strips them to essentials and unifies them under the design tokens. **No behavior changes.** No new features. The goal is consistency, not redesign.

For each, the rule of thumb: **one page, one job, one primary action.** Strip everything else.

## `/me` — Profile
The user's own profile page. Strip to: name, role, location, portfolio link (if any), edit. Nothing else.

## `/feed` — Activity / Discover
A simple feed of events or projects in the user's area. Strip to: list view, one card per item, click to view detail. No tabs, no filters in v1, no algorithm chrome.

## `/events` and `/events/[id]` — Event listings and detail
List view = same shape as /feed. Detail page = event title, when, where, host, description, one CTA (if any). No backstage data.

## `/talent/[id]` — Public creator profile
Name, role, location, portfolio links, bio. No outreach buttons (those happen in-app on the crew page, not here). This page is for browsing, not booking.

## `/spaces` — Venues
Same pattern as /talent. Browse-only. No "book this space" buttons; that's a future surface.

## `/profile` — Onboarding to create a creative profile
A simple form for creatives to onboard. Strip to the essentials: name, role(s), location, portfolio, contact. Multi-step is fine if it makes the form less overwhelming, but each step must have ≤4 fields.

## `/explore` — Talent canvas (the demo carryover)
This page is currently a pannable canvas of fake talent. For the cosmetic pass: either retire it entirely (preferred — it's not in the tracer) or label every card visibly as "Demo composite." Don't keep it looking real.

---

# How to use these briefs

For each tracer page:
1. Take the brief to Figma. Sketch the layout.
2. Confirm the primary action is the most prominent visual element.
3. Confirm every "what's NOT on this page" item is truly absent — including hidden under menus.
4. Check the tone against the examples. If your copy sounds generic, rewrite it specific.
5. Share back. We'll review against the contract before engineering implements.

For cosmetic-pass pages:
1. Apply tokens (color, type, spacing) consistently.
2. Strip the page to its one job. Remove ornaments.
3. No behavior changes. If something on the page doesn't work today, that's an engineering concern, not a design concern.

Anything not on this list is out of scope for this iteration. Future scope (per-role outreach review, admin pages, group chat surfaces) gets its own briefs when the tracer is solid.
