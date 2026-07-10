import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { TextAnalyticsClient, AzureKeyCredential as LanguageKeyCredential } from '@azure/ai-text-analytics';
import { parse, isValid } from 'date-fns';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fuzz = require('fuzzball') as { ratio: (a: string, b: string) => number };

const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT || '';
const apiKey = process.env.AZURE_DOC_INTEL_KEY || '';
const languageEndpoint = process.env.AZURE_LANGUAGE_ENDPOINT || '';
const languageKey = process.env.AZURE_LANGUAGE_KEY || '';

let client: DocumentAnalysisClient | null = null;
let textClient: TextAnalyticsClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (!client) {
    if (!endpoint || !apiKey) {
      throw new Error('Azure Document Intelligence credentials not configured.');
    }
    client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));
  }
  return client;
}

function getTextClient(): TextAnalyticsClient | null {
  if (!textClient) {
    if (languageEndpoint && languageKey) {
      textClient = new TextAnalyticsClient(languageEndpoint, new LanguageKeyCredential(languageKey));
    }
  }
  return textClient;
}

export function isConfigured(): boolean {
  return !!(process.env.AZURE_DOC_INTEL_ENDPOINT && process.env.AZURE_DOC_INTEL_KEY);
}

export function isLanguageConfigured(): boolean {
  return !!(process.env.AZURE_LANGUAGE_ENDPOINT && process.env.AZURE_LANGUAGE_KEY);
}

// Normalize a wide variety of date strings → YYYY-MM-DD
function normalizeDate(raw: string): string | null {
  const formats = [
    'MMMM d, yyyy', 'MMMM dd, yyyy',
    'MMM d, yyyy',  'MMM dd, yyyy',
    'MM/dd/yyyy',   'dd/MM/yyyy',
    'yyyy-MM-dd',   'MM-dd-yyyy',   'dd-MM-yyyy',
    'MMMM yyyy',    'MMM yyyy',
  ];
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  for (const fmt of formats) {
    const parsed = parse(cleaned, fmt, new Date());
    if (isValid(parsed)) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

const COMPLETION_DATE_SYNONYMS = [
  "completed on", "completion date", "date of completion",
  "earned on", "date earned", "issued on", "issue date",
  "date of issue", "awarded on", "date awarded",
  "certified on", "certification date", "date certified",
  "achieved on", "granted on"
];

const EXPIRY_DATE_SYNONYMS = [
  "expiry date", "expiration date", "valid until", "valid till",
  "date of expiry", "date of expiration", "expires on",
  "renewal due", "renew by", "valid through"
];

function matchesAnySynonym(text: string, synonymList: string[]): boolean {
  return synonymList.some(phrase => text.includes(phrase));
}

function extractDatesFromRawText(rawLines: string[]): { completionDate: string | null; expiryDate: string | null } {
  const result: { completionDate: string | null; expiryDate: string | null } = { completionDate: null, expiryDate: null };
  const datePattern = /([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

  for (const line of rawLines) {
    const lower = line.toLowerCase();

    if (!result.completionDate && matchesAnySynonym(lower, COMPLETION_DATE_SYNONYMS)) {
      const match = line.match(datePattern);
      if (match) {
        result.completionDate = normalizeDate(match[1]);
      }
    }

    if (!result.expiryDate && matchesAnySynonym(lower, EXPIRY_DATE_SYNONYMS)) {
      const match = line.match(datePattern);
      if (match) {
        result.expiryDate = normalizeDate(match[1]);
      }
    }
  }

  return result;
}// Phrases where the NAME comes BEFORE the phrase (your Databricks cert pattern)
const NAME_BEFORE_PHRASES = [
  "has successfully completed",
  "has completed the requirements",
  "has completed the course",
  "has successfully passed",
  "has met the requirements",
  "has demonstrated",
  "has fulfilled the requirements",
  "successfully completed",
  "successfully passed",
  "successfully finished"
];

// Phrases where the NAME comes AFTER the phrase (generic template pattern)
const NAME_AFTER_PHRASES = [
  "certifies that",
  "presented to",
  "awarded to",
  "this is to certify that",
  "this certifies that",
  "this is presented to",
  "in recognition of",
  "proudly presented to",
  "granted to",
  "conferred upon",
  "this award is presented to",
  "recipient:",
  "name:",
  "candidate name",
  "participant name",
  "student name"
];

function isLikelyName(line: string): boolean {
  if (!line) return false;
  const cleaned = line.trim();
  if (cleaned.length > 45 || cleaned.length < 3) return false;
  if (/\d/.test(cleaned)) return false; // no digits — rules out dates/IDs
  if (/certified|certificate|databricks|azure|aws|google|date|issue|expir|valid|requirement|training|course|module/i.test(cleaned)) return false;

  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 5) return false;

  // Reject lines that are ALL CAPS longer than a typical name (likely a heading)
  if (cleaned === cleaned.toUpperCase() && wordCount > 3) return false;

  return true;
}

function looksLikeHumanName(line: string): boolean {
  const cleaned = line.trim();

  // Basic shape checks
  if (cleaned.length < 3 || cleaned.length > 40) return false;
  if (/\d/.test(cleaned)) return false;
  if (/[@#$%^&*_+=<>{}[\]|\\/]/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  // Reject obvious non-name content
  const blocklist = /certified|certificate|databricks|azure|aws|google|microsoft|date|issue|expir|valid|requirement|training|course|module|completion|professional|associate|engineer|architect|developer|specialist|fundamentals/i;
  if (blocklist.test(cleaned)) return false;

  // Every word should start with a capital letter, rest lowercase
  // (allows for hyphenated/apostrophe names: "Anne-Marie", "O'Brien")
  const namePattern = /^[A-Z][a-z'-]+$/;
  const allWordsLookLikeNameParts = words.every(w => namePattern.test(w));

  return allWordsLookLikeNameParts;
}

function findNameCandidates(rawLines: string[]) {
  return rawLines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => looksLikeHumanName(line));
}

function extractNameByShape(rawLines: string[]): string | null {
  const candidates = findNameCandidates(rawLines);
  if (candidates.length === 0) return null;

  // Prefer candidates in the first half of the document
  const topHalf = candidates.filter(c => c.index < rawLines.length / 2);
  const pool = topHalf.length > 0 ? topHalf : candidates;

  console.log(`[DocIntel] Shape matched: "${pool[0].line}"`);
  return pool[0].line;
}

function extractNameFallback(rawLines: string[]): string | null {
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();

    // Pattern A: name is on the line BEFORE this phrase, or before it on the SAME line
    const beforeMatch = NAME_BEFORE_PHRASES.find(p => lower.includes(p));
    if (beforeMatch) {
      // Try same line before the phrase first
      const index = lower.indexOf(beforeMatch);
      const sameLinePrefix = line.substring(0, index).trim();
      if (sameLinePrefix && isLikelyName(sameLinePrefix)) {
        console.log(`[DocIntel] Name matched (Pattern A same-line prefix, name-before-phrase: "${beforeMatch}"): "${sameLinePrefix}"`);
        return sameLinePrefix;
      }

      const candidate = rawLines[i - 1];
      if (candidate && isLikelyName(candidate)) {
        console.log(`[DocIntel] Name matched (Pattern A preceding line, name-before-phrase: "${beforeMatch}"): "${candidate}"`);
        return candidate.trim();
      }
    }

    // Pattern B: name is on the same line (after a colon/phrase) or the next line
    const afterMatch = NAME_AFTER_PHRASES.find(p => lower.includes(p));
    if (afterMatch) {
      const sameLineRemainder = line.split(new RegExp(afterMatch, "i"))[1]?.trim();
      const candidate = (sameLineRemainder && sameLineRemainder.length > 1)
        ? sameLineRemainder
        : rawLines[i + 1];
      if (candidate && isLikelyName(candidate)) {
        console.log(`[DocIntel] Name matched (Pattern B, name-after-phrase: "${afterMatch}"): "${candidate}"`);
        return candidate.trim();
      }
    }
  }

  return null;
}

async function extractNameWithNER(rawText: string): Promise<string | null> {
  const client = getTextClient();
  if (!client) {
    console.log('[DocIntel] NER fallback skipped: Azure AI Language credentials not configured.');
    return null;
  }

  try {
    const [result] = await client.recognizeEntities([rawText]);
    if (!result.error) {
      const personEntities = result.entities
        .filter(e => e.category === "Person" && e.confidenceScore > 0.6)
        .sort((a, b) => b.confidenceScore - a.confidenceScore);

      if (personEntities.length > 0) {
        console.log(`[DocIntel] NER SUCCESS: Found person entity: "${personEntities[0].text}" with score ${personEntities[0].confidenceScore}`);
        return personEntities[0].text.trim();
      }
    } else {
      console.error('[DocIntel] NER API error:', result.error);
    }
  } catch (err: any) {
    console.error('[DocIntel] Failed to extract name via NER:', err?.message);
  }
  return null;
}


export interface NameMatchResult {
  matches: boolean;    // true if fuzz score >= 80
  score: number;       // 0–100
  extractedName: string;
  memberName: string;
}

/** Cross-check extracted name against the assigned member's name */
export function checkNameMatch(extractedName: string, memberName: string): NameMatchResult {
  const score = fuzz.ratio(extractedName.toLowerCase(), memberName.toLowerCase());
  return { matches: score >= 80, score, extractedName, memberName };
}

export interface ExtractedCertificateFields {
  completionDate: string | null;
  expiryDate: string | null;
  credentialId: string | null;
  recipientName: string | null;
  recipientNameSource: 'labeled' | 'layout' | 'ner' | null;  // how we found the name
  rawLines: string[];
  rawFields: Record<string, string>;
}

export async function extractCertificateFields(fileBuffer: Buffer, mimeType: string): Promise<ExtractedCertificateFields> {
  const docClient = getClient();

  const poller = await docClient.beginAnalyzeDocument('prebuilt-document', fileBuffer);
  const result = await poller.pollUntilDone();

  const rawFields: Record<string, string> = {};
  let completionDate: string | null = null;
  let expiryDate: string | null = null;
  let credentialId: string | null = null;
  let recipientName: string | null = null;
  let recipientNameSource: 'labeled' | 'layout' | 'ner' | null = null;

  // ── Pass 1: labeled key-value pairs ──────────────────────────────────────
  for (const kv of result.keyValuePairs || []) {
    const key = (kv.key?.content || '').toLowerCase().trim();
    const value = (kv.value?.content || '').trim();
    if (!key || !value) continue;
    rawFields[kv.key?.content || key] = value;

    // Recipient name from labeled field
    if (!recipientName && (
      key.includes('awarded to') ||
      key.includes('presented to') ||
      key.includes('this certifies') ||
      key.includes('certify that') ||
      key === 'name'
    )) {
      recipientName = value;
      recipientNameSource = 'labeled';
    }

    // Completion / issue date
    if (!completionDate && matchesAnySynonym(key, COMPLETION_DATE_SYNONYMS)) {
      completionDate = normalizeDate(value);
    }

    // Expiry date
    if (!expiryDate && matchesAnySynonym(key, EXPIRY_DATE_SYNONYMS)) {
      expiryDate = normalizeDate(value);
    }

    // Credential ID
    if (!credentialId && (
      key.includes('credential')          || key.includes('certificate id') ||
      key.includes('cert id')             || key.includes('certification number') ||
      key.includes('badge id')            || key.includes('license number') ||
      key.includes('id number')           || key.includes('registration')
    )) {
      credentialId = value;
    }
  }

  // Raw text lines — used for fuzzy title matching and Pass 2 name extraction
  const rawLines = (result.content || '')
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 3 && l.length < 200);

  // Fall back to raw text scanning for missing dates
  if (!completionDate || !expiryDate) {
    const fallbackDates = extractDatesFromRawText(rawLines);
    if (!completionDate) completionDate = fallbackDates.completionDate;
    if (!expiryDate) expiryDate = fallbackDates.expiryDate;
  }

  // Log raw extracted lines for template diagnostics
  console.log("RAW LINES:", JSON.stringify(rawLines, null, 2));

  // ── Pass 2: layout fallback (phrase-based) for unlabeled / stylized name text ──
  if (!recipientName) {
    const nameFromLayout = extractNameFallback(rawLines);
    if (nameFromLayout) {
      recipientName = nameFromLayout;
      recipientNameSource = 'layout';
    }
  }

  // ── Pass 3: generic shape-based name fallback ────────────────────────────
  if (!recipientName) {
    const nameFromShape = extractNameByShape(rawLines);
    if (nameFromShape) {
      recipientName = nameFromShape;
      recipientNameSource = 'layout';
    }
  }

  // ── Pass 4: NER fallback for missing name ────────────────────────────────
  if (!recipientName) {
    const nameFromNER = await extractNameWithNER(result.content || '');
    if (nameFromNER) {
      recipientName = nameFromNER;
      recipientNameSource = 'ner';
    }
  }

  return { completionDate, expiryDate, credentialId, recipientName, recipientNameSource, rawLines, rawFields };
}
