export type ProjectType =
  | "Brand campaign"
  | "Photoshoot"
  | "Video shoot"
  | "Social content package"
  | "Music video"
  | "Product launch"
  | "Pop-up / activation"
  | "Fan event"
  | "Editorial shoot"
  | "Creator collaboration"
  | "Live performance"
  | "Other";

export type ProjectStatus =
  | "draft"
  | "briefing"
  | "matching"
  | "outreach"
  | "booking"
  | "in-production"
  | "completed";

export type RoleStatus =
  | "open"
  | "recommended"
  | "shortlisted"
  | "outreach-sent"
  | "in-conversation"
  | "terms-ready"
  | "booked"
  | "declined";

export type CandidateStatus =
  | "suggested"
  | "shortlisted"
  | "saga-contacted"
  | "replied"
  | "negotiating"
  | "terms-ready"
  | "booked"
  | "unavailable"
  | "passed";

export type AvailabilitySignal = "available" | "maybe" | "busy" | "unknown";

export interface ProjectRole {
  id: string;
  name: string;
  quantity: number;
  required: boolean;
  status: RoleStatus;
  selectedTalentIds: string[];
  recommendedTalentIds: string[];
}

export interface Deliverable {
  id: string;
  title: string;
  ownerTalentId?: string;
  dueDate?: string;
  status: "not-started" | "in-progress" | "delivered" | "approved";
}

export interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  remaining: number;
  maxPerPerson?: number;
}

export interface Guest {
  id: string;
  name: string;
  avatar?: string;
  handle?: string;
}

export interface EventModule {
  enabled: boolean;
  headline?: string;
  publicEventSlug?: string;
  ticketTiers?: TicketTier[];
  guestList?: Guest[];
  rsvpCount?: number;
}

export interface ProjectStaffingPlan {
  summary: string;
  recommendedTimeline: string;
  estimatedBudgetRange: string;
  risks: string[];
  nextActions: string[];
}

export interface CreativeProject {
  id: string;
  title: string;
  slug: string;
  clientName?: string;
  projectType: ProjectType;
  description: string;
  goals: string[];
  city: string;
  locationMode: "on-site" | "remote" | "hybrid";
  dateLabel: string;
  budgetRange: string;
  status: ProjectStatus;
  requiredRoles: ProjectRole[];
  shortlistedTalentIds: string[];
  bookedTalentIds: string[];
  relayConversationIds: string[];
  deliverables: Deliverable[];
  staffingPlan: ProjectStaffingPlan;
  optionalEventModule?: EventModule;
}

export interface TalentProfile {
  id: string;
  name: string;
  roles: string[];
  city: string;
  bio: string;
  avatar?: string;
  portfolioImages: string[];
  credits: string[];
  tags: string[];
  projectTypes: ProjectType[];
  rateRange: string;
  availabilitySignal: AvailabilitySignal;
  portfolioFitScore?: number;
  styleFitScore?: number;
  budgetFitScore?: number;
  distributionScore?: number;
  audienceReach?: number;
  phoneMasked?: string;
}

export interface TalentRecommendation extends TalentProfile {
  primaryRole: string;
  portfolioFitScore: number;
  styleFitScore: number;
  categoryExperienceScore: number;
  locationFitScore: number;
  budgetFitScore: number;
  availabilityLikelihood: number;
  distributionScore: number;
  priorProjectRelevance: number;
  whySagaMatched: string[];
  candidateStatus: CandidateStatus;
}

export type RelayStatus =
  | "draft"
  | "outreach-sent"
  | "talent-replied"
  | "negotiating"
  | "terms-ready"
  | "booked"
  | "declined"
  | "unavailable";

export interface RelayMessage {
  id: string;
  sender: "client" | "saga" | "talent";
  visibleTo: "client" | "talent" | "both";
  channel: "app" | "sms";
  body: string;
  timestamp: string;
}

export interface BookingTerms {
  projectId: string;
  talentId: string;
  role: string;
  dateTime?: string;
  location?: string;
  rate?: string;
  scope?: string;
  deliverables?: string[];
  usageRights?: string;
  revisions?: string;
  expenses?: string;
  cancellation?: string;
  status: "empty" | "draft" | "sent" | "talent-accepted" | "client-approved" | "booked";
}

export interface RelayConversation {
  id: string;
  projectId: string;
  talentId: string;
  roleId: string;
  status: RelayStatus;
  messages: RelayMessage[];
  extractedTerms: BookingTerms;
  sagaSummary: string;
  nextActions: string[];
}

export interface BriefDraft {
  title: string;
  clientName: string;
  projectType: ProjectType;
  description: string;
  goal: string;
  referenceLinks: string;
  roles: string[];
  roleCounts: Record<string, number>;
  seniority: string;
  cultureNotes: string;
  localOnly: boolean;
  dateLabel: string;
  city: string;
  locationMode: "on-site" | "remote" | "hybrid";
  budgetRange: string;
  ratePreference: "fixed" | "day rate" | "hourly" | "negotiable";
  urgency: string;
  deliverables: string;
  usageRights: string;
}

export interface TalentFilters {
  role: string;
  city: string;
  projectType: ProjectType | "All";
  tag: string;
  budget: string;
  availability: AvailabilitySignal | "all";
}

export interface ViewerProfile {
  id: string;
  name: string;
  avatar?: string;
  company: string;
  bio: string;
  city: string;
  roles: string[];
  rateRange?: string;
  availability?: AvailabilitySignal;
  tags: string[];
  credits: string[];
  audienceReach?: number;
  activeProjectIds: string[];
  savedTalentIds: string[];
  inboundOpportunityIds: string[];
}
