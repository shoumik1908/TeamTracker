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

export type AllowedMemberName = 'Naved Hashmi' | 'Mayank Tiwari' | 'Deepankar Panchal' | 'Saqib' | 'Unassigned';

export interface GroqMeetingMinutes {
  // New MoM structured template format
  meeting_title?: string;
  meeting_date?: string;
  duration_estimate?: string | null;
  led_by?: string | null;
  facilitated_by?: string | null;
  attendees_present?: AllowedMemberName[];
  attendees_referenced_not_present?: AllowedMemberName[];
  purpose?: string;
  discussion_points?: string[];
  decisions?: { decision: string; owner: AllowedMemberName | null; rationale: string }[];
  action_items?: { task: string; owner: AllowedMemberName | null; status: 'Open' | 'Completed'; due_date: string | null }[];
  open_risks_blockers?: string[];
  next_steps?: string;

  // Legacy fields kept for backward compatibility and internal tracking continuity
  quick_summary?: string;
  meeting_summary?: string;
  attendees_mentioned?: string[];
  agenda_topics?: string[];
  blockers_or_risks?: { description: string; status: 'open' | 'resolved' }[];
  resolved_previous_blocker_ids?: string[];
  updated_previous_action_items?: { id: string; new_status: 'open' | 'completed' }[];
  open_questions?: string[];
}

export async function generateMeetingMinutes(
  transcriptText: string,
  previousOpenActionItems: { id: string; task: string; owner: string | null }[] = [],
  previousOpenBlockers: { id: string; description: string }[] = [],
  retries = 1
): Promise<GroqMeetingMinutes | null> {
  // Credentials validated by aiProvider

  const priorActionItemsText = previousOpenActionItems.length > 0 
    ? previousOpenActionItems.map(a => `[ID: ${a.id}] Task: ${a.task} (Owner: ${a.owner || 'Unassigned'})`).join('\n')
    : 'None';

  const priorBlockersText = previousOpenBlockers.length > 0
    ? previousOpenBlockers.map(b => `[ID: ${b.id}] Description: ${b.description}`).join('\n')
    : 'None';

  const prompt = `You are an expert Project Manager. Analyze the following meeting transcript and generate a highly structured project record in the exact Minutes of Meeting (MoM) format below.
Your output will directly serve as the official project tracker. 

SPEECH-TO-TEXT CORRECTION MAP (Known ASR glitches to resolve):
- "Deepika" -> "Thik hai" (Hindi for "Alright" / "Okay"). Do NOT treat as a person, delete entirely or replace with filler meaning.
- "Jason" -> "JSON" (data format).
- "Kaur" -> "Aur" (Hindi for "and").
- "Victor" -> "TikTok".
- "Eddie" -> "ID".
- "Ruby" -> "Jo bhi" (Hindi for "whatever").

PREVIOUS CONTEXT (From prior meetings on this project):
Open Action Items:
${priorActionItemsText}

Open Blockers/Risks:
${priorBlockersText}

INSTRUCTIONS:
1. Distinguish attendees who spoke/were present in the transcript (save to 'attendees_present') from names only referenced/mentioned in passing (save to 'attendees_referenced_not_present'). E.g., "Naved said Saqib needs to provide X" — Saqib is referenced, not present, unless the transcript confirms Saqib was actually in the meeting.
2. For decisions and action_items, include EVERY instance found in the transcript — no cap on count, same "no artificial limit" principle.
3. DECISIONS vs ACTION ITEMS:
   - DECISION: A decision represents an alignment, consensus, rule, architecture choice, or policy selection established during the meeting (answering "What was decided/agreed upon?" and "Why?"). Rationale/context must be a brief 1-sentence statement. Do not put deadline task assignments inside the decision text.
   - ACTION ITEM: An action item is a critical, high-impact task assigned to a specific owner to be completed after the meeting (answering "Who needs to do what, and by when?"). Extract ONLY critical, key action items (maximum 5 major tasks per meeting). Do NOT extract minor, trivial tasks, standard updates, or administrative follow-ups. Set status to "Open" or "Completed".
4. discussion_points should be concise bullet-style statements, not full paragraphs.
5. If a field cannot be determined from the transcript (e.g. duration_estimate, led_by, facilitated_by), return null rather than guessing or inventing a plausible-sounding value.
6. Maintain the existing "no invented content" constraint — every claim must be traceable to the transcript.
7. CONTINUITY: Review the "PREVIOUS CONTEXT". If the transcript indicates that any previous blocker is now resolved, add its ID to 'resolved_previous_blocker_ids'. If the transcript indicates a previous action item is now completed, add its ID to 'updated_previous_action_items' with new_status 'completed'.
8. HUMAN NAMES & EXCLUSIONS CONSTRAINT (CRITICAL):
   When extracting task owners (inside 'action_items' or 'decisions'), or attendees (inside 'attendees_present' or 'attendees_referenced_not_present'), you must ONLY extract actual human names. Do NOT extract:
   - Software platforms or products (e.g., TikTok, Instagram, Meta, Bionic, Power BI, GA)
   - File formats, data structures, or technical terms (e.g., JSON, API, ID, SQL, CSV)
   - Conversational filler words or connectors from ANY language present in the transcript, including Hindi/Hinglish mixed speech (e.g., 'Aur' meaning 'and', 'Jo bhi' meaning 'whatever', 'Matlab' meaning 'meaning/that is', 'Deepika' meaning 'Thik hai')
   - Generic role references without a name attached (e.g., 'the developer', 'someone from the team') — only extract these if a specific person's name is explicitly given.

   If a task, decision, or mention does not have a clearly identifiable human name attached to it, set the owner/decided_by field to null rather than guessing or extracting a nearby capitalized word or foreign-language term as if it were a name. Apply this rule strictly and consistently across all fields extracting name references.

9. FEW-SHOT EXAMPLES:
   - Example 1 — Correct Ingestion Task:
     Transcript: "Naved asked Deepika to raise a ticket to Aur to get jobs live, and confirm the JSON payload keys with Saqib."
     WRONG attendees_referenced_not_present: ["Aur", "JSON"]
     CORRECT action_items: 
       [
         {"task": "Raise a ticket to get pipeline jobs live", "owner": "Deepika", "status": "Open", "due_date": null},
         {"task": "Confirm JSON payload keys with Saqib", "owner": "Saqib", "status": "Open", "due_date": null}
       ]
       (Note: "Aur" and "JSON" are completely ignored as attendees or owners since they are conversational connectors and file formats).
   - Example 2 — Correct Platform Task:
     Transcript: "Mayank needs to setup the TikTok and GA pipelines by next Monday."
     WRONG action_items: [{"task": "Setup pipelines", "owner": "TikTok", "status": "Open"}]
     CORRECT action_items: [{"task": "Setup TikTok and GA pipelines", "owner": "Mayank", "status": "Open", "due_date": "next Monday"}]

Return ONLY valid JSON matching this exact structure, no preamble or explanation:

{
  "meeting_title": "string (e.g. 'Landsec KT Session — B2C/Bionic Data Ingestion')",
  "meeting_date": "string (YYYY-MM-DD or readable format)",
  "duration_estimate": "string or null (e.g. '~58 minutes', only if inferable from transcript length/content, otherwise null)",
  "led_by": "string or null (e.g. 'Naved Hashmi (Technical Walkthrough)')",
  "facilitated_by": "string or null",
  "attendees_present": ["name1", "name2"],
  "attendees_referenced_not_present": ["name3", "name4"],
  "quick_summary": "SHORT 2-3 sentence at-a-glance summary of the meeting highlights",
  "purpose": "1-2 sentence statement of what this meeting was for",
  "discussion_points": ["point1", "point2"],
  "decisions": [
    { "decision": "...", "owner": "name or null", "rationale": "..." }
  ],
  "action_items": [
    { "task": "...", "owner": "name or null", "status": "Open" | "Completed", "due_date": "string or null" }
  ],
  "open_risks_blockers": ["risk1", "risk2"],
  "next_steps": "1-3 sentence summary of immediate next actions",
  "resolved_previous_blocker_ids": ["ID1", "ID2"],
  "updated_previous_action_items": [
    { "id": "ID1", "new_status": "completed" }
  ]
}

TRANSCRIPT TEXT:
${transcriptText.substring(0, 300000)}`;

const MEETING_MINUTES_SCHEMA = {
  name: "meeting_minutes",
  strict: true,
  schema: {
    type: "object",
    properties: {
      meeting_title: { type: "string" },
      meeting_date: { type: "string" },
      duration_estimate: {
        anyOf: [
          { type: "string" },
          { type: "null" }
        ]
      },
      led_by: {
        anyOf: [
          { type: "string" },
          { type: "null" }
        ]
      },
      facilitated_by: {
        anyOf: [
          { type: "string" },
          { type: "null" }
        ]
      },
      attendees_present: {
        type: "array",
        items: {
          type: "string",
          enum: ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"]
        }
      },
      attendees_referenced_not_present: {
        type: "array",
        items: {
          type: "string",
          enum: ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"]
        }
      },
      quick_summary: { type: "string" },
      purpose: { type: "string" },
      discussion_points: {
        type: "array",
        items: { type: "string" }
      },
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            decision: { type: "string" },
            owner: {
              anyOf: [
                { type: "string", enum: ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"] },
                { type: "null" }
              ]
            },
            rationale: { type: "string" }
          },
          required: ["decision", "owner", "rationale"],
          additionalProperties: false
        }
      },
      action_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string" },
            owner: {
              anyOf: [
                { type: "string", enum: ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"] },
                { type: "null" }
              ]
            },
            status: { type: "string", enum: ["Open", "Completed"] },
            due_date: {
              anyOf: [
                { type: "string" },
                { type: "null" }
              ]
            }
          },
          required: ["task", "owner", "status", "due_date"],
          additionalProperties: false
        }
      },
      open_risks_blockers: {
        type: "array",
        items: { type: "string" }
      },
      next_steps: { type: "string" },
      resolved_previous_blocker_ids: {
        type: "array",
        items: { type: "string" }
      },
      updated_previous_action_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            new_status: { type: "string", enum: ["open", "completed"] }
          },
          required: ["id", "new_status"],
          additionalProperties: false
        }
      }
    },
    required: [
      "meeting_title",
      "meeting_date",
      "duration_estimate",
      "led_by",
      "facilitated_by",
      "attendees_present",
      "attendees_referenced_not_present",
      "quick_summary",
      "purpose",
      "discussion_points",
      "decisions",
      "action_items",
      "open_risks_blockers",
      "next_steps",
      "resolved_previous_blocker_ids",
      "updated_previous_action_items"
    ],
    additionalProperties: false
  }
};

  try {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'save_meeting_minutes',
          description: 'Save structured minutes of meeting record',
          parameters: MEETING_MINUTES_SCHEMA.schema
        }
      }
    ];
    const toolChoice = {
      type: 'function',
      function: { name: 'save_meeting_minutes' }
    };

    const response = await aiProvider.chat(
      [{ role: 'user', content: prompt }],
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        maxTokens: 8000,
        tools,
        toolChoice
      }
    );

    const rawText = response.content;

    // Safe JSON parse — attempt to repair truncated responses before failing
    let parsed: GroqMeetingMinutes;
    try {
      parsed = JSON.parse(rawText) as GroqMeetingMinutes;
    } catch (parseErr) {
      console.warn('[generateMeetingMinutes] JSON parse failed — attempting truncation repair...');
      console.warn('[generateMeetingMinutes] Tail of raw response:', rawText.slice(-300));
      try {
        parsed = JSON.parse(repairTruncatedJson(rawText)) as GroqMeetingMinutes;
        console.log('[generateMeetingMinutes] Truncation repair succeeded.');
      } catch {
        throw new Error(`AI response was incomplete or malformed (likely truncated at token limit). Raw tail: ${rawText.slice(-100)}`);
      }
    }

    // Strict client-side runtime validation gate & coercion
    const allowedNames: AllowedMemberName[] = ["Naved Hashmi", "Mayank Tiwari", "Deepankar Panchal", "Saqib", "Unassigned"];

    if (parsed.attendees_present) {
      parsed.attendees_present = parsed.attendees_present.map(att => {
        if (allowedNames.includes(att)) {
          return att;
        } else {
          console.warn(`[Runtime Validation] Coercing invalid attendee_present "${att}" to "Unassigned"`);
          return "Unassigned";
        }
      });
    }

    if (parsed.attendees_referenced_not_present) {
      parsed.attendees_referenced_not_present = parsed.attendees_referenced_not_present.map(att => {
        if (allowedNames.includes(att)) {
          return att;
        } else {
          console.warn(`[Runtime Validation] Coercing invalid attendee_referenced_not_present "${att}" to "Unassigned"`);
          return "Unassigned";
        }
      });
    }

    if (parsed.action_items) {
      parsed.action_items = parsed.action_items.map(item => {
        let owner = item.owner;
        if (!owner || !allowedNames.includes(owner)) {
          console.warn(`[Runtime Validation] Coercing invalid action item owner "${owner}" to "Unassigned"`);
          owner = "Unassigned";
        }
        return {
          ...item,
          owner
        };
      });
    }

    if (parsed.decisions) {
      parsed.decisions = parsed.decisions.map(item => {
        let owner = item.owner;
        if (!owner || !allowedNames.includes(owner)) {
          console.warn(`[Runtime Validation] Coercing invalid decision owner "${owner}" to "Unassigned"`);
          owner = "Unassigned";
        }
        return {
          ...item,
          owner
        };
      });
    }

    return parsed;
  } catch (error: any) {
    console.error('[Meeting Minutes Groq Error]', error);
    throw error;
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Proposal Summary Generation — 9-section structured opportunity description
// This is SEPARATE from analyzePresalesDocWithGroq (stage-progress analysis).
// It is ONLY called from POST /:id/generate-proposal and NEVER updates
// currentStageIndex, progressPercent, or any stage-related field.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposalSummary {
  executive_summary: string;
  scope_of_work: string;
  architecture: string;
  implementation_approach: string;
  delivery_approach: string;
  assumptions: string;
  out_of_scope: string;
  timelines: string;
  commercials: string;
}

export async function generateProposalSummary(
  combinedText: string,
  retries = 1
): Promise<ProposalSummary> {
  // Credentials validated by aiProvider

  // Context limit check: llama-3.3-70b-versatile has a 128k token window.
  // 1 token is ~4 characters. 120k tokens is ~480,000 characters.
  // We limit combined text to 450,000 characters to prevent API context overflow.
  const CHARACTER_LIMIT = 450000;
  let promptText = combinedText;

  if (combinedText.length > CHARACTER_LIMIT) {
    console.warn(`[generateProposalSummary] Warning: Combined text length (${combinedText.length} chars) exceeds context safety limit. Intelligently trimming input documents...`);
    const docs = combinedText.split('\n\n--- Document: ');
    let currentLength = 0;
    const keptDocs: string[] = [];
    
    for (let i = 0; i < docs.length; i++) {
      let docText = docs[i];
      if (i > 0) docText = '--- Document: ' + docText;
      if (currentLength + docText.length <= CHARACTER_LIMIT) {
        keptDocs.push(docText);
        currentLength += docText.length;
      } else {
        console.warn(`[generateProposalSummary] Trimming: Dropped document "${docText.split('\n')[0]}" to prevent context window overflow.`);
      }
    }
    
    promptText = keptDocs.length > 0 ? keptDocs.join('\n\n') : combinedText.substring(0, CHARACTER_LIMIT);
  }

  console.log(`[generateProposalSummary] Sending prompt payload. Original length: ${combinedText.length} chars, Sliced length: ${promptText.length} chars`);

  const prompt = `You are a senior presales solution architect. Based solely on the provided documents, generate a structured proposal summary for this business opportunity.

Include everything from the source documents that is relevant to each section. Do not summarize down to a fixed length or omit relevant detail for brevity. The length of each section should be a direct reflection of how much relevant material exists in the source documents — a section with extensive source coverage should be correspondingly thorough and complete, with nothing left out.

Only include information stated or clearly implied in the source documents. Do not invent, assume, or extrapolate details not present in the source material, even if they would be typical for a project like this.

Extract concrete, named details already present in the source documents — specific technologies, named deliverables, actual figures, dates, team roles, tool names — rather than vague paraphrasing. E.g. name the actual platforms/tools mentioned rather than saying "a hybrid approach will be used."

Use markdown bullet points within a section where that improves clarity (especially for lists of deliverables, technologies, timelines, or assumptions), rather than forcing everything into a single dense paragraph.

Structure the sections as follows:
- executive_summary: The problem, proposed solution, and expected outcome.
- scope_of_work: Concrete deliverables, as a bulleted list where appropriate.
- architecture: Actual technical components/platforms and how they fit together.
- implementation_approach: Methodology/phases for building the solution.
- delivery_approach: How the solution will be rolled out/deployed.
- assumptions: Bulleted list of assumptions being made.
- out_of_scope: Bulleted list of explicit exclusions.
- timelines: Phases/milestones with dates or durations if mentioned.
- commercials: Pricing, cost structure, or commercial terms if mentioned.

If a section genuinely has no supporting content anywhere in the source documents, return an empty string "" for it — never padded, never invented, never a filler sentence.

Self-Check: Before finalizing your response, verify that every statement is directly traceable to the source documents provided. Remove or soften anything not clearly supported by the source material.

Return ONLY valid JSON with these exact keys, no markdown wrapper around the JSON itself, no preamble, no explanation outside JSON:

{
  "executive_summary": "Detailed overview of the opportunity, client need, and proposed solution approach",
  "scope_of_work": "What is included in the engagement — deliverables, systems, processes",
  "architecture": "Technical stack, infrastructure, integration points, or solution architecture",
  "implementation_approach": "How the work will be executed — methodologies, phases, teams involved",
  "delivery_approach": "Deployment, go-live, handover, or delivery model details",
  "assumptions": "Assumptions made about the client environment, scope, or requirements",
  "out_of_scope": "What is explicitly excluded from this engagement",
  "timelines": "Project milestones, estimated durations, key dates",
  "commercials": "Pricing model, rate cards, budget range, commercial terms"
}

COMBINED DOCUMENT TEXT:
${promptText}`;

  const response = await aiProvider.chat(
    [{ role: 'user', content: prompt }],
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      maxTokens: 8000,
      jsonMode: true
    }
  );

  const rawText: string = response.content;
  console.log('[Groq Proposal Raw Response] Entire Response:\n', rawText);

  try {
    const parsed = JSON.parse(rawText) as any;
    const clean = (v: any): string => {
      if (typeof v === 'string') {
        return v.trim();
      }
      if (Array.isArray(v)) {
        return v
          .map(item => (typeof item === 'string' ? `- ${item.trim()}` : String(item).trim()))
          .join('\n');
      }
      return '';
    };

    return {
      executive_summary: clean(parsed.executive_summary),
      scope_of_work: clean(parsed.scope_of_work),
      architecture: clean(parsed.architecture),
      implementation_approach: clean(parsed.implementation_approach),
      delivery_approach: clean(parsed.delivery_approach),
      assumptions: clean(parsed.assumptions),
      out_of_scope: clean(parsed.out_of_scope),
      timelines: clean(parsed.timelines),
      commercials: clean(parsed.commercials),
    };
  } catch {
    throw new Error('Groq returned invalid JSON for proposal summary. Please try again.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Section Generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSingleSection(
  combinedText: string,
  sectionName: string,
  retries = 1
): Promise<string | null> {
  // Credentials validated by aiProvider

  const promptText = combinedText.substring(0, 200000); // Increased from 15000 to support large documents and prevent truncation
  console.log(`[generateSingleSection] Sending prompt payload. Original length: ${combinedText.length} chars, Sliced length: ${promptText.length} chars`);

  const prompt = `You are a senior presales solution architect. Based solely on the provided documents, extract or generate the content ONLY for the following section: "${sectionName}".

Include everything from the source documents that is relevant to this section — do not summarize down to a fixed length or omit relevant detail for the sake of brevity. If the source documents contain extensive detail relevant to this section, the output should reflect that same level of completeness. If the section has little or no supporting content, you must return null. Do NOT invent or assume details.

Pull out SPECIFIC details already present in the source documents rather than staying at a high abstraction level. Use markdown bullet points where that improves clarity (especially for lists of deliverables, technologies, timelines, or assumptions), rather than forcing everything into a single dense paragraph.

Return ONLY valid JSON with exactly one key "content" which is either a string containing the text, or null. No markdown wrapper around the JSON itself, no preamble, no explanation outside JSON.

{
  "content": "Extracted text for ${sectionName}..." // or null if nothing relevant found
}

COMBINED DOCUMENT TEXT:
${promptText}`;

  const response = await aiProvider.chat(
    [{ role: 'user', content: prompt }],
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      maxTokens: 4000,
      jsonMode: true
    }
  );

  const rawText: string = response.content;
  console.log('[Groq Single Section Raw Response]', rawText);

  try {
    const parsed = JSON.parse(rawText) as any;
    const content = parsed.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map(item => (typeof item === 'string' ? `- ${item.trim()}` : String(item).trim()))
        .join('\n');
    }
    return null;
  } catch {
    throw new Error('Groq returned invalid JSON for single section. Please try again.');
  }
}
