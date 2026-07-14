import fuzz from 'fuzzball';

export interface FuzzyMatchResult {
  matches: boolean;
  score: number;
  extractedName: string;
  memberId: string | null;
  memberName: string | null;
}

/**
 * Fuzzy matches an extracted name against a list of Team Members.
 * Returns the best match if the score is >= 70.
 */
export function matchTeamMember(
  extractedName: string,
  members: { id: string; name: string }[]
): FuzzyMatchResult {
  let bestScore = 0;
  let bestMember = null;
  const nameToMatch = extractedName.toLowerCase().trim();

  for (const m of members) {
    const mNameLower = m.name.toLowerCase().trim();
    // Use partial match boost if one string contains the other
    if (nameToMatch.includes(mNameLower) || mNameLower.includes(nameToMatch)) {
      const score = fuzz.ratio(nameToMatch, mNameLower);
      // Give a slight boost for substring containment
      const boostedScore = Math.min(100, score + 15);
      if (boostedScore > bestScore) {
        bestScore = boostedScore;
        bestMember = m;
      }
    } else {
      const score = fuzz.ratio(nameToMatch, mNameLower);
      if (score > bestScore) {
        bestScore = score;
        bestMember = m;
      }
    }
  }

  if (bestMember && bestScore >= 70) {
    return {
      matches: true,
      score: bestScore,
      extractedName,
      memberId: bestMember.id,
      memberName: bestMember.name,
    };
  }

  return {
    matches: false,
    score: bestScore,
    extractedName,
    memberId: null,
    memberName: null,
  };
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'our', 'did', 'was', 'who', 'has', 'but', 'not', 
  'are', 'with', 'his', 'her', 'they', 'them', 'him', 'she', 'how', 'out', 
  'this', 'that', 'these', 'those', 'can', 'will', 'would', 'should', 'could', 
  'get', 'put', 'set', 'run', 'use', 'make', 'take', 'come', 'go', 'give', 
  'find', 'talk', 'meet', 'tell', 'ask', 'work', 'call', 'file', 'task', 
  'date', 'time', 'week', 'month', 'year', 'day', 'open', 'close', 'need', 
  'must', 'been', 'have', 'had', 'having', 'about', 'from', 'then', 'them',
  'what', 'when', 'where', 'why', 'who', 'how', 'which', 'here', 'there',
  'log', 'its', 'their', 'only', 'some', 'more', 'than', 'into', 'just', 'your'
]);

export function correctNamesInTranscript(
  transcriptText: string,
  members: { id: string; name: string }[]
): { correctedText: string; corrections: { original: string; corrected: string; score: number }[] } {
  if (!transcriptText || !members || members.length === 0) {
    return { correctedText: transcriptText, corrections: [] };
  }

  // Pre-process member name parts
  const memberTargets = members.map(m => {
    const parts = m.name.split(/\s+/);
    return {
      member: m,
      fullNameLower: m.name.toLowerCase().trim(),
      firstNameLower: parts[0]?.toLowerCase().trim() || '',
      lastNameLower: parts[parts.length - 1]?.toLowerCase().trim() || ''
    };
  });

  // Split transcript into tokens, keeping delimiters
  const tokens = transcriptText.split(/(\b\w+\b)/);
  const corrections: { original: string; corrected: string; score: number }[] = [];

  for (let i = 1; i < tokens.length; i += 2) {
    const word1 = tokens[i];
    if (!word1) continue;

    // 1. Try adjacent two-word match first (full name match)
    if (i + 2 < tokens.length) {
      const separator = tokens[i + 1];
      const word2 = tokens[i + 2];
      // Only merge if separator is whitespace
      if (separator && /^\s+$/.test(separator) && word2) {
        const twoWords = `${word1} ${word2}`;
        const twoWordsClean = twoWords.toLowerCase().trim();

        let bestScore = 0;
        let bestTarget = null;

        for (const target of memberTargets) {
          const score = fuzz.ratio(twoWordsClean, target.fullNameLower);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
          }
        }

        if (bestTarget && bestScore >= 80) {
          // If the match is not already exact, log and correct it
          if (twoWordsClean !== bestTarget.fullNameLower) {
            corrections.push({
              original: twoWords,
              corrected: bestTarget.member.name,
              score: bestScore
            });
          }
          // Replace both words and the separator
          tokens[i] = bestTarget.member.name;
          tokens[i + 1] = '';
          tokens[i + 2] = '';
          i += 2; // skip the next word token
          continue;
        }
      }
    }

    // 2. Try single-word match
    const wordClean = word1.toLowerCase().trim();
    if (wordClean.length < 3 || STOPWORDS.has(wordClean)) {
      continue;
    }

    let bestScore = 0;
    let bestTarget = null;

    for (const target of memberTargets) {
      // Match against first name
      if (target.firstNameLower) {
        const score = fuzz.ratio(wordClean, target.firstNameLower);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = { name: target.member.name, clean: target.firstNameLower };
        }
      }
      // Match against last name (only if it's not a common stopword)
      if (target.lastNameLower && target.lastNameLower.length >= 3 && !STOPWORDS.has(target.lastNameLower)) {
        const score = fuzz.ratio(wordClean, target.lastNameLower);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = { name: target.member.name, clean: target.lastNameLower };
        }
      }
    }

    if (bestTarget && bestScore >= 82) {
      if (wordClean !== bestTarget.clean) {
        corrections.push({
          original: word1,
          corrected: bestTarget.name,
          score: bestScore
        });
      }
      tokens[i] = bestTarget.name;
    }
  }

  return {
    correctedText: tokens.join(''),
    corrections
  };
}
