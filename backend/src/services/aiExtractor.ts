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
  "summary": "string (2-3 sentences)",
  "feedback": ["string (improvement suggestions)"],
  "certifications_mentioned": ["string"]
}

STRICT SKILL EXTRACTION CRITERIA:
1. ONLY extract high-level, standardized technical skills, languages, and frameworks (e.g. "Java", "Python", "React", "Azure", "SQL").
2. DO NOT extract soft skills (e.g. "Critical Thinking", "Problem Solving", "Communication").
3. DO NOT extract overly granular sub-features (e.g. "Exception Handling", "JVM Memory Management", "Azure Blob Storage"). Group them under the parent technology (e.g. "Java", "Microsoft Azure").
4. Ensure all skills are properly capitalized (e.g. "JavaScript", not "javascript").
5. DO NOT extract duplicate skills or synonyms (e.g. do not include both "Java" and "java", just "Java").

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
