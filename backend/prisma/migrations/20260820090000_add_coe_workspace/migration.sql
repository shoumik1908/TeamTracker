-- CreateEnum
CREATE TYPE "CoeTrack" AS ENUM ('DATABRICKS', 'FABRIC', 'FDE');

-- CreateEnum
CREATE TYPE "CoeTicketStatus" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "CoeTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "coe_learning_resources" (
    "id" TEXT NOT NULL,
    "track" "CoeTrack" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileMimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "track" "CoeTrack" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CoeTicketStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "CoeTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdById" TEXT NOT NULL,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coe_learning_resources_track_createdAt_idx" ON "coe_learning_resources"("track", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "coe_tickets_ticketNumber_key" ON "coe_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "coe_tickets_track_status_idx" ON "coe_tickets"("track", "status");

-- CreateIndex
CREATE INDEX "coe_tickets_memberId_idx" ON "coe_tickets"("memberId");

-- AddForeignKey
ALTER TABLE "coe_learning_resources" ADD CONSTRAINT "coe_learning_resources_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_tickets" ADD CONSTRAINT "coe_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_tickets" ADD CONSTRAINT "coe_tickets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
