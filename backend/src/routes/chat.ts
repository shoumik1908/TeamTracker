import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Build live context from database
async function buildContext(): Promise<string> {
  const [members, certifications, assignedCerts, projects, notifications] = await Promise.all([
    prisma.teamMember.findMany({
      include: {
        assignedCertifications: {
          include: { certification: true },
        },
        projectMembers: {
          include: { project: true },
        },
      },
    }),
    prisma.certification.findMany(),
    prisma.assignedCertification.findMany({
      include: {
        member: true,
        certification: true,
      },
    }),
    prisma.project.findMany({
      include: {
        manager: true,
        members: { include: { member: true } },
      },
    }),
    prisma.notification.findMany({
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

  const context = `
=== TEAM TRACKER DASHBOARD — LIVE DATA ===

DATE: ${today.toDateString()}

--- TEAM MEMBERS (${members.length} total) ---
${members.map(m => `
• ${m.name} | ${m.designation}
  Skills: ${m.skills.join(', ') || 'None listed'}
  Certifications: ${m.assignedCertifications.length} assigned
  Projects: ${m.projectMembers.map(pm => pm.project.name).join(', ') || 'None'}
`).join('')}

--- CERTIFICATION CATALOG (${certifications.length} total) ---
${certifications.map(c => `• ${c.name} | Provider: ${c.provider}`).join('\n')}

--- CERTIFICATION ASSIGNMENTS (${assignedCerts.length} total) ---
${assignedCerts.map(ac => `• ${ac.member?.name} → ${ac.certification?.name} | Status: ${ac.status} | Progress: ${ac.progress}% | Deadline: ${new Date(ac.deadline).toDateString()} | Priority: ${ac.priority}`).join('\n')}

--- OVERDUE CERTIFICATIONS (${overdue.length}) ---
${overdue.length === 0 ? 'None! Great job.' : overdue.map(ac => `• ${ac.member?.name} → ${ac.certification?.name} (Deadline was: ${new Date(ac.deadline).toDateString()}, Progress: ${ac.progress}%)`).join('\n')}

--- UPCOMING DEADLINES (within 7 days, ${upcoming.length}) ---
${upcoming.length === 0 ? 'None this week.' : upcoming.map(ac => {
    const daysLeft = Math.ceil((new Date(ac.deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return `• ${ac.member?.name} → ${ac.certification?.name} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
  }).join('\n')}

--- PROJECTS (${projects.length} total) ---
${projects.map(p => `• ${p.name} | Status: ${p.status} | Progress: ${p.progress}% | Priority: ${p.priority}
  Manager: ${p.manager?.name || 'None'}
  Team: ${p.members.map(pm => pm.member.name).join(', ') || 'No members assigned'}
  ${p.endDate ? `End date: ${new Date(p.endDate).toDateString()}` : 'No end date set'}`).join('\n')}

--- RECENT ACTIVITY (last 10 events) ---
${notifications.map(n => `• ${n.title}: ${n.message}`).join('\n')}

===========================================
  `;

  return context;
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured. Please add GROQ_API_KEY to .env' });
    }

    // Build live database context
    const context = await buildContext();

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

    // Helper: call Groq with one automatic retry on 429 / rate limits
    const callGroq = async (retryCount = 0): Promise<string> => {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              ...history.map((msg: { role: string; content: string }) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
              })),
              { role: 'user', content: message }
            ],
            temperature: 0.2,
            max_tokens: 1024
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const status = response.status;
          throw { status, message: errBody.error?.message || 'Groq API error' };
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        if (err.status === 429 && retryCount === 0) {
          // Wait 6 seconds then retry once
          await new Promise(resolve => setTimeout(resolve, 6000));
          return callGroq(1);
        }
        throw err;
      }
    };

    const response = await callGroq();
    res.json({ reply: response });
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
