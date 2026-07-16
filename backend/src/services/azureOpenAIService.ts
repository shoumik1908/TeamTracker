import { aiProvider } from './aiProvider';

// Interfaces
export interface GroqMeetingMinutes {
  meeting_title?: string;
  meeting_date?: string;
  attendees_present?: string[];
  attendees_referenced_not_present?: string[];
  purpose?: string;
  discussion_points?: string[];
  decisions?: { decision: string; owner: string | null; rationale?: string; confidence?: string; evidence_quote?: string; source_excerpt?: string }[];
  action_items?: { task: string; owner: string | null; status: 'Open' | 'Closed'; due_date: string | null; confidence?: string; evidence_quote?: string; source_excerpt?: string }[];
  open_risks_blockers?: { description: string; confidence?: string; evidence_quote?: string }[];
  next_steps?: string;
  progress_updates?: { topic: string; confidence: string; exact_value: string; evidence_quote: string }[];
  meeting_statistics?: any;
  attendees_mentioned?: string[];
  blockers_or_risks?: { description: string; confidence?: string; evidence_quote?: string }[];
  resolved_previous_blocker_ids?: string[];
  updated_previous_action_items?: { id: string; new_status: string }[];
}

export interface ProposalSummary {
  executive_summary?: string;
  scope_of_work?: string;
  architecture?: string;
  implementation_approach?: string;
  delivery_approach?: string;
  assumptions?: string;
  out_of_scope?: string;
  timelines?: string;
  commercials?: string;
}

function repairTruncatedJson(str: string): string {
  let repaired = str.trim();
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  let missingBraces = openBraces - closeBraces;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  let missingBrackets = openBrackets - closeBrackets;
  while (missingBrackets > 0) { repaired += ']'; missingBrackets--; }
  while (missingBraces > 0) { repaired += '}'; missingBraces--; }
  return repaired;
}

// self verify helpers
function getTailLines(transcriptText: string, numLines = 5) {
  const lines = transcriptText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(-numLines).join("\n");
}


export async function generateMeetingMinutes(
  transcriptText: string,
  previousOpenActionItems: { id: string; task: string; owner: string | null }[] = [],
  previousOpenBlockers: { id: string; description: string }[] = [],
  retries = 1,
  contextMembers: any[] = []
): Promise<GroqMeetingMinutes | null> {
  // Credentials validated by aiProvider

  const priorActionItemsText = previousOpenActionItems.length > 0 
    ? previousOpenActionItems.map(a => `[ID: ${a.id}] Task: ${a.task} (Owner: ${a.owner || 'Unassigned'})`).join('\n')
    : 'None';

  const priorBlockersText = previousOpenBlockers.length > 0
    ? previousOpenBlockers.map(b => `[ID: ${b.id}] Description: ${b.description}`).join('\n')
    : 'None';

  const prompt = `You are an enterprise meeting analyst. Your primary objective is factual extraction, not summarization. Never fabricate information. If something is uncertain, explicitly state: "Not explicitly mentioned in the transcript." Prefer omission over invention. Your target hallucination rate is below 2%.

Analyze the following meeting transcript and generate a highly structured project record in the exact Minutes of Meeting (MoM) format below.

SPEECH-TO-TEXT CORRECTION MAP (Known ASR glitches to resolve):
- "Deepika" -> "Thik hai" (Hindi for "Alright" / "Okay"). Do NOT treat as a person.
- "Jason" -> "JSON" (data format).
- "Kaur" -> "Aur" (Hindi for "and").
- "Victor" -> "TikTok".
- "Eddie" -> "ID".
- "Ruby" -> "Jo bhi" (Hindi for "whatever").

PREVIOUS CONTEXT (From prior meetings):
Open Action Items:
${priorActionItemsText}

Open Blockers/Risks:
${priorBlockersText}

STRICT EXTRACTION RULES (Apply these without exception):

1. ACTION ITEM CREATION (Imperatives only)
Only create an action item when the transcript contains an imperative statement (e.g. 'fix', 'update', 'run', 'verify', 'check', 'send', 'raise', 'confirm') that is CLEARLY DIRECTED at a specific person — either by name ('Ashok, please verify X') or unambiguous direct address in context. Do not create an action item purely from a topic being discussed or a problem being mentioned without someone being explicitly told or agreeing to address it.

2. NO OWNER ATTRIBUTION FROM NEARBY MENTIONS
Do not assign an owner to an action item or decision based on that person being mentioned nearby in a noisy or cross-talk-heavy section of the transcript. Owner attribution requires the person to be the explicit subject of the imperative/task — not simply present in the same segment of dialogue where the topic came up.

3. OWNER ATTRIBUTION FOR DECISIONS/MILESTONES
For decisions and project milestones, if no specific person is explicitly named as responsible, set owner/decided_by to null — do not guess an owner from general team association or role assumptions (e.g. 'this is a data task, so it's probably the data engineer's decision' is NOT valid evidence).

4. CONFIDENCE SCORING (Audio/Text Quality)
If a portion of the transcript shows signs of low-quality speech recognition (fragmented sentences, words that don't form coherent phrases, inconsistent capitalization suggesting phonetic transcription errors, mixed-language fragments that don't parse cleanly), any action item, decision, progress update, or attribution drawn primarily from that section should be marked confidence: 'Medium' or 'Low' — never 'High' — regardless of how confident the underlying task/decision content itself seems.

5. NO INFERRED PROGRESS FROM SHORT ACKNOWLEDGMENTS
Brief acknowledgment phrases (e.g. 'Done', 'Okay', 'Done, but there', 'Yeah, sure') should NOT be treated as meaningful status updates, completions, or confirmations of a specific task UNLESS the surrounding context clearly ties that acknowledgment to a specific, previously stated task. Do not infer what was 'done' from a short acknowledgment alone.

6. NO INVENTED NUMBERS, DATES OR QUANTITIES
Never state a specific number, percentage, date, deadline, or quantity (e.g. '3 days', '20% improvement', 'by Friday') unless that exact value appears in the transcript. If a timeframe or magnitude was discussed only vaguely ('soon', 'a few of them', 'sometime next week'), preserve that vagueness in the output rather than converting it to a concrete-sounding figure.

7. DECISION DETECTION (Explicit agreement required)
Only log an entry under 'decisions' if the transcript contains language indicating consensus or a settled choice (e.g. 'let's go with', 'agreed', 'we'll do X instead', 'okay, final answer is'). A topic that was debated, proposed, or left open ('we could maybe try X', 'not sure if X or Y') belongs in Discussion Points, not Decisions, even if one option was discussed at length.

8. DEDUPLICATION
If the same underlying task is mentioned multiple times across the transcript (restated, rephrased, or revisited later in the conversation), emit ONE action item reflecting the most complete/final version of it — not one entry per mention. Prefer the phrasing and owner from the latest mention if details conflict across restatements.

9. ATTENDANCE DETECTION
Only include a person in 'attendees_present' if the transcript indicates they spoke or were directly addressed as present (e.g. greeted, asked a question, responded). A person who is merely discussed, referenced, or named as a stakeholder elsewhere in the org does not belong in Attendees — route them to the separate 'attendees_referenced_not_present' list instead, and only if the reference is a clean, unambiguous name (not a suspected transcription artifact).

10. UNRESOLVED PRONOUNS
Do not resolve an ambiguous pronoun ('he', 'she', 'they', 'that person') to a specific named individual unless the transcript makes the referent unambiguous from context. If ownership of a task depends on resolving an ambiguous pronoun, treat the task per Rule 3 (owner: null) rather than guessing which attendee it refers to.

11. SOURCE EXCERPTS
Each 'action_items' and 'decisions' entry MUST include a 'source_excerpt' field: a short (under 20 words), minimally-edited pointer to the transcript moment it was drawn from — enough for a human reviewer to locate and verify it against the original transcript, not a full quote.

12. CLEAN PROGRESS UPDATES
Progress update text must be a clean, grammatically complete status statement. Strip filler words, verbal tics, and false starts (e.g. 'I know', 'yeah', 'so basically', 'like', repeated words) that don't add status information. If removing filler leaves an incomplete or unclear status, mark the update as needing review rather than emitting a fragment.

13. COMPLETE SENTENCES FOR PROGRESS
Each progress update must read as a complete, standalone sentence describing what state the work is in (e.g. 'In progress', 'Completed', 'Blocked on X', 'Continuing this week'). Do not emit sentence fragments or trailing/leading filler as if they were the status.

OTHER RULES:
- Include 'evidence_quote' for other fields (progress, risks).
- If the transcript indicates a previous blocker is resolved, add its ID to 'resolved_previous_blocker_ids'.
- If a previous action item is completed, add its ID to 'updated_previous_action_items' with new_status 'completed'.

Return ONLY valid JSON matching this exact structure, no preamble:

{
  "meeting_title": "string",
  "meeting_date": "string or null (Extract BOTH the exact date and time ONLY IF EXPLICITLY MENTIONED in the transcript. ALWAYS format and output the time in IST (Indian Standard Time), e.g. 'July 10, 2026, 4:16 AM IST'. If no date is mentioned, return null. Do NOT guess or use example dates.)",
  "duration_estimate": "string or null",
  "led_by": "string or null",
  "facilitated_by": "string or null",
  "attendees_present": ["name1", "name2"],
  "attendees_referenced_not_present": ["name3", "name4"],
  "quick_summary": "SHORT 2-3 sentence at-a-glance summary",
  "purpose": "1-2 sentence statement of what this meeting was for",
  "discussion_points": ["point1", "point2"],
  "decisions": [
    { "decision": "...", "owner": "name or null", "rationale": "...", "confidence": "High" | "Medium" | "Low", "source_excerpt": "...", "evidence_quote": "..." }
  ],
  "action_items": [
    { "task": "...", "owner": "name or Unassigned", "status": "Open" | "Completed", "due_date": "string or null", "confidence": "High" | "Medium" | "Low", "source_excerpt": "...", "evidence_quote": "..." }
  ],
  "open_risks_blockers": [
    { "description": "...", "confidence": "High" | "Medium", "evidence_quote": "..." }
  ],
  "progress_updates": [
    { "topic": "...", "exact_value": "...", "confidence": "High" | "Medium" | "Low", "evidence_quote": "..." }
  ],
  "next_steps": "1-3 sentence summary",
  "resolved_previous_blocker_ids": ["ID1"],
  "updated_previous_action_items": [
    { "id": "ID1", "new_status": "completed" }
  ],
  "meeting_statistics": {
    "participants_count": 0,
    "speakers_count": 0,
    "decisions_count": 0,
    "action_items_count": 0,
    "risks_count": 0
  },
  "confidence_score": {
    "overall_accuracy": "e.g. 95%",
    "evidence_coverage": "e.g. High",
    "hallucination_risk": "e.g. Low"
  }
}

TRANSCRIPT TEXT:
${transcriptText.substring(0, 300000)}`;


  function getMeetingMinutesSchema(roster: any[]) {
    const allowedNames = roster.length > 0 ? [...roster.map(m => m.name), 'Unassigned'] : ['Unassigned'];
    return {
      name: 'meeting_minutes',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          meeting_title: { type: 'string' },
          meeting_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          duration_estimate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          led_by: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          facilitated_by: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          attendees_present: { type: 'array', items: { type: 'string' } },
          attendees_referenced_not_present: { type: 'array', items: { type: 'string' } },
          quick_summary: { type: 'string' },
          purpose: { type: 'string' },
          discussion_points: { type: 'array', items: { type: 'string' } },
          decisions: { type: 'array', items: { type: 'object', properties: { decision: { type: 'string' }, owner: { anyOf: [{ type: 'string' }, { type: 'null' }] }, rationale: { type: 'string' }, confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] }, evidence_quote: { type: 'string' } }, required: ['decision', 'owner', 'rationale', 'confidence', 'evidence_quote'], additionalProperties: false } },
          action_items: { type: 'array', items: { type: 'object', properties: { task: { type: 'string' }, owner: { anyOf: [{ type: 'string' }, { type: 'null' }] }, status: { type: 'string', enum: ['Open', 'Completed'] }, due_date: { anyOf: [{ type: 'string' }, { type: 'null' }] }, confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] }, evidence_quote: { type: 'string' } }, required: ['task', 'owner', 'status', 'due_date', 'confidence', 'evidence_quote'], additionalProperties: false } },
          open_risks_blockers: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] }, evidence_quote: { type: 'string' } }, required: ['description', 'confidence', 'evidence_quote'], additionalProperties: false } },
          progress_updates: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, exact_value: { type: 'string' }, confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] }, evidence_quote: { type: 'string' } }, required: ['topic', 'exact_value', 'confidence', 'evidence_quote'], additionalProperties: false } },
          next_steps: { type: 'string' },
          resolved_previous_blocker_ids: { type: 'array', items: { type: 'string' } },
          updated_previous_action_items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, new_status: { type: 'string', enum: ['open', 'completed'] } }, required: ['id', 'new_status'], additionalProperties: false } },
          meeting_statistics: { type: 'object', properties: { participants_count: { type: 'number' }, speakers_count: { type: 'number' }, decisions_count: { type: 'number' }, action_items_count: { type: 'number' }, risks_count: { type: 'number' } }, required: ['participants_count', 'speakers_count', 'decisions_count', 'action_items_count', 'risks_count'], additionalProperties: false },
          confidence_score: { type: 'object', properties: { overall_accuracy: { type: 'string' }, evidence_coverage: { type: 'string' }, hallucination_risk: { type: 'string' } }, required: ['overall_accuracy', 'evidence_coverage', 'hallucination_risk'], additionalProperties: false }
        },
        required: [
          'meeting_title', 'meeting_date', 'duration_estimate', 'led_by', 'facilitated_by',
          'attendees_present', 'attendees_referenced_not_present', 'quick_summary', 'purpose',
          'discussion_points', 'decisions', 'action_items', 'open_risks_blockers', 'progress_updates',
          'next_steps', 'resolved_previous_blocker_ids', 'updated_previous_action_items',
          'meeting_statistics', 'confidence_score'
        ],
        additionalProperties: false
      }
    };
  }

  try {

    const tools = [
      {
        type: 'function',
        function: {
          name: 'save_meeting_minutes',
          description: 'Save structured minutes of meeting record',
          parameters: getMeetingMinutesSchema(contextMembers).schema
        }
      }
    ];
    const toolChoice = {
      type: 'function',
      function: { name: 'save_meeting_minutes' }
    };

    let response = await aiProvider.chat(
      [{ role: 'user', content: prompt }],
      {
        forceProvider: 'azure',
        temperature: 0.1,
        maxTokens: 8000,
        tools,
        toolChoice
      }
    );

    let rawText = response.content;
    let parsed: GroqMeetingMinutes | null = null;
    
    // Attempt parse
    try {
      parsed = JSON.parse(rawText) as GroqMeetingMinutes;
    } catch (parseErr) {
      try {
        parsed = JSON.parse(repairTruncatedJson(rawText)) as GroqMeetingMinutes;
      } catch {}
    }

    // ---------- SELF VERIFICATION ----------
    if (parsed) {
      const tailLines = getTailLines(transcriptText, 5);
      const selfCheckPrompt = `You are fact-checking a generated meeting summary against the final lines of the source transcript. Check ONLY for logical coherence with how the conversation actually ended — not overall summary quality.

Return ONLY valid JSON:
{
  "makes_sense": boolean,
  "issues_found": string[],
  "missed_final_action_items": string[]
}

Flag makes_sense as false if the summary's action items, decisions, or next steps contradict, ignore, or misrepresent what these final lines show. Keep issues_found and missed_final_action_items empty if there is nothing wrong — do not invent issues to seem thorough.`;
      
      const selfCheckUserPrompt = `FINAL LINES OF TRANSCRIPT:\n${tailLines}\n\nGENERATED ACTION ITEMS:\n${JSON.stringify(parsed.action_items || [], null, 2)}\n\nGENERATED DECISIONS:\n${JSON.stringify(parsed.decisions || [], null, 2)}\n\nGENERATED NEXT STEPS:\n${parsed.next_steps || ''}`;

      try {
        const checkRes = await aiProvider.chat([
          { role: 'system', content: selfCheckPrompt },
          { role: 'user', content: selfCheckUserPrompt }
        ], {
          forceProvider: 'azure',
          temperature: 0.1,
          maxTokens: 500
        });

        const checkParsed = JSON.parse(checkRes.content);
        if (!checkParsed.makes_sense || (checkParsed.issues_found && checkParsed.issues_found.length > 0) || (checkParsed.missed_final_action_items && checkParsed.missed_final_action_items.length > 0)) {
          console.log("[generateMeetingMinutes] Issues detected by self-check. Retrying once...");
          
          const retryPrompt = prompt + "\n\nIMPORTANT: A previous attempt may have missed or misrepresented how this conversation concluded. Pay particular attention to the final portion of the transcript when determining action items, decisions, and next steps.";
          
          response = await aiProvider.chat(
            [{ role: 'user', content: retryPrompt }],
            {
              forceProvider: 'azure',
              temperature: 0.1,
              maxTokens: 8000,
              tools,
              toolChoice
            }
          );
          
          rawText = response.content;
        }
      } catch (checkErr) {
        console.error("[generateMeetingMinutes] Self check failed, continuing with original output:", checkErr);
      }
    }

    // Final Safe JSON parse
    try {
      parsed = JSON.parse(rawText) as GroqMeetingMinutes;
    } catch (parseErr) {
      console.warn('[generateMeetingMinutes] JSON parse failed — attempting truncation repair...');
      try {
        parsed = JSON.parse(repairTruncatedJson(rawText)) as GroqMeetingMinutes;
      } catch {
        throw new Error(`AI response was incomplete or malformed (likely truncated at token limit). Raw tail: ${rawText.slice(-100)}`);
      }
    }

    // Strict client-side runtime validation gate & coercion
    // Skip attendee runtime coercion — always render raw extracted names for attendees.
    // For action_items and decisions, only coerce to "Unassigned" if genuinely null/empty.

    if (parsed.action_items) {
      parsed.action_items = parsed.action_items.map(item => {
        let owner = item.owner;
        if (!owner || owner.trim() === '') {
          console.warn(`[Runtime Validation] Coercing empty action item owner to "Unassigned"`);
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
        if (!owner || owner.trim() === '') {
          console.warn(`[Runtime Validation] Coercing empty decision owner to "Unassigned"`);
          owner = "Unassigned";
        }
        return {
          ...item,
          owner
        };
      });
    }

    if (parsed.action_items && parsed.action_items.length > 0) {
      console.log(`[generateMeetingMinutes] Running attribution verification for ${parsed.action_items.length} action items...`);
      
      const verificationSchema = {
        type: 'object',
        properties: {
          verifications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                owner_explicitly_confirmed: { type: 'boolean' },
                supporting_quote: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
              },
              required: ['task', 'owner_explicitly_confirmed', 'supporting_quote', 'confidence'],
              additionalProperties: false
            }
          }
        },
        required: ['verifications'],
        additionalProperties: false
      };

      const verificationTools = [
        {
          type: 'function',
          function: {
            name: 'verify_attributions',
            description: 'Verify action item owners against transcript',
            parameters: verificationSchema
          }
        }
      ];

      const attributionPrompt = `You are verifying task ownership attributions against a source transcript.

For EACH action item provided, determine whether the transcript contains
EXPLICIT evidence that the named owner actually took on, was assigned, or
confirmed that specific task — a direct statement or quote, not just general
topic/team association (e.g. "he's on the Power BI team" is NOT explicit
evidence that he owns a specific Power BI testing task unless someone
actually assigns it to him or he confirms it himself).

Return ONLY valid JSON passing verification to verify_attributions.

Be strict: if you cannot point to an actual quote or unambiguous statement
where the owner takes/is given that specific task, mark
owner_explicitly_confirmed as false, even if the topic was discussed by or
near that person.

TRANSCRIPT:
${transcriptText.substring(0, 300000)}

ACTION ITEMS TO VERIFY:
${JSON.stringify(parsed.action_items, null, 2)}`;

      try {
        const attributionResponse = await aiProvider.chat(
          [{ role: 'user', content: attributionPrompt }],
          {
            forceProvider: 'azure',
            temperature: 0.1,
            maxTokens: 1500,
            tools: verificationTools,
            toolChoice: { type: 'function', function: { name: 'verify_attributions' } }
          }
        );

        let verificationsParsed: any = null;
        try {
          verificationsParsed = JSON.parse(attributionResponse.content);
        } catch {
          console.warn('[generateMeetingMinutes] Attribution JSON parse failed. Raw: ', attributionResponse.content.substring(0, 200));
        }

        if (verificationsParsed && verificationsParsed.verifications) {
          parsed.action_items = parsed.action_items.map(item => {
            const match = verificationsParsed.verifications.find((v: any) => v.task === item.task);
            if (match && !match.owner_explicitly_confirmed && item.owner && item.owner !== 'Unassigned') {
              console.log(`[Attribution] Downgrading unconfirmed owner for task: "${item.task}"`);
              item.owner = `${item.owner} (inferred, not explicitly confirmed)`;
            }
            return item;
          });
        }
      } catch (attrErr) {
        console.error('[generateMeetingMinutes] Attribution Verification Failed. Skipping:', attrErr);
      }
    }

    return parsed;
  } catch (error: any) {
    console.error('[Meeting Minutes Groq Error]', error);
    throw error;
  }
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
      forceProvider: 'azure',
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


export async function generateExecutiveSummary(periodData: string): Promise<string> {
  console.log(`[generateExecutiveSummary] Generating overarching summary...`);
  
  const prompt = `You are a senior project manager. Based on the following summaries of multiple meetings that occurred over a specific period, generate a single, cohesive, high-level Executive Summary paragraph (4-6 sentences maximum).
  Focus on the overarching progress, key themes, and major decisions. Do NOT list out individual meeting dates or repeat every minor point. Produce a single paragraph that tells the overall story of this period.
  
  Meeting Summaries:
  ${periodData}`;

  try {
    const response = await aiProvider.chat(
      [{ role: 'user', content: prompt }],
      {
        forceProvider: 'azure',
        temperature: 0.3,
        maxTokens: 500
      }
    );
    
    return response.content?.trim() || 'Unable to generate summary.';
  } catch (error) {
    console.error('[generateExecutiveSummary] Error:', error);
    throw error;
  }
}
