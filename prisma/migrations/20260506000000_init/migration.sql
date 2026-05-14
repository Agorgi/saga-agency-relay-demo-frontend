-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NEW_INBOUND', 'INTAKE_IN_PROGRESS', 'BRIEF_READY_FOR_REVIEW', 'ROLE_MAPPING_READY', 'OUTREACH_DRAFTED', 'OUTREACH_IN_PROGRESS', 'SHORTLIST_READY', 'SHORTLIST_SENT', 'GROUPCHAT_PENDING', 'GROUPCHAT_ACTIVE', 'PRODUCTION_IN_PROGRESS', 'ARCHIVED', 'NEEDS_ADMIN');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'GROUP_SMS', 'ADMIN');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFTED', 'SENT', 'INTERESTED', 'NOT_INTERESTED', 'MAYBE', 'NO_RESPONSE', 'APPROVED_FOR_GROUPCHAT');

-- CreateEnum
CREATE TYPE "GroupChatStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('SYSTEM', 'ADMIN', 'USER', 'CONTACT', 'LLM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "hasCompletedFirstTimeHostQuestion" BOOLEAN NOT NULL DEFAULT false,
    "smsOptedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NEW_INBOUND',
    "firstTimeHost" BOOLEAN,
    "city" TEXT,
    "projectType" TEXT,
    "title" TEXT,
    "description" TEXT,
    "targetDate" TEXT,
    "budgetRange" TEXT,
    "expectedAudienceSize" TEXT,
    "scope" TEXT,
    "vibe" TEXT,
    "helpNeeded" TEXT,
    "requiredRoles" JSONB NOT NULL DEFAULT '[]',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "userId" TEXT,
    "projectBriefId" TEXT,
    "contactId" TEXT,
    "twilioMessageSid" TEXT,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "roles" TEXT[],
    "tags" TEXT[],
    "portfolioUrl" TEXT,
    "instagramUrl" TEXT,
    "notes" TEXT,
    "smsOptedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "projectBriefId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFTED',
    "draftedMessage" TEXT NOT NULL,
    "sentMessage" TEXT,
    "lastResponse" TEXT,
    "adminApproved" BOOLEAN NOT NULL DEFAULT false,
    "consentToGroupChat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChat" (
    "id" TEXT NOT NULL,
    "projectBriefId" TEXT NOT NULL,
    "twilioConversationSid" TEXT,
    "status" "GroupChatStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatParticipant" (
    "id" TEXT NOT NULL,
    "groupChatId" TEXT NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectBriefId" TEXT NOT NULL,
    "groupChatId" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "ProjectBrief_userId_idx" ON "ProjectBrief"("userId");

-- CreateIndex
CREATE INDEX "ProjectBrief_status_idx" ON "ProjectBrief"("status");

-- CreateIndex
CREATE INDEX "ProjectBrief_createdAt_idx" ON "ProjectBrief"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_twilioMessageSid_key" ON "Message"("twilioMessageSid");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Message_projectBriefId_idx" ON "Message"("projectBriefId");

-- CreateIndex
CREATE INDEX "Message_contactId_idx" ON "Message"("contactId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_city_idx" ON "Contact"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Outreach_projectBriefId_contactId_key" ON "Outreach"("projectBriefId", "contactId");

-- CreateIndex
CREATE INDEX "Outreach_status_idx" ON "Outreach"("status");

-- CreateIndex
CREATE INDEX "Outreach_projectBriefId_idx" ON "Outreach"("projectBriefId");

-- CreateIndex
CREATE INDEX "Outreach_contactId_idx" ON "Outreach"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupChat_twilioConversationSid_key" ON "GroupChat"("twilioConversationSid");

-- CreateIndex
CREATE INDEX "GroupChat_projectBriefId_idx" ON "GroupChat"("projectBriefId");

-- CreateIndex
CREATE INDEX "GroupChat_status_idx" ON "GroupChat"("status");

-- CreateIndex
CREATE INDEX "GroupChatParticipant_groupChatId_idx" ON "GroupChatParticipant"("groupChatId");

-- CreateIndex
CREATE INDEX "GroupChatParticipant_userId_idx" ON "GroupChatParticipant"("userId");

-- CreateIndex
CREATE INDEX "GroupChatParticipant_contactId_idx" ON "GroupChatParticipant"("contactId");

-- CreateIndex
CREATE INDEX "Task_projectBriefId_idx" ON "Task"("projectBriefId");

-- CreateIndex
CREATE INDEX "Task_groupChatId_idx" ON "Task"("groupChatId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ProjectBrief" ADD CONSTRAINT "ProjectBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectBriefId_fkey" FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_projectBriefId_fkey" FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_projectBriefId_fkey" FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatParticipant" ADD CONSTRAINT "GroupChatParticipant_groupChatId_fkey" FOREIGN KEY ("groupChatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatParticipant" ADD CONSTRAINT "GroupChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatParticipant" ADD CONSTRAINT "GroupChatParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectBriefId_fkey" FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupChatId_fkey" FOREIGN KEY ("groupChatId") REFERENCES "GroupChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
