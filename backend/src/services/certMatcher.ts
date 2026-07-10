// fuzzball doesn't have @types — declare minimal interface inline
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fuzz = require('fuzzball') as {
  ratio: (a: string, b: string) => number;
  partial_ratio: (a: string, b: string) => number;
  token_sort_ratio: (a: string, b: string) => number;
};

export interface CatalogEntry {
  id: string;
  name: string;
  provider: string;
}

export interface MatchResult {
  bestMatch: CatalogEntry | null;
  confidence: number;          // 0–100
  matchedLine: string | null;  // the raw line from the document that scored best
  suggestions: CatalogEntry[]; // certifications within 8 points of the top match
}

const CONFIDENCE_THRESHOLD = 75; // tightened auto-select threshold (used if clear winner)

function normalizeWords(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Score a single line against a catalog entry using multiple fuzz strategies
 * and word-level penalty adjustments for tier mismatches.
 */
function scoreTitleMatch(extractedLine: string, catalogTitle: string): number {
  const extractedWords = normalizeWords(extractedLine);
  const catalogWords = normalizeWords(catalogTitle);

  if (extractedWords.length === 0 || catalogWords.length === 0) return 0;

  // Base character-level similarity: take the best of ratio, partial_ratio, and token_sort_ratio
  const l = extractedLine.toLowerCase();
  const n = catalogTitle.toLowerCase();
  const ratio = fuzz.ratio(l, n);
  const partial = fuzz.partial_ratio(l, n);
  const tokenSort = fuzz.token_sort_ratio(l, n);
  const charScore = Math.max(ratio, partial, tokenSort);

  // Word-level overlap — how many catalog words actually appear in the extracted line
  const missingWords = catalogWords.filter(w => !extractedWords.includes(w));

  // The LAST word of a cert title is usually the level/tier
  // (Associate, Professional, Expert, Practitioner, etc.) — treat it as critical
  const lastWord = catalogWords[catalogWords.length - 1];
  const lastWordMatches = extractedWords.includes(lastWord);

  if (!lastWordMatches) {
    // Hard penalty: even if everything else matches, a different tier/level
    // means this is a DIFFERENT certification, not a fuzzy variant of the same one
    return charScore * 0.4; // knock the score down below acceptance threshold
  }

  if (missingWords.length > 0) {
    return charScore * 0.85; // minor penalty for other missing words
  }

  return charScore;
}

/**
 * Match all raw lines from a certificate against the certification catalog.
 * Returns the best-scoring entry, confidence, matched line, and suggestions.
 */
export function matchCertificateTitle(
  rawLines: string[],
  catalog: CatalogEntry[]
): MatchResult {
  console.log('[CertMatcher] Matching raw certificate text against catalog items...');
  
  // Track all catalog entries and their max score across all raw lines
  const entryScores = catalog.map(entry => {
    let maxScore = 0;
    let matchedLine: string | null = null;
    
    for (const line of rawLines) {
      if (line.length < 8) continue;
      const score = scoreTitleMatch(line, entry.name);
      if (score > maxScore) {
        maxScore = score;
        matchedLine = line;
      }
    }
    
    return { entry, score: maxScore, line: matchedLine };
  });

  // Sort entries by score descending
  entryScores.sort((a, b) => b.score - a.score);

  const topMatch = entryScores[0];
  const secondMatch = entryScores[1];

  console.log('[CertMatcher] Top Match Candidate:', topMatch ? `${topMatch.entry.name} (${topMatch.score.toFixed(1)}%) matched from line: "${topMatch.line}"` : 'None');
  console.log('[CertMatcher] Second Match Candidate:', secondMatch ? `${secondMatch.entry.name} (${secondMatch.score.toFixed(1)}%) matched from line: "${secondMatch.line}"` : 'None');

  // Gather suggestions with score >= 50, up to 5 items
  const suggestions = entryScores
    .filter(item => item.score >= 50)
    .slice(0, 5)
    .map(item => item.entry);

  let bestMatch: CatalogEntry | null = null;

  if (topMatch && topMatch.score >= CONFIDENCE_THRESHOLD) {
    const topScore = topMatch.score;
    const runnerUpScore = secondMatch ? secondMatch.score : 0;
    const scoreDiff = topScore - runnerUpScore;

    if (scoreDiff >= 8) {
      bestMatch = topMatch.entry;
      console.log(`[CertMatcher] Auto-selecting "${bestMatch.name}" (score difference: ${scoreDiff.toFixed(1)} is >= 8)`);
    } else {
      console.log(`[CertMatcher] Ambiguous match: Top score (${topScore.toFixed(1)}%) and runner-up score (${runnerUpScore.toFixed(1)}%) are too close (diff: ${scoreDiff.toFixed(1)} is < 8). Auto-selection skipped.`);
    }
  }

  return {
    bestMatch,
    confidence: topMatch ? Math.round(topMatch.score) : 0,
    matchedLine: topMatch ? topMatch.line : null,
    suggestions,
  };
}
