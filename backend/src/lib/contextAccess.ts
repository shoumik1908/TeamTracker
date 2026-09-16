import prisma from './prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Access rule for anything that hangs off a project or a pre-sales opportunity.
 *
 * Lifted verbatim from documentation.ts, which was the only router enforcing it,
 * so meeting records and Teams meetings apply the same rule rather than a second
 * slightly-different copy of it.
 */
export async function verifyContextMember(projectId?: string, opportunityId?: string, user?: any) {
  if (!user) {
    throw new AppError('User context is required to perform this action.', 401);
  }

  if (user.permissions?.manageTeam) {
    return; // Admin always has access
  }

  const memberId = user.teamMemberId;
  if (!memberId) {
    throw new AppError('Access denied. No team member profile associated.', 403);
  }

  if (projectId) {
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId, memberId },
    });
    if (isMember) return;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.managerId === memberId) return;
  } else if (opportunityId) {
    const isMember = await prisma.projectMember.findFirst({
      where: { opportunityId, memberId },
    });
    if (isMember) return;
  }

  throw new AppError('Access denied. Only team members assigned to this context can view its documentation.', 403);
}

/** A meeting record inherits the access rule of the project/opportunity it belongs to. */
export async function verifyMeetingRecordAccess(recordId: string, user?: any) {
  const record = await prisma.meetingRecord.findUnique({
    where: { id: recordId },
    select: { projectId: true, opportunityId: true },
  });
  if (!record) throw new AppError('Meeting record not found', 404);
  await verifyContextMember(record.projectId ?? undefined, record.opportunityId ?? undefined, user);
  return record;
}

/** An action item inherits the access rule of its meeting record. */
export async function verifyActionItemAccess(itemId: string, user?: any) {
  const item = await prisma.meetingActionItem.findUnique({
    where: { id: itemId },
    select: { meetingRecord: { select: { projectId: true, opportunityId: true } } },
  });
  if (!item) throw new AppError('Action item not found', 404);
  await verifyContextMember(
    item.meetingRecord.projectId ?? undefined,
    item.meetingRecord.opportunityId ?? undefined,
    user,
  );
}

/** A Teams meeting inherits the access rule of its project. */
export async function verifyTeamsMeetingAccess(meetingId: string, user?: any) {
  const meeting = await prisma.teamsMeeting.findUnique({
    where: { id: meetingId },
    select: { projectId: true },
  });
  if (!meeting) throw new AppError('Meeting not found', 404);
  await verifyContextMember(meeting.projectId ?? undefined, undefined, user);
  return meeting;
}
