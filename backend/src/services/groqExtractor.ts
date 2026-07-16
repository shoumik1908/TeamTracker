/**
 * groqExtractor.ts
 * Calls the Groq API (llama-3.3-70b-versatile) to extract structured
 * skill/experience data from plain CV text.
 */
import { aiProvider } from './aiProvider';

/**
 * Attempts to repair a truncated JSON string by closing any open
 * arrays/objects. Useful when the model hits max_tokens mid-response.
 */
function repairTruncatedJson(raw: string): string {
  let s = raw.trimEnd();
  // Remove trailing comma before we try to close
  s = s.replace(/,\s*$/, '');
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  // Close any unclosed structures in reverse order
  return s + stack.reverse().join('');
}



export interface GroqCvExtraction {
  skills: string[];
  years_of_experience: number | null;
  primary_role: string | null;
  summary: string;
  certifications_mentioned: string[];
  ats_score: {
    total: number;
    breakdown: {
      contact_information: number; // /10
      ats_formatting: number; // /15
      skills_match: number; // /25
      work_experience: number; // /20
      education: number; // /10
      projects: number; // /10
      certifications: number; // /5
      keywords: number; // /5
    };
  };
  feedback: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

async function callGroq(cvText: string, jobDescription?: string, retries = 1): Promise<GroqCvExtraction> {
  // Credentials validated by aiProvider

  const prompt = `You are an expert ATS (Applicant Tracking System) parser. Extract skills, experience, and evaluate the CV/resume text using a STRICT 100-point scoring rubric.
If a Job Description is provided below, evaluate the Skills Match and relevance against it. Otherwise, evaluate against general industry standards.

CONSERVATIVE SCORING PHILOSOPHY:
Scores must be realistic and conservative. An average resume should NOT score above 80.
A section should NOT receive full marks simply because it exists. Full marks should ONLY be awarded when the content is complete, high quality, and relevant.

90-100: Exceptional (rare, quantified achievements throughout, strong keywords, perfect formatting).
80-89: Strong (well-written, minor improvements needed).
70-79: Good (solid but missing some measurable impact or relevant skills).
60-69: Average (meets basic expectations but has weak descriptions or missing keywords).
<60: Needs Improvement (missing critical info, poor formatting, weak match).

QUALITY-BASED RULES:
- Work Experience (/20): Do NOT give high scores for generic statements. Reward quantified achievements (e.g., %, $, time saved, team size). Penalize weak action verbs and passive language.
- Projects (/10): Low score if it just lists title/tech. High score requires measurable business impact and clear tech stack.
- Skills (/25): Evaluate diversity, relevance, modern tech, and alignment to JD (if provided).
- ATS Formatting (/15): Deduct heavily for weird symbols, tables, or lack of clear headings.
- Keywords (/5): Reward strong action verbs (Built, Designed, Optimized) and industry keywords. Penalize repetition.

Return ONLY valid JSON, no markdown, no preamble, no explanation:

{
  "skills": ["skill1", "skill2"],
  "years_of_experience": number or null,
  "primary_role": string or null,
  "summary": "2-3 sentence summary of their background",
  "certifications_mentioned": ["cert1", "cert2"],
  "ats_score": {
    "total": number, // Sum of the breakdown below (max 100)
    "breakdown": {
      "contact_information": number, // /10
      "ats_formatting": number, // /15
      "skills_match": number, // /25
      "work_experience": number, // /20
      "education": number, // /10
      "projects": number, // /10
      "certifications": number, // /5
      "keywords": number // /5
    }
  },
  "feedback": {
    "strengths": ["1-3 bullet points highlighting what the candidate did well"],
    "weaknesses": ["1-3 bullet points identifying missing content, weak wording, or gaps"],
    "recommendations": ["1-3 prioritized, actionable improvements with expected impact"]
  }
}

Rules:
- Normalize skill names to standard casing (e.g. "react" -> "React")
- Don't invent skills not supported by the text
- If years_of_experience isn't explicitly stated, estimate from earliest work date to now
- Be extremely strict. A score of 90+ should be rare and reserved for truly exceptional resumes.

JOB DESCRIPTION (Optional):
${jobDescription ? jobDescription : "None provided. Evaluate based on general industry standards."}

CV TEXT:
${cvText.substring(0, 12000)}`; // Groq free tier has token limits, cap at ~12k chars

  const response = await aiProvider.chat(
    [{ role: 'user', content: prompt }],
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      jsonMode: true
    }
  );

  const rawText: string = response.content;

  try {
    const parsed = JSON.parse(rawText) as GroqCvExtraction;

    // Normalise: ensure arrays are arrays and strings are strings
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      years_of_experience: typeof parsed.years_of_experience === 'number' ? parsed.years_of_experience : null,
      primary_role: typeof parsed.primary_role === 'string' ? parsed.primary_role : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      certifications_mentioned: Array.isArray(parsed.certifications_mentioned) ? parsed.certifications_mentioned : [],
      ats_score: {
        total: typeof parsed.ats_score?.total === 'number' ? parsed.ats_score.total : 50,
        breakdown: {
          contact_information: typeof parsed.ats_score?.breakdown?.contact_information === 'number' ? parsed.ats_score.breakdown.contact_information : 5,
          ats_formatting: typeof parsed.ats_score?.breakdown?.ats_formatting === 'number' ? parsed.ats_score.breakdown.ats_formatting : 7,
          skills_match: typeof parsed.ats_score?.breakdown?.skills_match === 'number' ? parsed.ats_score.breakdown.skills_match : 12,
          work_experience: typeof parsed.ats_score?.breakdown?.work_experience === 'number' ? parsed.ats_score.breakdown.work_experience : 10,
          education: typeof parsed.ats_score?.breakdown?.education === 'number' ? parsed.ats_score.breakdown.education : 5,
          projects: typeof parsed.ats_score?.breakdown?.projects === 'number' ? parsed.ats_score.breakdown.projects : 5,
          certifications: typeof parsed.ats_score?.breakdown?.certifications === 'number' ? parsed.ats_score.breakdown.certifications : 2,
          keywords: typeof parsed.ats_score?.breakdown?.keywords === 'number' ? parsed.ats_score.breakdown.keywords : 2,
        }
      },
      feedback: {
        strengths: Array.isArray(parsed.feedback?.strengths) ? parsed.feedback.strengths : [],
        weaknesses: Array.isArray(parsed.feedback?.weaknesses) ? parsed.feedback.weaknesses : [],
        recommendations: Array.isArray(parsed.feedback?.recommendations) ? parsed.feedback.recommendations : []
      }
    };
  } catch {
    throw new Error('Groq returned invalid JSON. Please try again.');
  }
}

export async function extractCvWithGroq(cvText: string, jobDescription?: string): Promise<GroqCvExtraction> {
  return callGroq(cvText, jobDescription, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// PreSales document analysis — track detection + INCREMENTAL progress
// ─────────────────────────────────────────────────────────────────────────────

export interface PresalesAnalysis {
  detected_track: 'PNB' | 'TNM' | 'unclear';
  suggested_increment_percent: number;        // how much progress this doc indicates (3-30%)
  current_stage_still_applies: boolean;       // true = still in same stage, false = crossed into next
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

async function callGroqPresales(
  docText: string,
  pnbCurrentStage: string | null,
  pnbCurrentPercent: number,
  tnmCurrentStage: string | null,
  tnmCurrentPercent: number,
  retries = 1
): Promise<PresalesAnalysis> {
  // Credentials validated by aiProvider

  const pnbStages = [
    'Opportunity & Qualification',
    'Requirement Analysis',
    'Solution & Estimation',
    'Proposal & Pricing',
    'Client Engagement',
    'Project Award & Handover',
  ];

  const tnmStages = [
    'Requirement & Resource Planning',
    'Rate Card & Proposal',
    'Client Approval & Onboarding',
    'Execution & Tracking',
    'Change Management',
    'Billing & Project Closure',
  ];

  const prompt = `You are a presales analyst assessing incremental progress on a commercial opportunity.

PNB (Proposal & Bid) track — project-based, fixed-price, formal bid/tender/proposal, estimation, pricing for deliverables.
PNB stages: ${pnbStages.map((s, i) => `${i + 1}. ${s}`).join(' | ')}
Current PNB stage: ${pnbCurrentStage ?? 'Not started'} (overall progress: ${pnbCurrentPercent}%)

TNM (Time & Material) track — staffing/resource-based, rate cards, time billing, contractor onboarding, ongoing T&M contracts.
TNM stages: ${tnmStages.map((s, i) => `${i + 1}. ${s}`).join(' | ')}
Current TNM stage: ${tnmCurrentStage ?? 'Not started'} (overall progress: ${tnmCurrentPercent}%)

Language cues:
- PNB: "proposal", "bid", "tender", "RFP", "RFQ", "estimation", "fixed price", "project award", "handover", "solution design"
- TNM: "rate card", "time and material", "T&M", "billing", "resource planning", "staffing", "onboarding", "change management", "execution tracking"

IMPORTANT CALIBRATION RULES — read carefully:
1. Assess how much concrete progress this document describes, and choose an increment that reflects that scale specifically:
   - A single minor update or status check-in with no completed milestone: small increment (roughly 3-8%)
   - One clear completed milestone (e.g. one approval, one submission): moderate increment (roughly 10-25%)
   - Multiple completed milestones described together, or a milestone that represents crossing most of a stage's requirements at once: larger increment (roughly 25-50%)
   - No clear progress signal at all: return null and confidence 'low', do not force a number
2. These ranges are reasoning guides, not fixed targets — choose the specific number based on what the document actually describes, not by picking the nearest round number from these bands.
3. NEVER suggest a negative increment.
4. current_stage_still_applies = true means the document shows progress WITHIN the current stage. Set it to false only if the document clearly indicates the opportunity has crossed into the next stage boundary.

Return ONLY valid JSON, no markdown, no explanation outside JSON:
{
  "detected_track": "PNB" | "TNM" | "unclear",
  "suggested_increment_percent": <integer or null>,
  "current_stage_still_applies": true | false,
  "confidence": "high" | "medium" | "low",
  "reasoning": "1-2 sentence explanation of track detection and why this increment was chosen"
}

Set detected_track to "unclear" and suggested_increment_percent to null if you cannot identify the track.

DOCUMENT TEXT:
${docText.substring(0, 200000)}`;

  const response = await aiProvider.chat(
    [{ role: 'user', content: prompt }],
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      jsonMode: true
    }
  );

  const rawText: string = response.content;
  console.log('[Groq Presales Raw Response]', rawText);

  try {
    const parsed = JSON.parse(rawText) as any;
    const increment = typeof parsed.suggested_increment_percent === 'number'
      ? Math.min(100, Math.max(0, Math.round(parsed.suggested_increment_percent)))
      : 0;
    return {
      detected_track: ['PNB', 'TNM', 'unclear'].includes(parsed.detected_track)
        ? parsed.detected_track
        : 'unclear',
      suggested_increment_percent: increment,
      current_stage_still_applies: Boolean(parsed.current_stage_still_applies),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    throw new Error('Groq returned invalid JSON for presales analysis. Please try again.');
  }
}

export async function analyzePresalesDocWithGroq(
  docText: string,
  pnbCurrentStage: string | null,
  pnbCurrentPercent: number,
  tnmCurrentStage: string | null,
  tnmCurrentPercent: number
): Promise<PresalesAnalysis> {
  return callGroqPresales(docText, pnbCurrentStage, pnbCurrentPercent, tnmCurrentStage, tnmCurrentPercent, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Meeting Minutes Generation
// ─────────────────────────────────────────────────────────────────────────────



