import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateExecutiveSummary } from '../services/azureOpenAIService';

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/meeting-report?start=YYYY-MM-DD&end=YYYY-MM-DD
// Aggregates meeting data strictly from the aiMinutes JSON field without relational mapping
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const { start, end } = req.query as { start?: string; end?: string };

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const records = await prisma.meetingRecord.findMany({
      where: {
        projectId,
        meetingDate: { gte: startDate, lte: endDate }
      },
      orderBy: { meetingDate: 'asc' },
      select: { id: true, meetingTitle: true, meetingDate: true, aiMinutes: true }
    });

    if (records.length === 0) {
      return res.json({ meetings: [] });
    }

    // Strictly return the raw aiMinutes for the requested records
    // without merging relational updates, as requested.
    const mappedMeetings = records.map(r => ({
      id: r.id,
      meetingTitle: r.meetingTitle,
      meetingDate: r.meetingDate,
      aiMinutes: r.aiMinutes || null
    }));

    // Generate overarching summary
    let executiveSummary = '';
    const summaryTexts = mappedMeetings
      .filter(m => m.aiMinutes)
      .map(m => {
        const title = m.meetingTitle || 'Meeting';
        const purpose = (m.aiMinutes as any).purpose || '';
        const discussions = ((m.aiMinutes as any).discussion_points || []).join('; ');
        const pu = ((m.aiMinutes as any).progress_updates || []).map((p: any) => p.exact_value).join('; ');
        return `${title}:\nPurpose: ${purpose}\nDiscussions: ${discussions}\nUpdates: ${pu}`;
      })
      .filter(s => s.length > 0)
      .join('\n');

    if (summaryTexts) {
      try {
        executiveSummary = await generateExecutiveSummary(summaryTexts);
      } catch (err) {
        console.error('Failed to generate executive summary', err);
      }
    }

    res.json({ meetings: mappedMeetings, executiveSummary });
  } catch (error: any) {
    console.error('Error generating meeting report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
