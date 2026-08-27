CREATE TABLE "learning_projects" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_projects_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "learning_project_members" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_project_members_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "learning_project_milestones" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "completed" BOOLEAN NOT NULL DEFAULT false, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_project_milestones_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "learning_project_milestone_updates" (
  "id" TEXT NOT NULL, "milestoneId" TEXT NOT NULL, "body" TEXT NOT NULL, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_project_milestone_updates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "learning_project_assets" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" TEXT NOT NULL, "label" TEXT NOT NULL, "url" TEXT, "fileUrl" TEXT, "fileName" TEXT, "mimeType" TEXT, "uploadedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_project_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "learning_project_members_projectId_memberId_key" ON "learning_project_members"("projectId", "memberId");
CREATE INDEX "learning_project_members_memberId_idx" ON "learning_project_members"("memberId");
CREATE INDEX "learning_project_milestones_projectId_createdAt_idx" ON "learning_project_milestones"("projectId", "createdAt");
CREATE INDEX "learning_project_milestone_updates_milestoneId_createdAt_idx" ON "learning_project_milestone_updates"("milestoneId", "createdAt");
CREATE INDEX "learning_project_assets_projectId_createdAt_idx" ON "learning_project_assets"("projectId", "createdAt");
CREATE INDEX "learning_projects_createdById_updatedAt_idx" ON "learning_projects"("createdById", "updatedAt");
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_members" ADD CONSTRAINT "learning_project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_members" ADD CONSTRAINT "learning_project_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_milestones" ADD CONSTRAINT "learning_project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_milestone_updates" ADD CONSTRAINT "learning_project_milestone_updates_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning_project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_assets" ADD CONSTRAINT "learning_project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
