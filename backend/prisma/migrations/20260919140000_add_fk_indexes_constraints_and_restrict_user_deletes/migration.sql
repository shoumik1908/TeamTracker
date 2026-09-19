-- DropForeignKey
ALTER TABLE "coe_knowledge_sessions" DROP CONSTRAINT "coe_knowledge_sessions_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "coe_learning_resources" DROP CONSTRAINT "coe_learning_resources_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "coe_session_meeting_notes" DROP CONSTRAINT "coe_session_meeting_notes_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "coe_tickets" DROP CONSTRAINT "coe_tickets_createdById_fkey";

-- DropForeignKey
ALTER TABLE "learning_project_assets" DROP CONSTRAINT "learning_project_assets_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "learning_project_milestone_updates" DROP CONSTRAINT "learning_project_milestone_updates_createdById_fkey";

-- DropForeignKey
ALTER TABLE "learning_projects" DROP CONSTRAINT "learning_projects_createdById_fkey";

-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "assigned_certifications_certificationId_idx" ON "assigned_certifications"("certificationId");

-- CreateIndex
CREATE INDEX "blockers_risks_firstRaisedMeetingId_idx" ON "blockers_risks"("firstRaisedMeetingId");

-- CreateIndex
CREATE INDEX "blockers_risks_projectId_idx" ON "blockers_risks"("projectId");

-- CreateIndex
CREATE INDEX "blockers_risks_resolvedInMeetingId_idx" ON "blockers_risks"("resolvedInMeetingId");

-- CreateIndex
CREATE INDEX "certificate_edit_requests_assignmentId_idx" ON "certificate_edit_requests"("assignmentId");

-- CreateIndex
CREATE INDEX "coe_knowledge_sessions_organizerId_idx" ON "coe_knowledge_sessions"("organizerId");

-- CreateIndex
CREATE INDEX "coe_learning_resources_uploadedById_idx" ON "coe_learning_resources"("uploadedById");

-- CreateIndex
CREATE INDEX "coe_session_meeting_notes_uploadedById_idx" ON "coe_session_meeting_notes"("uploadedById");

-- CreateIndex
CREATE INDEX "coe_tickets_createdById_idx" ON "coe_tickets"("createdById");

-- CreateIndex
CREATE INDEX "gtm_campaigns_launch_id_idx" ON "gtm_campaigns"("launch_id");

-- CreateIndex
CREATE INDEX "gtm_campaigns_partner_id_idx" ON "gtm_campaigns"("partner_id");

-- CreateIndex
CREATE INDEX "gtm_collaterals_launch_id_idx" ON "gtm_collaterals"("launch_id");

-- CreateIndex
CREATE INDEX "gtm_collaterals_partner_id_idx" ON "gtm_collaterals"("partner_id");

-- CreateIndex
CREATE INDEX "gtm_partner_requirements_partner_id_idx" ON "gtm_partner_requirements"("partner_id");

-- CreateIndex
CREATE INDEX "key_decisions_decidedById_idx" ON "key_decisions"("decidedById");

-- CreateIndex
CREATE INDEX "key_decisions_meetingRecordId_idx" ON "key_decisions"("meetingRecordId");

-- CreateIndex
CREATE INDEX "learning_project_assets_uploadedById_idx" ON "learning_project_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "learning_project_milestone_updates_createdById_idx" ON "learning_project_milestone_updates"("createdById");

-- CreateIndex
CREATE INDEX "meeting_action_items_assignedToId_idx" ON "meeting_action_items"("assignedToId");

-- CreateIndex
CREATE INDEX "meeting_action_items_meetingRecordId_idx" ON "meeting_action_items"("meetingRecordId");

-- CreateIndex
CREATE INDEX "meeting_attendees_meetingRecordId_idx" ON "meeting_attendees"("meetingRecordId");

-- CreateIndex
CREATE INDEX "meeting_attendees_memberId_idx" ON "meeting_attendees"("memberId");

-- CreateIndex
CREATE INDEX "project_files_opportunityId_idx" ON "project_files"("opportunityId");

-- CreateIndex
CREATE INDEX "project_files_projectId_idx" ON "project_files"("projectId");

-- CreateIndex
CREATE INDEX "project_links_opportunityId_idx" ON "project_links"("opportunityId");

-- CreateIndex
CREATE INDEX "project_links_projectId_idx" ON "project_links"("projectId");

-- CreateIndex
CREATE INDEX "project_members_memberId_idx" ON "project_members"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_opportunityId_memberId_key" ON "project_members"("opportunityId", "memberId");

-- CreateIndex
CREATE INDEX "project_notes_opportunityId_idx" ON "project_notes"("opportunityId");

-- CreateIndex
CREATE INDEX "project_notes_projectId_idx" ON "project_notes"("projectId");

-- CreateIndex
CREATE INDEX "project_updates_memberId_idx" ON "project_updates"("memberId");

-- CreateIndex
CREATE INDEX "project_updates_opportunityId_idx" ON "project_updates"("opportunityId");

-- CreateIndex
CREATE INDEX "project_updates_projectId_idx" ON "project_updates"("projectId");

-- CreateIndex
CREATE INDEX "projects_managerId_idx" ON "projects"("managerId");

-- CreateIndex
CREATE INDEX "stage_change_logs_opportunityId_createdAt_idx" ON "stage_change_logs"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "task_assignments_memberId_idx" ON "task_assignments"("memberId");

-- CreateIndex
CREATE INDEX "task_feedbacks_assigneeId_idx" ON "task_feedbacks"("assigneeId");

-- CreateIndex
CREATE INDEX "tasks_assignedById_idx" ON "tasks"("assignedById");

-- CreateIndex
CREATE INDEX "tasks_onBehalfOfId_idx" ON "tasks"("onBehalfOfId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "team_members_managerId_idx" ON "team_members"("managerId");

-- CreateIndex
CREATE INDEX "teams_meetings_projectId_idx" ON "teams_meetings"("projectId");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- AddForeignKey
ALTER TABLE "stage_change_logs" ADD CONSTRAINT "stage_change_logs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_milestone_updates" ADD CONSTRAINT "learning_project_milestone_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_assets" ADD CONSTRAINT "learning_project_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_learning_resources" ADD CONSTRAINT "coe_learning_resources_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_tickets" ADD CONSTRAINT "coe_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_knowledge_sessions" ADD CONSTRAINT "coe_knowledge_sessions_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_session_meeting_notes" ADD CONSTRAINT "coe_session_meeting_notes_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

