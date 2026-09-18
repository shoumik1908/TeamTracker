import prisma from '../lib/prisma';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateExecutiveSummary } from '../services/azureOpenAIService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { verifyContextMember } from '../lib/contextAccess';
import { AppError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// TT-045: this router was mounted in index.ts with no authenticateToken and no
// membership check. Anyone who could guess or scrape a project id could read every AI
// meeting minute for that project — and force an LLM executive-summary generation on
// each request, with no session and no rate limit in front of it.
router.use(authenticateToken);

// GET /api/projects/:projectId/meeting-report?start=YYYY-MM-DD&end=YYYY-MM-DD
// Aggregates meeting data strictly from the aiMinutes JSON field without relational mapping
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const { start, end } = req.query as { start?: string; end?: string };

    // Belonging to the project is what grants access to its minutes; admins pass too.
    await verifyContextMember(projectId, undefined, (req as AuthRequest).user);

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    // Also TT-045: an unparseable date produced an Invalid Date, which Prisma rejected
    // and the catch below reported as a 500 — a caller error dressed up as a server one.
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('start and end must be valid dates (YYYY-MM-DD).', 400);
    }
    if (startDate > endDate) {
      throw new AppError('start must not be after end.', 400);
    }
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
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error generating meeting report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
