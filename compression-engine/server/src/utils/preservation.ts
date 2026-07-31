/**
 * Preservation rules — decides how strongly to protect each sentence
 * from removal during compression.
 *
 * Uses a STRENGTH-based system rather than binary protection so we can still
 * achieve strong compression on rich prompts while never dropping the most
 * critical content:
 *
 *   - STRONG (1.0): question, critical keyword, error content, code block
 *     → Never remove, regardless of compression level.
 *   - MEDIUM (0.6): unique named entity, numeric data, URL/path
 *     → Removed only under aggressive compression.
 *   - WEAK (0.3): reasoning marker alone, code identifier
 *     → Freely compressible if importance is low.
 *   - NONE (0): no protective markers
 *     → Always eligible for removal.
 *
 * This is combined with the importance-scoring layer to decide final filtering.
 */

const CRITICAL_KEYWORDS = [
  'must', 'must not', 'do not', 'never', 'always',
  'critical', 'required', 'mandatory', 'forbidden',
  'warning', 'error', 'caution', 'danger',
];

const REASONING_MARKERS = /\b(because|therefore|thus|hence|consequently|however|although|unless|otherwise|instead)\b/i;
const NAMED_ENTITY = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)+\b/;
const CODE_IDENT = /\b[a-z]+[A-Z]\w+\b|\b[A-Z][a-z]+[A-Z]\w+\b|\b\w+_\w+\b/;
const NUMBER_DATA = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|USD|EUR|kg|km|mb|gb|hz|ms|s|min|hrs?|days?))\b/i;
const URL_OR_PATH = /https?:\/\/\S+|\/\w+[\w/.-]+|\b\w+\.(?:com|org|net|io|dev|ai|txt|pdf|json|csv|md|py|js|ts|java|cpp|log)\b/i;
const QUESTION = /\?\s*$/;
const CODE_BLOCK = /```|`\S+`|^\s*(?:def|function|class|import|const|let|var|for|while|if|return|export)\s/m;

export type PreservationStrength = 'strong' | 'medium' | 'weak' | 'none';

export interface PreservationVerdict {
  strength: PreservationStrength;
  score: number;         // numeric weight 0-1
  reasons: string[];
}

const STRENGTH_SCORE: Record<PreservationStrength, number> = {
  strong: 1.0,
  medium: 0.6,
  weak: 0.3,
  none: 0,
};

/**
 * Analyze a sentence and rank its protection strength.
 * The strongest signal wins; multiple weak signals don't stack up to strong.
 */
export function evaluatePreservation(sentence: string): PreservationVerdict {
  const reasons: string[] = [];
  let strength: PreservationStrength = 'none';

  if (!sentence || sentence.trim().length === 0) {
    return { strength: 'none', score: 0, reasons: ['empty'] };
  }

  const lower = sentence.toLowerCase();

  // STRONG signals — critical content, always keep
  if (QUESTION.test(sentence.trim())) {
    reasons.push('question');
    strength = 'strong';
  }
  if (CODE_BLOCK.test(sentence)) {
    reasons.push('code_block');
    strength = 'strong';
  }
  if (/\b(exception|traceback|panic|fatal|failed to)\b/i.test(sentence)) {
    reasons.push('error_content');
    strength = 'strong';
  }
  for (const kw of CRITICAL_KEYWORDS) {
    // Require critical keyword to actually mean "critical" — check for it as a
    // standalone word rather than a substring match.
    const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(sentence)) {
      reasons.push(`keyword:${kw}`);
      strength = 'strong';
      break;
    }
  }

  // MEDIUM signals — high-value content, keep unless very aggressive compression
  if (strength === 'none') {
    if (NAMED_ENTITY.test(sentence)) {
      reasons.push('named_entity');
      strength = 'medium';
    }
    if (NUMBER_DATA.test(sentence)) {
      reasons.push('numeric_data');
      strength = 'medium';
    }
    if (URL_OR_PATH.test(sentence)) {
      reasons.push('url_or_path');
      strength = 'medium';
    }
  }

  // WEAK signals — nice to keep, but removable if importance is low
  if (strength === 'none') {
    if (REASONING_MARKERS.test(sentence)) {
      reasons.push('reasoning_marker');
      strength = 'weak';
    }
    if (CODE_IDENT.test(sentence)) {
      reasons.push('code_identifier');
      strength = 'weak';
    }
  }

  return { strength, score: STRENGTH_SCORE[strength], reasons };
}

/**
 * Decide whether a sentence should be preserved at a given compression target.
 * Higher target = more aggressive compression = fewer sentences preserved.
 *
 * Rules:
 *   - Strong → always preserved
 *   - Medium → preserved unless target > 0.75 (aggressive) AND importance is low
 *   - Weak   → preserved only if target < 0.5 AND importance is moderate
 *   - None   → never preserved by this layer (relies on importance alone)
 */
export function shouldPreserve(
  strength: PreservationStrength,
  target: number,
  importance: number = 0.5
): boolean {
  switch (strength) {
    case 'strong':
      return true;
    case 'medium':
      // At very high compression, allow removal if importance is very low
      if (target >= 0.85 && importance < 0.25) return false;
      return true;
    case 'weak':
      // Preserve only at low compression or moderate importance
      if (target >= 0.7) return false;
      return importance >= 0.4;
    case 'none':
      return false;
  }
}
