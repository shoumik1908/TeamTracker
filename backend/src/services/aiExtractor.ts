import { aiProvider } from './aiProvider';

export interface AiCvExtraction {
  skills: string[];
  primary_role: string;
  years_of_experience: number;
  ats_score: {
    total: number;
    breakdown: {
      contact_information: number;
      ats_formatting: number;
      skills_match: number;
      work_experience: number;
      education: number;
      projects: number;
      certifications: number;
      keywords: number;
    };
  };
  summary: string;
  feedback: string[];
  certifications_mentioned: string[];
  skillsGrouped: {
    category: string;
    items: string[];
  }[];
  projects: {
    organization: string;
    jobTitle: string;
    domain: string;
    dates: string;
    toolsAndTech: string[];
    responsibilities: string[];
  }[];
}

export async function extractCvWithAI(cvText: string): Promise<AiCvExtraction> {
  const prompt = `You are an expert HR ATS parsing system.
Extract the following information from this CV. Return STRICT JSON matching this schema:
{
  "skills": ["string"],
  "primary_role": "string (e.g. Software Engineer)",
  "years_of_experience": number,
  "ats_score": {
    "total": number (0-100),
    "breakdown": {
      "contact_information": number (0-10),
      "ats_formatting": number (0-15),
      "skills_match": number (0-25),
      "work_experience": number (0-20),
      "education": number (0-10),
      "projects": number (0-10),
      "certifications": number (0-5),
      "keywords": number (0-5)
    }
  },
  "summary": "string (Minimum 4-5 comprehensive bullet points or sentences)",
  "feedback": ["string (improvement suggestions)"],
  "certifications_mentioned": ["string"],
  "skillsGrouped": [
    {
      "category": "string (MUST be one of: 'Azure Tools', 'Big Data / Compute', 'Programming', 'Cloud Platform', 'Databases', 'Methodologies', 'IoT & Protocols')",
      "items": ["string"]
    }
  ],
  "projects": [
    {
      "organization": "string",
      "jobTitle": "string",
      "domain": "string (e.g. Retail, Finance)",
      "dates": "string (e.g. Mar 2023 - Present)",
      "toolsAndTech": ["string"],
      "responsibilities": ["string (bullet points of what they did)"]
    }
  ]
}

STRICT SKILL EXTRACTION CRITERIA:
1. Extract ALL technical skills, languages, and frameworks.
2. Group the skills into logical categories. You MUST ONLY use the following categories (do not invent new ones):
   - Azure Tools
   - Big Data / Compute
   - Programming
   - Cloud Platform
   - Databases
   - Methodologies
   - IoT & Protocols
3. DO NOT extract soft skills.
4. Ensure all skills are properly capitalized.
5. Populate the "skillsGrouped" array with these categories and their items. Omit a category if there are no skills for it. The flat "skills" array should just be a list of all items combined.

Ensure the output is purely valid JSON without any markdown blocks.

CV Text:
${cvText.substring(0, 12000)}`;

  const res = await aiProvider.askAI(prompt, { jsonMode: true, forceProvider: 'azure' });
  try {
    return JSON.parse(res.content) as AiCvExtraction;
  } catch (e) {
    const repaired = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(repaired) as AiCvExtraction;
  }
}

export interface AiPresalesAnalysis {
  detected_track: 'PNB' | 'TNM';
  suggested_stage: string;
  suggested_increment_percent: number;
  confidence: string;
  reasoning: string;
  action_items: string[];
}

export async function analyzePresalesDocWithAI(
  docText: string,
  pnbCurrentStage: string,
  pnbCurrentPercent: number,
  tnmCurrentStage: string,
  tnmCurrentPercent: number
): Promise<AiPresalesAnalysis> {
  const prompt = `You are a Presales pipeline expert.
Analyze this presales document and decide if it belongs to PNB (Pitch & Bid) or TNM (Time & Material).
Current PNB stage: ${pnbCurrentStage} (${pnbCurrentPercent}%)
Current TNM stage: ${tnmCurrentStage} (${tnmCurrentPercent}%)

Return STRICT JSON matching this schema:
{
  "detected_track": "PNB" or "TNM",
  "suggested_stage": "string (the next logical stage)",
  "suggested_increment_percent": number (how much to progress),
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "string",
  "action_items": ["string"]
}

Ensure the output is purely valid JSON without any markdown blocks.

Document Text:
${docText.substring(0, 12000)}`;

  const res = await aiProvider.askAI(prompt, { jsonMode: true, forceProvider: 'azure' });
  try {
    return JSON.parse(res.content) as AiPresalesAnalysis;
  } catch (e) {
    const repaired = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(repaired) as AiPresalesAnalysis;
  }
}

export interface TailoredResumeData {
  summary: string;
  skills: string[];
  skillsGrouped: {
    category: string;
    items: string[];
  }[];
  certifications: string[];
  projects: {
    organization: string;
    jobTitle: string;
    domain: string;
    dates: string;
    toolsAndTech: string[];
    responsibilities: string[];
  }[];
}

export async function tailorResumeForJD(
  originalProfile: any,
  jobDescription: string
): Promise<TailoredResumeData> {
  const prompt = `You are an expert technical recruiter and resume writer.
I have a candidate's original extracted profile and a target Job Description (JD).
Your task is to tailor the candidate's summary and prioritize their skills to best match the JD.

CRITICAL RULES:
1. DO NOT invent, hallucinate, or substantially alter the candidate's core skills or projects. You MUST ONLY use their real data.
2. Group the candidate's existing skills into logical categories. You MUST ONLY use the following categories: "Azure Tools", "Big Data / Compute", "Programming", "Cloud Platform", "Databases", "Methodologies", "IoT & Protocols". DO NOT add skills they do not have.
3. Rewrite the summary to highlight alignment with the JD using their real experience. It MUST be a minimum of 4-5 comprehensive points/sentences.
4. DO NOT invent or hallucinate certifications. If the original profile provides certifications, you may include them if relevant.
5. Return a list of the candidate's actual projects. For each existing project, rewrite the responsibilities to emphasize the required JD skills that they genuinely possess. Do NOT invent new projects.

Candidate Original Profile:
${JSON.stringify({
  summary: originalProfile.summary,
  skills: originalProfile.skills,
  primaryRole: originalProfile.primaryRole,
  yearsOfExperience: originalProfile.yearsOfExperience,
  projects: originalProfile.projects || []
}, null, 2)}

Target Job Description:
${jobDescription.substring(0, 5000)}

Return STRICT JSON matching this schema:
{
  "summary": "string (tailored summary, min 4-5 points)",
  "skills": ["string (all skills flat list)"],
  "skillsGrouped": [
    {
      "category": "string (MUST be one of the 7 allowed categories)",
      "items": ["string"]
    }
  ],
  "certifications": ["string (curated list of ONLY actual certifications from the original profile)"],
  "projects": [
    {
      "organization": "string",
      "jobTitle": "string",
      "domain": "string",
      "dates": "string",
      "toolsAndTech": ["string"],
      "responsibilities": ["string"]
    }
  ]
}
`;

  const res = await aiProvider.askAI(prompt, { jsonMode: true, forceProvider: 'azure' });
  try {
    return JSON.parse(res.content) as TailoredResumeData;
  } catch (e) {
    const repaired = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(repaired) as TailoredResumeData;
  }
}
