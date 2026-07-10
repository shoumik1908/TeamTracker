import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { parse, isValid } from 'date-fns';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fuzz = require('fuzzball') as { ratio: (a: string, b: string) => number };

const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT || '';
const apiKey = process.env.AZURE_DOC_INTEL_KEY || '';

let client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (!client) {
    if (!endpoint || !apiKey) {
      throw new Error('Azure Document Intelligence credentials not configured.');
    }
    client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));
  }
  return client;
}

export function isConfigured(): boolean {
  return !!(process.env.AZURE_DOC_INTEL_ENDPOINT && process.env.AZURE_DOC_INTEL_KEY);
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

// Pass 2 — trigger phrases for name AFTER trigger
const TRIGGER_PHRASES = [
  'certifies that',
  'this certifies that',
  'presented to',
  'awarded to',
  'this is to certify that',
  'is hereby awarded to',
  'congratulations to',
  'is presented to',
];

// Pass 2 — phrases indicating name appears BEFORE trigger
const COMPLETION_PHRASES = [
  'has successfully completed',
  'has completed the requirements',
  'successfully completed',
  'completed the requirements to',
  'has successfully completed the',
];

function isValidNameCandidate(name: string): boolean {
  const trimmed = name.trim();
  // 1. Cannot contain digits
  if (/\d/.test(trimmed)) return false;
  // 2. Length check: between 2 and 40 characters
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  // 3. Word count: must contain 2 to 4 words
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // 4. Exclude noise/technical words
  const noiseWords = [
    'certified', 'certification', 'certificate', 'date', 'issue', 'expir',
    'page', 'successful', 'completion', 'obtained', 'requirements', 'course',
    'program', 'pathway', 'university', 'institute', 'academy', 'credentials',
    'verification', 'verify', 'signature', 'id', 'score', 'percent', 'exam',
    'administrator', 'instructor', 'ceo', 'president', 'director', 'vice'
  ];
  const lower = trimmed.toLowerCase();
  for (const word of noiseWords) {
    if (lower.includes(word)) return false;
  }
  return true;
}

function extractNameFromLines(lines: string[]): string | null {
  console.log('[DocIntel] Running name extraction layout scans on raw text lines:', lines);

  // 1. First run Pattern A (Name BEFORE completion phrase)
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const phrase of COMPLETION_PHRASES) {
      if (lower.includes(phrase)) {
        console.log(`[DocIntel] Pattern A: Found completion phrase "${phrase}" at line ${i}: "${lines[i]}"`);
        // Check the line immediately before
        if (i > 0) {
          const candidate = lines[i - 1].trim();
          console.log(`[DocIntel] Pattern A candidate (line ${i-1}): "${candidate}"`);
          if (isValidNameCandidate(candidate)) {
            console.log(`[DocIntel] Pattern A SUCCESS: Valid candidate found: "${candidate}"`);
            return candidate;
          } else {
            console.log(`[DocIntel] Pattern A FAILED: Candidate "${candidate}" is invalid`);
          }
        }
      }
    }
  }

  // 2. Fallback to Pattern B (Name AFTER / SAME LINE as trigger phrase)
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const phrase of TRIGGER_PHRASES) {
      if (lower.includes(phrase)) {
        console.log(`[DocIntel] Pattern B: Found trigger phrase "${phrase}" at line ${i}: "${lines[i]}"`);
        
        // Try same line after phrase first
        const afterPhrase = lines[i].split(new RegExp(phrase, 'i'))[1]?.trim();
        if (afterPhrase) {
          const cleanedSameLine = afterPhrase.replace(/^(that\s+)/i, '').trim();
          console.log(`[DocIntel] Pattern B same-line candidate: "${cleanedSameLine}"`);
          if (isValidNameCandidate(cleanedSameLine)) {
            console.log(`[DocIntel] Pattern B SUCCESS: Valid same-line candidate found: "${cleanedSameLine}"`);
            return cleanedSameLine;
          }
        }

        // Try the lines immediately following (up to 2 lines down)
        for (let nextOffset = 1; nextOffset <= 2; nextOffset++) {
          const nextIndex = i + nextOffset;
          if (nextIndex < lines.length) {
            const nextLine = lines[nextIndex].trim();
            console.log(`[DocIntel] Pattern B next-line candidate (+${nextOffset}): "${nextLine}"`);
            if (isValidNameCandidate(nextLine)) {
              console.log(`[DocIntel] Pattern B SUCCESS: Valid next-line candidate found: "${nextLine}"`);
              return nextLine;
            }
          }
        }
      }
    }
  }

  console.log('[DocIntel] Layout name extraction scan returned no valid candidates.');
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
  recipientNameSource: 'labeled' | 'layout' | null;  // how we found the name
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
  let recipientNameSource: 'labeled' | 'layout' | null = null;

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
    if (!completionDate && (
      key.includes('completion') || key.includes('completed') ||
      key.includes('issued')     || key.includes('issue date') ||
      key.includes('date of')    || key.includes('award') ||
      key.includes('achieved')   || key.includes('passed') ||
      key.includes('granted')
    )) {
      completionDate = normalizeDate(value);
    }

    // Expiry date
    if (!expiryDate && (
      key.includes('expir')        || key.includes('valid until') ||
      key.includes('valid thru')   || key.includes('valid through') ||
      key.includes('expires')      || key.includes('renewal') ||
      key.includes('renew by')     || key.includes('valid to')
    )) {
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

  // ── Pass 2: layout fallback for unlabeled / stylized name text ────────────
  if (!recipientName) {
    const nameFromLayout = extractNameFromLines(rawLines);
    if (nameFromLayout) {
      recipientName = nameFromLayout;
      recipientNameSource = 'layout';
    }
  }

  return { completionDate, expiryDate, credentialId, recipientName, recipientNameSource, rawLines, rawFields };
}
