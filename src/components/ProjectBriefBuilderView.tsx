"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

type TranscriptMessage =
  | {
      id: string;
      sender: "user" | "saga";
      kind: "text";
      body: string;
    }
  | {
      id: string;
      sender: "user";
      kind: "attachments";
      body?: string;
      attachments: {
        name: string;
        meta: string;
        kindLabel: string;
        previewTitle: string;
        previewNote: string;
        tone: "rose" | "cobalt" | "violet" | "gold" | "emerald" | "slate";
      }[];
    }
  | {
      id: string;
      sender: "saga";
      kind: "summary";
      title: string;
      fields: Array<{ label: string; value: string }>;
    }
  | {
      id: string;
      sender: "saga";
      kind: "cta";
      body: string;
      buttonLabel: string;
      footnote: string;
    };

type ScenarioKey = "brand" | "event" | "photoshoot";

type DemoScenario = {
  key: ScenarioKey;
  label: string;
  projectSlug: string;
  projectTitle: string;
  projectTypeLabel: string;
  desktopTitle: string;
  desktopBody: string;
  notes: Array<{ label: string; value: string }>;
  finalTitle: string;
  finalBody: string;
  finalButtonLabel: string;
  privacyCopy: string;
  transcript: TranscriptMessage[];
};

const SCENARIOS: DemoScenario[] = [
  {
    key: "brand",
    label: "Brand campaign",
    projectSlug: "gloss-unit-brand-campaign",
    projectTitle: "Gloss Unit Brand Campaign",
    projectTypeLabel: "Brand campaign",
    desktopTitle: "Campaign intake over text, not a brief form.",
    desktopBody:
      "Saga can take a campaign idea through casual messages, docs, references, and spreadsheets, then turn it into a booked team without forcing the client into a long intake form.",
    notes: [
      {
        label: "Brief",
        value: "Saga extracts scope, deliverables, usage rights, budget, shoot window, and the roles needed for the campaign.",
      },
      {
        label: "Matching",
        value: "Beauty-native art direction, photography, HMUA, styling, and editing candidates start ranking immediately.",
      },
      {
        label: "Handoff",
        value: "The last text opens the staffing plan so the client can review the expanded brief, role list, and budget before moving into talent review.",
      },
    ],
    finalTitle: "Open the campaign staffing plan.",
    finalBody:
      "Once Saga has enough information, the client gets a direct handoff into a clear staffing plan with the brief, roles, and budget guardrails before opening the talent canvas.",
    finalButtonLabel: "Review staffing plan",
    privacyCopy:
      "Saga Relay keeps client and talent contact details private while rates, deliverables, and availability get negotiated through the platform.",
    transcript: [
      {
        id: "brand-1",
        sender: "user",
        kind: "text",
        body:
          "We’re launching Gloss Unit’s new serum and need a brand campaign that feels high-gloss, beauty-native, and creator-aware. Hero stills plus paid social cutdowns.",
      },
      {
        id: "brand-2",
        sender: "saga",
        kind: "text",
        body:
          "Perfect. Send me the shoot city, date window, budget range, deliverables, and anything visual you already have. I’ll turn it into open roles and first-pass matches.",
      },
      {
        id: "brand-3",
        sender: "user",
        kind: "text",
        body:
          "Los Angeles. Jun 14-15. Budget is $18K-$28K. Need hero stills, 6 paid social edits, creator seeding assets, and clean usage language.",
      },
      {
        id: "brand-4",
        sender: "user",
        kind: "attachments",
        body: "Sending what our team already has.",
        attachments: [
          {
            name: "Campaign Deck.pdf",
            meta: "brand direction + references",
            kindLabel: "Deck",
            previewTitle: "Gloss Unit launch world",
            previewNote: "close-up serum lighting, frosted glass, creator-native beauty cues",
            tone: "rose",
          },
          {
            name: "Usage Notes.docx",
            meta: "owned + paid social",
            kindLabel: "Usage",
            previewTitle: "Channel + rights matrix",
            previewNote: "hero stills, paid social cutdowns, creator seeding usage",
            tone: "cobalt",
          },
          {
            name: "Shot List.xlsx",
            meta: "assets + timing",
            kindLabel: "Shot list",
            previewTitle: "Launch day deliverables",
            previewNote: "8 hero stills, 6 cutdowns, alt crops, BTS capture blocks",
            tone: "violet",
          },
        ],
      },
      {
        id: "brand-5",
        sender: "saga",
        kind: "text",
        body:
          "Got them. I parsed the visual world, usage assumptions, and the first draft of deliverables from the docs.",
      },
      {
        id: "brand-6",
        sender: "saga",
        kind: "summary",
        title: "What I extracted",
        fields: [
          { label: "Project type", value: "Brand campaign" },
          { label: "Open roles", value: "Producer, Photographer, Art Director, Stylist, HMUA, Editor" },
          { label: "Deliverables", value: "8 hero stills + 6 paid social cutdowns" },
          { label: "Usage", value: "Owned channels + paid social" },
          { label: "Budget", value: "$18K-$28K · on-site in Los Angeles" },
        ],
      },
      {
        id: "brand-7",
        sender: "user",
        kind: "text",
        body:
          "Yes. Prioritize people who understand beauty lighting and can also make the creator seeding portion feel natural.",
      },
      {
        id: "brand-8",
        sender: "saga",
        kind: "text",
        body:
          "Done. I posted the campaign roles, weighted beauty + creator fluency, and prepped private Relay outreach so nobody has to cold DM talent directly.",
      },
      {
        id: "brand-9",
        sender: "saga",
        kind: "cta",
        body:
          "Your staffing plan is ready. Open Saga to review the brief, the role breakdown, and the rough budget before deciding who to contact first.",
        buttonLabel: "Review staffing plan",
        footnote: "Saga Relay keeps phone numbers and emails private while you negotiate scope, rate, and usage.",
      },
    ],
  },
  {
    key: "event",
    label: "Fan event",
    projectSlug: "court-of-stars-fan-gala",
    projectTitle: "Court of Stars Fan Gala",
    projectTypeLabel: "Fan event",
    desktopTitle: "Event staffing becomes a text conversation.",
    desktopBody:
      "Instead of filling out a dense event planner, the host can just text Saga the concept, venue reality, public applications, and vibe references. Saga handles the structure.",
    notes: [
      {
        label: "Brief",
        value: "Saga pulls guest count, city, vendors, cosplay applications, public-facing modules, and open production roles from the thread.",
      },
      {
        label: "Matching",
        value: "Hosts, producers, photographers, cosplayers, vendor leads, and social managers surface based on both execution fit and community reach.",
      },
      {
        label: "Handoff",
        value: "The final message opens the staffing plan so the host can review roles, budgets, and then move into talent matching.",
      },
    ],
    finalTitle: "Open the event staffing plan.",
    finalBody:
      "Event-specific modules still exist, but they’re secondary. The primary handoff is the staffing plan, then the talent review canvas where the host can start building the team.",
    finalButtonLabel: "Review staffing plan",
    privacyCopy:
      "Saga keeps hosts and talent from exchanging direct contact details while availability, rate, and scope get worked out through Relay.",
    transcript: [
      {
        id: "event-1",
        sender: "user",
        kind: "text",
        body:
          "I’m throwing a Court of Stars fan gala in Pasadena. I need the host program, guest experience, cosplay guests, vendors, and capture team to all feel premium but still fandom-native.",
      },
      {
        id: "event-2",
        sender: "saga",
        kind: "text",
        body:
          "Amazing. Send the date window, budget range, guest count, venue notes, and whether vendors or cosplayers can apply publicly. I’ll build the whole staffing plan from there.",
      },
      {
        id: "event-3",
        sender: "user",
        kind: "text",
        body:
          "Pasadena, Jul 18-19, budget is $8K-$15K, around 180 guests, and yes I want public vendor + cosplay applications. Need it to feel elegant, romantic, cosmic, and very fan-trustworthy.",
      },
      {
        id: "event-4",
        sender: "user",
        kind: "attachments",
        body: "Sending what we have so far.",
        attachments: [
          {
            name: "Venue Packet.pdf",
            meta: "Castle Green notes",
            kindLabel: "Venue",
            previewTitle: "Ballroom + courtyard flow",
            previewNote: "guest ingress, check-in pressure points, romantic lighting limits",
            tone: "gold",
          },
          {
            name: "Guestlist Draft.xlsx",
            meta: "VIP + mutuals",
            kindLabel: "Guest list",
            previewTitle: "VIP + fandom reach",
            previewNote: "mutual clusters, invited creators, expected community pull",
            tone: "emerald",
          },
          {
            name: "Moodboard.pdf",
            meta: "masquerade + celestial cues",
            kindLabel: "Moodboard",
            previewTitle: "Cosmic gala references",
            previewNote: "navy velvet, gold trims, celestial props, masked fantasy styling",
            tone: "violet",
          },
        ],
      },
      {
        id: "event-5",
        sender: "saga",
        kind: "text",
        body:
          "Perfect. I extracted the venue constraints, aesthetic direction, public application settings, and likely production pressure points.",
      },
      {
        id: "event-6",
        sender: "saga",
        kind: "summary",
        title: "What I extracted",
        fields: [
          { label: "Project type", value: "Fan event" },
          { label: "Open roles", value: "Producer, Photographer, Host, Vendor, Cosplayer, Social Manager" },
          { label: "Public modules", value: "Vendor + cosplay applications enabled" },
          { label: "Audience", value: "180 guests · fandom-trust sensitive" },
          { label: "Budget", value: "$8K-$15K · on-site in Pasadena" },
        ],
      },
      {
        id: "event-7",
        sender: "user",
        kind: "text",
        body:
          "Great. Please prioritize people who already work well in fan communities and who can actually help pull in the right crowd.",
      },
      {
        id: "event-8",
        sender: "saga",
        kind: "text",
        body:
          "Done. I weighted community fluency and distribution value, posted the open roles, and prepared private outreach so guests, vendors, and production talent all flow through Saga.",
      },
      {
        id: "event-9",
        sender: "saga",
        kind: "cta",
        body:
          "Your staffing plan is ready. Open Saga to review the brief, the role plan, and the ticketing demand option before you decide who should get the first text.",
        buttonLabel: "Review staffing plan",
        footnote: "Event modules stay attached, but the next decision point is the staffing plan and then private Saga Relay outreach.",
      },
    ],
  },
  {
    key: "photoshoot",
    label: "Photoshoot",
    projectSlug: "j-fashion-editorial-campaign",
    projectTitle: "J-fashion Editorial Campaign",
    projectTypeLabel: "Photoshoot",
    desktopTitle: "Photoshoot intake becomes a simple chat.",
    desktopBody:
      "Instead of asking a producer to fill out a four-step brief, Saga can pull the essentials through casual text and deliver a ready-to-review talent board in one handoff.",
    notes: [
      {
        label: "Brief",
        value: "Saga extracts shoot type, timeline, city, budget, deliverables, and the visual language from messages and attachments.",
      },
      {
        label: "Matching",
        value: "Photographer, stylist, HMUA, producer, and cosplay-talent fits rank instantly against the brief.",
      },
      {
        label: "Handoff",
        value: "The final Saga text opens the staffing plan first, then the user can move into the review canvas role-by-role.",
      },
    ],
    finalTitle: "Open the photoshoot staffing plan.",
    finalBody:
      "This is the cleanest expression of the product: text intake, automatic role creation, a simple plan page, and then a handoff into the review canvas.",
    finalButtonLabel: "Review staffing plan",
    privacyCopy:
      "Saga Relay keeps both sides protected. Outreach, negotiation, and booking can happen without the client and talent trading direct contact info.",
    transcript: [
      {
        id: "photo-1",
        sender: "user",
        kind: "text",
        body:
          "I’m producing a J-fashion editorial campaign in LA and I need the team to understand anime styling, chrome-gothic lighting, and alt beauty references.",
      },
      {
        id: "photo-2",
        sender: "saga",
        kind: "text",
        body:
          "Perfect. Send me the date window, budget, city, deliverables, and anything visual you already have. I’ll turn that into a staffed shoot plan.",
      },
      {
        id: "photo-3",
        sender: "user",
        kind: "text",
        body:
          "Fri, May 18 in Los Angeles. Budget is $6K-$10K. Need hero stills, 4 cutdowns, and a team that feels editorial, subcultural, and actually fluent in the references.",
      },
      {
        id: "photo-4",
        sender: "user",
        kind: "attachments",
        body: "Sending the references.",
        attachments: [
          {
            name: "Moodboard.pdf",
            meta: "chrome gothic references",
            kindLabel: "Moodboard",
            previewTitle: "Chrome gothic editorial",
            previewNote: "anime-native beauty, metallic flash, club-light skin tones",
            tone: "slate",
          },
          {
            name: "Shotlist.docx",
            meta: "hero stills + BTS",
            kindLabel: "Shot list",
            previewTitle: "Looks + frames",
            previewNote: "hero portraits, movement stills, tight beauty crops, BTS inserts",
            tone: "cobalt",
          },
          {
            name: "Budget.xlsx",
            meta: "shoot assumptions",
            kindLabel: "Budget",
            previewTitle: "Crew + set assumptions",
            previewNote: "LA day rate guardrails, styling pull costs, chrome prop reserve",
            tone: "rose",
          },
        ],
      },
      {
        id: "photo-5",
        sender: "saga",
        kind: "text",
        body:
          "Got them. I extracted the look, deliverables, cultural signals, and budget constraints from the thread and the docs.",
      },
      {
        id: "photo-6",
        sender: "saga",
        kind: "summary",
        title: "What I extracted",
        fields: [
          { label: "Project type", value: "Photoshoot" },
          { label: "Open roles", value: "Photographer, Stylist, HMUA, Producer, Cosplayer" },
          { label: "Visual cues", value: "Chrome gothic, editorial, anime-native" },
          { label: "Deliverables", value: "Hero stills + 4 cutdowns" },
          { label: "Budget", value: "$6K-$10K · on-site in Los Angeles" },
        ],
      },
      {
        id: "photo-7",
        sender: "user",
        kind: "text",
        body:
          "Exactly. Prioritize people who already know how to make anime references look fashion-forward instead of cosplay-basic.",
      },
      {
        id: "photo-8",
        sender: "saga",
        kind: "text",
        body:
          "Done. I opened the shoot roles, ranked the first wave of talent, and prepared Relay outreach so you can decide who to text without cold DMs.",
      },
      {
        id: "photo-9",
        sender: "saga",
        kind: "cta",
        body:
          "Your staffing plan is ready. Open Saga to review the brief, the role list, and the rough budget before you branch into the visual review canvas.",
        buttonLabel: "Review staffing plan",
        footnote: "From the staffing plan, the next step is the visual review canvas where you can compare talent cards and branch deeper by vibe or role.",
      },
    ],
  },
];

export function ProjectBriefBuilderView() {
  const projects = useAgencyStore((state) => state.projects);
  const { openProject, goHome } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";
  const [activeScenarioKey, setActiveScenarioKey] = useState<ScenarioKey>("brand");
  const [brandVisibleCount, setBrandVisibleCount] = useState(0);
  const [brandSagaTyping, setBrandSagaTyping] = useState(false);
  const [brandComposerText, setBrandComposerText] = useState("");
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.key === activeScenarioKey) || SCENARIOS[0],
    [activeScenarioKey]
  );

  const targetProject = useMemo(
    () => projects.find((project) => project.slug === activeScenario.projectSlug) || null,
    [activeScenario.projectSlug, projects]
  );

  const isBrandInteractive = activeScenario.key === "brand";
  const visibleTranscript = isBrandInteractive
    ? activeScenario.transcript.slice(0, brandVisibleCount)
    : activeScenario.transcript;
  const pendingBrandMessage =
    isBrandInteractive && !brandSagaTyping
      ? activeScenario.transcript[brandVisibleCount] || null
      : null;
  const pendingBrandUserMessage =
    pendingBrandMessage && pendingBrandMessage.sender === "user" ? pendingBrandMessage : null;

  useEffect(() => {
    if (isBrandInteractive) {
      setBrandVisibleCount(0);
      setBrandSagaTyping(false);
      return;
    }

    setBrandVisibleCount(activeScenario.transcript.length);
    setBrandSagaTyping(false);
  }, [activeScenario.key, activeScenario.transcript.length, isBrandInteractive]);

  useEffect(() => {
    if (!isBrandInteractive || brandSagaTyping) return;
    const nextMessage = activeScenario.transcript[brandVisibleCount];
    if (!nextMessage || nextMessage.sender !== "saga") return;

    setBrandSagaTyping(true);
    const timeout = window.setTimeout(() => {
      setBrandSagaTyping(false);
      setBrandVisibleCount((current) => current + 1);
    }, getTypingDelay(nextMessage, brandVisibleCount));

    return () => window.clearTimeout(timeout);
  }, [activeScenario, brandSagaTyping, brandVisibleCount, isBrandInteractive]);

  useEffect(() => {
    if (!isBrandInteractive) {
      setBrandComposerText("");
      return;
    }

    if (!pendingBrandUserMessage || brandSagaTyping) {
      setBrandComposerText("");
      return;
    }

    if (pendingBrandUserMessage.kind === "attachments") {
      setBrandComposerText(
        pendingBrandUserMessage.body || `Sending ${pendingBrandUserMessage.attachments.length} references to Saga.`
      );
      return;
    }

    setBrandComposerText(pendingBrandUserMessage.body);
  }, [brandSagaTyping, isBrandInteractive, pendingBrandUserMessage]);

  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    const timeout = window.setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [brandSagaTyping, visibleTranscript.length]);

  const handleBrandSend = () => {
    if (!pendingBrandUserMessage) return;
    setBrandComposerText("");
    setBrandVisibleCount((current) => current + 1);
  };

  return (
    <div className={`absolute inset-0 overflow-hidden ${
      isDark ? "bg-[#080e18] text-white" : "bg-[#f6f4ef] text-ink"
    }`}>
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(124,199,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,79,158,0.18),transparent_30%),linear-gradient(180deg,rgba(10,16,28,0.92),rgba(6,10,18,0.96))]"
            : "bg-[radial-gradient(circle_at_top,rgba(123,198,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,79,158,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(238,245,255,0.96))]"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className={`text-[10px] uppercase tracking-[0.28em] ${isDark ? "text-white/40" : "text-ink-light"}`}>Post a project</p>
            <p className={`mt-2 text-sm sm:text-base ${isDark ? "text-white/64" : "text-ink-light"}`}>
              Text Saga the idea. The staffing plan appears once intake is complete.
            </p>
          </div>
          <button
            onClick={goHome}
            className={`rounded-pill border px-4 py-2.5 text-sm font-medium backdrop-blur-xl ${
              isDark
                ? "border-white/10 bg-white/[0.06] text-white/82"
                : "border-black/8 bg-white/84 text-ink shadow-[0_12px_30px_rgba(6,10,18,0.08)]"
            }`}
          >
            Close
          </button>
        </div>

        <div className="px-4 pb-3 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                onClick={() => setActiveScenarioKey(scenario.key)}
                className={`rounded-pill px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeScenario.key === scenario.key
                    ? "bg-[linear-gradient(90deg,#ff4f9e,#687dff)] text-white shadow-[0_18px_40px_rgba(95,120,255,0.22)]"
                    : isDark
                      ? "border border-white/10 bg-white/[0.05] text-white/72"
                      : "border border-black/8 bg-white/84 text-ink shadow-[0_12px_26px_rgba(6,10,18,0.06)]"
                }`}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeScenario.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
            className="min-h-0 flex-1 px-0 pb-0 sm:px-4 sm:pb-4 lg:px-8 lg:pb-8"
          >
            <div className={`mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-hidden border sm:rounded-[38px] ${
              isDark
                ? "border-white/10 bg-[#0c1220]/96 shadow-[0_40px_120px_rgba(6,10,18,0.46)]"
                : "border-black/8 bg-white/94 shadow-[0_40px_120px_rgba(6,10,18,0.14)]"
            }`}>
              <div className={`px-4 py-3 sm:px-6 ${isDark ? "border-b border-white/8" : "border-b border-black/6 bg-[#fbfcff]"}`}>
                <div className={`flex items-center justify-between text-[11px] ${isDark ? "text-white/56" : "text-ink-light"}`}>
                  <span>9:41</span>
                  <span>{activeScenario.projectTypeLabel}</span>
                  <span>iMessage</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={goHome}
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isDark ? "bg-white/[0.05]" : "bg-[#eef4ff] text-ink"
                      }`}
                      aria-label="Back"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 3 6 8l4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>Saga</p>
                      <p className={`mt-1 text-xs ${isDark ? "text-white/40" : "text-ink-light"}`}>{activeScenario.label} onboarding</p>
                    </div>
                  </div>
                  <div className={`hidden rounded-pill border px-4 py-2 text-xs sm:block ${
                    isDark
                      ? "border-white/10 bg-white/[0.04] text-white/66"
                      : "border-black/8 bg-white text-ink-light"
                  }`}>
                    Brief → Match → Relay → Book → Produce
                  </div>
                </div>
              </div>

              <div
                ref={transcriptRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5 no-scrollbar"
              >
                <div className={`mx-auto mb-3 w-fit rounded-pill px-4 py-2 text-xs ${
                  isDark ? "bg-white/[0.05] text-white/50" : "bg-[#f2f6fd] text-ink-light"
                }`}>
                  {activeScenario.projectTitle}
                </div>

                {visibleTranscript.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <TranscriptBubble
                      message={message}
                      dark={isDark}
                      onOpen={() => targetProject && openProject(targetProject.id)}
                    />
                  </motion.div>
                ))}

                {isBrandInteractive && brandSagaTyping ? <TypingBubble dark={isDark} /> : null}
              </div>

              <div className={`px-3 py-3 sm:px-6 sm:py-4 ${
                isDark ? "border-t border-white/8 bg-[#0a101b]" : "border-t border-black/6 bg-[#fbfcff]"
              }`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/34" : "text-ink-light"}`}>Conversation model</p>
                    <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/58" : "text-ink-light"}`}>
                      {isBrandInteractive
                        ? "Brand campaign plays as a step-by-step texting demo. Click send and Saga types back before the next response appears."
                        : "These scenarios stay visible as fixed investor examples. Switch back to Brand campaign to play through the send-by-send flow."}
                    </p>
                  </div>

                  {isBrandInteractive ? (
                    <BrandComposer
                      pendingMessage={pendingBrandUserMessage}
                      composerText={brandComposerText}
                      disabled={!pendingBrandUserMessage || brandSagaTyping}
                      onSend={handleBrandSend}
                      dark={isDark}
                    />
                  ) : (
                    <div className={`rounded-[24px] border px-4 py-3 text-sm ${
                      isDark ? "border-white/10 bg-white/[0.04] text-white/62" : "border-black/8 bg-white text-ink-light"
                    }`}>
                      Saga adapts the intake, extracted fields, and handoff by project type.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TranscriptBubble({
  message,
  dark,
  onOpen,
}: {
  message: TranscriptMessage;
  dark: boolean;
  onOpen: () => void;
}) {
  const isUser = message.sender === "user";

  if (message.kind === "summary") {
    return (
      <div className="flex justify-start">
        <div className={`w-[88%] rounded-[26px] rounded-bl-[10px] px-4 py-4 shadow-[0_14px_36px_rgba(6,10,18,0.18)] ${
          dark ? "bg-[#171d2c] text-white" : "border border-black/8 bg-[#f7fbff] text-ink shadow-[0_14px_36px_rgba(6,10,18,0.08)]"
        }`}>
          <p className={`text-[11px] font-medium uppercase tracking-[0.18em] ${dark ? "text-white/36" : "text-ink-light"}`}>{message.title}</p>
          <div className="mt-3 space-y-2">
            {message.fields.map((field) => (
              <div key={field.label} className={`flex items-start justify-between gap-3 rounded-[18px] px-3 py-2.5 ${
                dark ? "bg-white/[0.04]" : "bg-white"
              }`}>
                <span className={`text-xs ${dark ? "text-white/42" : "text-ink-light"}`}>{field.label}</span>
                <span className={`max-w-[62%] text-right text-xs font-medium ${dark ? "text-white/82" : "text-ink"}`}>{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (message.kind === "attachments") {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[720px] rounded-[26px] rounded-br-[10px] bg-[#1877f2] px-4 py-4 text-white shadow-[0_14px_36px_rgba(24,119,242,0.22)] sm:w-[88%]">
          {message.body ? <p className="text-sm leading-6">{message.body}</p> : null}
          <div className="mt-3 space-y-2">
            {message.attachments.map((attachment) => (
              <AttachmentCard key={attachment.name} attachment={attachment} dark={dark} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (message.kind === "cta") {
    return (
      <div className="flex justify-start">
        <div className={`w-full max-w-[760px] rounded-[26px] rounded-bl-[10px] px-4 py-4 shadow-[0_14px_36px_rgba(6,10,18,0.18)] sm:w-[92%] ${
          dark ? "bg-[#171d2c] text-white" : "border border-black/8 bg-[#f7fbff] text-ink shadow-[0_14px_36px_rgba(6,10,18,0.08)]"
        }`}>
          <p className={`text-sm leading-6 ${dark ? "text-white/88" : "text-ink"}`}>{message.body}</p>
          <button
            onClick={onOpen}
            className={`mt-4 rounded-pill px-4 py-2.5 text-sm font-medium shadow-sm ${
              dark ? "bg-[#ffffff] text-[#101624]" : "bg-[#1877f2] text-white"
            }`}
          >
            {message.buttonLabel}
          </button>
          <p className={`mt-3 text-xs leading-5 ${dark ? "text-white/46" : "text-ink-light"}`}>{message.footnote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`w-full max-w-[680px] rounded-[26px] px-4 py-3.5 text-sm leading-6 sm:w-[88%] ${
          isUser
            ? "rounded-br-[10px] bg-[#1877f2] text-white shadow-[0_14px_36px_rgba(24,119,242,0.22)]"
            : dark
              ? "rounded-bl-[10px] bg-[#171d2c] text-white/88 shadow-[0_14px_36px_rgba(6,10,18,0.18)]"
              : "rounded-bl-[10px] border border-black/8 bg-[#f7fbff] text-ink shadow-[0_14px_36px_rgba(6,10,18,0.08)]"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}

function AttachmentCard({
  attachment,
  dark,
}: {
  attachment: Extract<TranscriptMessage, { kind: "attachments" }>["attachments"][number];
  dark: boolean;
}) {
  const tone = getAttachmentTone(attachment.tone);

  return (
    <div className={`overflow-hidden rounded-[18px] ${dark ? "bg-white/14" : "border border-white/30 bg-white/26"}`}>
      <div className="relative px-3 py-3.5" style={{ background: tone.background }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_34%)]" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
              {attachment.kindLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/54">{attachment.meta}</span>
          </div>
          <p className="mt-6 max-w-[85%] text-sm font-medium leading-5 text-white">{attachment.previewTitle}</p>
          <p className="mt-1 max-w-[88%] text-xs leading-5 text-white/72">{attachment.previewNote}</p>
        </div>
      </div>
      <div className={`px-3 py-3 ${dark ? "" : "bg-[rgba(255,255,255,0.88)]"}`}>
        <p className={`text-sm font-medium ${dark ? "text-white" : "text-ink"}`}>{attachment.name}</p>
        <p className={`mt-1 text-xs ${dark ? "text-white/72" : "text-ink-light"}`}>{attachment.meta}</p>
      </div>
    </div>
  );
}

function getAttachmentTone(tone: Extract<
  Extract<TranscriptMessage, { kind: "attachments" }>["attachments"][number]["tone"],
  string
>) {
  switch (tone) {
    case "rose":
      return { background: "linear-gradient(135deg, rgba(255,112,165,0.48), rgba(101,78,255,0.32))" };
    case "cobalt":
      return { background: "linear-gradient(135deg, rgba(94,164,255,0.5), rgba(59,92,255,0.34))" };
    case "violet":
      return { background: "linear-gradient(135deg, rgba(139,101,255,0.52), rgba(52,26,112,0.4))" };
    case "gold":
      return { background: "linear-gradient(135deg, rgba(242,191,92,0.52), rgba(122,74,22,0.38))" };
    case "emerald":
      return { background: "linear-gradient(135deg, rgba(75,198,150,0.48), rgba(26,93,88,0.4))" };
    case "slate":
      return { background: "linear-gradient(135deg, rgba(145,156,178,0.34), rgba(54,63,84,0.52))" };
    default:
      return { background: "linear-gradient(135deg, rgba(94,164,255,0.5), rgba(59,92,255,0.34))" };
  }
}

function TypingBubble({ dark }: { dark: boolean }) {
  return (
    <div className="flex justify-start">
      <div className={`w-fit rounded-[24px] rounded-bl-[10px] px-4 py-3 shadow-[0_14px_36px_rgba(6,10,18,0.18)] ${
        dark ? "bg-[#171d2c] text-white" : "border border-black/8 bg-[#f7fbff] text-ink shadow-[0_14px_36px_rgba(6,10,18,0.08)]"
      }`}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              animate={{ opacity: [0.28, 1, 0.28], y: [0, -2, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.14, ease: "easeInOut" }}
              className={`h-2 w-2 rounded-full ${dark ? "bg-white/72" : "bg-[#1877f2]/72"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandComposer({
  pendingMessage,
  composerText,
  disabled,
  onSend,
  dark,
}: {
  pendingMessage: TranscriptMessage | null;
  composerText: string;
  disabled: boolean;
  onSend: () => void;
  dark: boolean;
}) {
  const label = getComposerPreview(pendingMessage);
  const attachmentMessage = pendingMessage?.kind === "attachments" ? pendingMessage : null;
  const isAttachments = Boolean(attachmentMessage);

  return (
    <div className="flex w-full flex-col gap-3 lg:w-[480px]">
      <div className={`rounded-[30px] border px-3 py-3 ${
        dark
          ? "border-white/10 bg-[#101726] shadow-[0_18px_46px_rgba(6,10,18,0.28)]"
          : "border-black/8 bg-white shadow-[0_18px_46px_rgba(6,10,18,0.08)]"
      }`}>
        <div className="flex items-end gap-3">
          <div className={`min-w-0 flex-1 rounded-[22px] px-4 py-3 shadow-sm ${
            dark ? "bg-[#ffffff]" : "bg-[#f6f9ff]"
          }`}>
            <p className="text-sm leading-6 text-[#0e1727]">{composerText || label}</p>
            {isAttachments ? (
              <p className="mt-2 text-xs leading-5 text-[#5f708b]">
                Saga will parse the files below and fold them into the staffing plan.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onSend}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1877f2] text-white shadow-[0_14px_36px_rgba(24,119,242,0.22)] transition-transform disabled:cursor-not-allowed ${
              dark ? "disabled:bg-[#243049] disabled:text-white/28" : "disabled:bg-[#d7e6f7] disabled:text-[#8ea2bc]"
            }`}
            aria-label="Send next message"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 8.75 14.5 3 10.2 15 8.45 10.05 3 8.75Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        {isAttachments ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachmentMessage?.attachments.map((attachment) => (
              <span
                key={attachment.name}
                className={`rounded-pill border px-3 py-1.5 text-xs ${
                  dark
                    ? "border-white/10 bg-white/[0.06] text-white/70"
                    : "border-black/8 bg-[#f6f9ff] text-ink-light"
                }`}
              >
                {attachment.kindLabel}: {attachment.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getComposerPreview(message: TranscriptMessage | null) {
  if (!message) return "Saga is wrapping the handoff.";
  if (message.kind === "attachments") {
    return `Send ${message.attachments.length} references to Saga.`;
  }
  if (message.kind === "text") return message.body;
  return "Continue the thread.";
}

function getTypingDelay(message: TranscriptMessage, index: number) {
  const base = 1000;
  return base + (index % 2) * 20;
}
