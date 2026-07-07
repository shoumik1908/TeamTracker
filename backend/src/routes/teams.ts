import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateMeetingSummary } from '../services/aiSummaryService';

const router = Router();
const prisma = new PrismaClient();

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

// POST /api/webhooks/power-automate - Secure Webhook for Power Automate
router.post('/webhooks/power-automate', async (req: Request, res: Response) => {
  const incomingSecret = req.headers['x-webhook-secret'];
  const configuredSecret = process.env.POWER_AUTOMATE_SECRET;

  if (!configuredSecret || incomingSecret !== configuredSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-webhook-secret header.' });
  }

  const { projectId, teamsMeetingId, subject, organizer, startTime, endTime, recordingUrl, transcriptText } = req.body;

  if (!projectId || !teamsMeetingId) {
    return res.status(400).json({ error: 'Missing required fields: projectId and teamsMeetingId are required.' });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const exists = await prisma.teamsMeeting.findFirst({ where: { teamsMeetingId } });
    if (exists) {
      return res.status(409).json({ error: 'Meeting already exists' });
    }

    const newMeeting = await prisma.teamsMeeting.create({
      data: {
        projectId,
        teamsMeetingId,
        subject: subject || 'Untitled Meeting',
        organizer: organizer || 'Unknown',
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : new Date(Date.now() + 3600000),
        recordingUrl: recordingUrl || null,
        transcriptText: transcriptText || null,
      }
    });

    res.status(201).json({ message: 'Meeting saved successfully via secure webhook', meeting: newMeeting });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process webhook' });
  }
});

export default router;
