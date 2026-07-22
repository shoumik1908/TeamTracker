import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateMeetingSummary } from '../services/aiSummaryService';

const router = Router();

// GET /api/projects/:projectId/meetings - Fetch meetings from DB
router.get('/projects/:projectId/meetings', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const meetings = await prisma.teamsMeeting.findMany({
    where: { projectId },
    orderBy: { startTime: 'desc' },
  });
  res.json(meetings);
});

// POST /api/projects/:projectId/sync-meetings - Fetch new meetings (MOCK)
router.post('/projects/:projectId/sync-meetings', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { manager: true }
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Insert mock data for demonstration
  const mockMeetings = [
    {
      id: `mock-1-${Date.now()}`,
      projectId,
      teamsMeetingId: `ms-meeting-${Date.now()}`,
      subject: `Live Sync Demo - ${project.name}`,
      organizer: project.manager?.name || 'Project Manager',
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
      recordingUrl: 'https://sharepoint.com/mock-recording',
      transcriptText: "Mock transcript: We discussed the progress on the sprint and agreed to push the deployment to next week. Action item: Bob to update the documentation.",
    }
  ];

  for (const m of mockMeetings) {
    await prisma.teamsMeeting.create({ data: m });
  }

  res.json({ message: 'Meetings synced successfully', count: mockMeetings.length });
});

// POST /api/meetings/:meetingId/summary - Generate AI summary
router.post('/meetings/:meetingId/summary', async (req: Request, res: Response) => {
  const { meetingId } = req.params;

  const meeting = await prisma.teamsMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  if (meeting.aiSummary) {
    return res.json({ summary: meeting.aiSummary }); // return cached
  }

  if (!meeting.transcriptText) {
    return res.status(400).json({ error: 'No transcript available for this meeting' });
  }

  try {
    const summary = await generateMeetingSummary(meeting.transcriptText);

    // Cache the summary
    await prisma.teamsMeeting.update({
      where: { id: meetingId },
      data: { aiSummary: summary }
    });

    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});
export default router;
