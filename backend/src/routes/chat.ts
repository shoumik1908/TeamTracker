import prisma from '../lib/prisma';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { aiProvider, ChatMessage } from '../services/aiProvider';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// This endpoint reads the database and feeds it to a model, so it must never be
// anonymous. Everything below the gate is scoped to the caller.
router.use(authenticateToken);

// Build live context from database, scoped to what this caller may already
// fetch through the REST API:
//   - projects            -> projects.ts and dashboard.ts show a non-admin only
//                            the projects they are a member of
//   - certification data  -> dashboard.ts scopes assignments to the caller
//   - notifications       -> notifications.ts scopes to their own + admin ones
//   - roster and catalog  -> members.ts / certifications.ts expose these to any
//                            authenticated user, so they stay org-wide
// An admin (manageTeam) still gets the full organisation view, unchanged.
async function buildContext(user: AuthRequest['user']): Promise<string> {
  const isAdmin = !!user?.permissions?.manageTeam;
  const teamMemberId = user?.teamMemberId ?? null;

  // A non-admin with no linked roster entry has no data of their own; match
  // nothing rather than falling through to everything.
  const ownMember = { memberId: teamMemberId ?? '__no_team_member__' };
  const certWhere = isAdmin ? {} : ownMember;
  const projectWhere = isAdmin ? {} : { members: { some: ownMember } };

  // An admin keeps the organisation-wide activity feed. They already receive
  // every member, project and certification in this same context, so notification
  // text about those entities exposes no new class of data — and scoping it here
  // would silently empty a section that works today. A non-admin gets only their
  // own, matching notifications.ts.
  const notificationWhere = isAdmin
    ? {}
    : teamMemberId
      ? { memberId: teamMemberId }
      : { id: '__no_results__' };

  const [members, certifications, assignedCerts, projects, notifications] = await Promise.all([
    prisma.teamMember.findMany({
      include: {
        // Other people's completion detail is admin-only; the count matches
        // what GET /api/members already returns to everyone.
        _count: { select: { assignedCertifications: true } },
        ...(isAdmin
          ? { assignedCertifications: { include: { certification: true } } }
          : {}),
        projectMembers: {
          where: isAdmin
            ? {}
            : { project: { OR: [{ status: { not: 'COMPLETED' as const } }, { progress: { lt: 100 } }] } },
          include: { project: true },
        },
      },
    }),
    prisma.certification.findMany(),
    prisma.assignedCertification.findMany({
      where: certWhere,
      include: {
        member: true,
        certification: true,
      },
    }),
    prisma.project.findMany({
      where: projectWhere,
      include: {
        manager: true,
        members: { include: { member: true } },
      },
    }),
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { member: true },
    }),
  ]);

  const today = new Date();

  // Compute overdue
  const overdue = assignedCerts.filter(
    ac => ac.status !== 'COMPLETED' && new Date(ac.deadline) < today
  );

  // Compute upcoming (within 7 days)
  const upcoming = assignedCerts.filter(ac => {
    const dl = new Date(ac.deadline);
    const daysLeft = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return ac.status !== 'COMPLETED' && daysLeft >= 0 && daysLeft <= 7;
  });

  // Aggregate assignment status counts — avoids dumping every assignment (which blows past
  // the model's token-per-minute limit once there are hundreds of them)
  const statusCounts = assignedCerts.reduce((acc, ac) => {
    acc[ac.status] = (acc[ac.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusSummary = Object.entries(statusCounts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none';

  const activeProjects = projects.filter(p => p.status !== 'COMPLETED');
  const completedProjects = projects.filter(p => p.status === 'COMPLETED');

  // Cap the catalog list so a large catalog can't bloat the prompt
  const CATALOG_CAP = 60;
  const catalogList = certifications.slice(0, CATALOG_CAP).map(c => `• ${c.name} (${c.provider})`).join('\n')
    + (certifications.length > CATALOG_CAP ? `\n…and ${certifications.length - CATALOG_CAP} more` : '');

  const scopeLabel = isAdmin
    ? 'ORGANISATION-WIDE (you are talking to an administrator)'
    : 'THIS USER ONLY — certifications, deadlines, projects and activity below belong to the person asking';

  const context = `
=== TEAM TRACKER DASHBOARD — LIVE DATA ===

DATE: ${today.toDateString()}
SCOPE: ${scopeLabel}

--- SUMMARY ---
Members: ${members.length}
Certification catalog: ${certifications.length}
Certification assignments${isAdmin ? '' : ' (yours)'}: ${assignedCerts.length} (${statusSummary})
Overdue certifications${isAdmin ? '' : ' (yours)'}: ${overdue.length}
Projects${isAdmin ? '' : ' (yours)'}: ${projects.length} (${activeProjects.length} active, ${completedProjects.length} completed)

--- TEAM MEMBERS (${members.length}) ---
${members.map(m => {
    const projectNames = m.projectMembers.map(pm => pm.project?.name).filter(Boolean).join(', ') || 'None';
    if (!isAdmin) {
      // Matches GET /api/members: name, designation, active projects, cert count.
      return `• ${m.name} (${m.designation || '—'}) | Certs: ${m._count.assignedCertifications} assigned | Projects: ${projectNames}`;
    }
    const acs = m.assignedCertifications ?? [];
    const done = acs.filter(a => a.status === 'COMPLETED').length;
    return `• ${m.name} (${m.designation || '—'}) | Certs: ${acs.length} total, ${done} completed | Projects: ${projectNames}`;
  }).join('\n')}

--- CERTIFICATION CATALOG (${certifications.length}) ---
${catalogList}

--- OVERDUE CERTIFICATIONS${isAdmin ? '' : ' — YOURS'} (${overdue.length}) ---
${overdue.length === 0 ? 'None! Great job.' : overdue.map(ac => `• ${ac.member?.name} → ${ac.certification?.name} (Deadline was: ${new Date(ac.deadline).toDateString()}, Progress: ${ac.progress}%)`).join('\n')}

--- UPCOMING DEADLINES${isAdmin ? '' : ' — YOURS'} (within 7 days, ${upcoming.length}) ---
${upcoming.length === 0 ? 'None this week.' : upcoming.map(ac => {
    const daysLeft = Math.ceil((new Date(ac.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return `• ${ac.member?.name} → ${ac.certification?.name} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
  }).join('\n')}

--- PROJECTS${isAdmin ? '' : ' — YOURS'} (${projects.length} total) ---
${projects.map(p => `• ${p.name} | Status: ${p.status} | Progress: ${p.progress}% | Priority: ${p.priority} | Team: ${p.members.map(pm => pm.member.name).join(', ') || 'None'}${p.endDate ? ` | Ends ${new Date(p.endDate).toDateString()}` : ''}`).join('\n')}

--- RECENT ACTIVITY${isAdmin ? '' : ' — YOURS'} (last 10 events) ---
${notifications.map(n => `• ${n.title}: ${n.message}`).join('\n')}

===========================================

NOTE: This context is already filtered to what the person asking is allowed to
see. If they ask about someone else's certifications, deadlines, or a project
they are not on, say you can only report on their own and suggest they ask an
administrator — do not guess, extrapolate, or imply the data exists.

NOTE: The full list of every individual certification assignment is not included to keep responses fast. You have per-member totals, all overdue items, and all upcoming deadlines. If asked for a specific member's detailed certifications, answer from their summary and suggest opening that member's profile page for the full breakdown.
  `;

  return context;
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const user = (req as AuthRequest).user;
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured. Please add GROQ_API_KEY to .env' });
    }

    // Build live database context
    const context = await buildContext(user);

    // System prompt
    const systemPrompt = `You are an intelligent AI assistant embedded inside the Team Tracker Dashboard — an enterprise tool for tracking team members, certifications, and projects.

You have access to LIVE, real-time data from the company's database (provided below). Use this data to answer questions accurately and helpfully.

GUIDELINES:
- Be concise and friendly. Use bullet points and formatting when helpful.
- Always base your answers on the live data provided — never make up information.
- If asked to do something (like add/edit data), politely explain that you can only read data currently and suggest they use the relevant page (e.g., "You can add this on the Team Members page").
- When referencing people, use their actual names from the data.
- Use emojis sparingly to make responses friendlier (✅ ⚠️ 🎉 etc.)
- If the data is empty (no members, no projects, etc.), acknowledge that and guide the user to add data.

${context}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as any,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await aiProvider.chat(messages, {
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      maxTokens: 1024
    });

    res.json({ reply: response.content });
  } catch (error: any) {
    console.error('Chat error:', error);

    // Handle specific error types
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit reached. Please wait a few seconds and try again.',
      });
    }
    if (error.status === 401 || error.status === 403) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your GROQ_API_KEY in .env',
      });
    }
    if (error.status === 404) {
      return res.status(404).json({
        error: 'AI model not available. Please contact support.',
      });
    }

    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.message || error,
    });
  }
});

export default router;
