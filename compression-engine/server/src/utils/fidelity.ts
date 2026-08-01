/**
 * Reasoning Fidelity Score.
 *
 * Compares two LLM completions and returns a similarity score (0-1) representing
 * how semantically equivalent the two responses are. Used to verify that a
 * compressed prompt still produced substantially the same answer as the original.
 *
 * Uses TF-IDF cosine similarity over key terms, plus entity preservation
 * and structural comparison. No embeddings/external calls — runs locally.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'and', 'or',
  'but', 'if', 'not', 'so', 'this', 'that', 'it', 'its', 'i', 'you', 'we', 'they',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Cosine similarity over TF-IDF vectors (rarity-weighted). */
function tfidfCosine(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const df = new Map<string, number>();
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  for (const t of aSet) df.set(t, (df.get(t) || 0) + 1);
  for (const t of bSet) df.set(t, (df.get(t) || 0) + 1);

  const buildVec = (tokens: string[]): Map<string, number> => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map<string, number>();
    for (const [t, count] of tf) {
      const idf = Math.log(2 / (df.get(t) || 1));
      vec.set(t, (count / tokens.length) * (idf + 1));
    }
    return vec;
  };

  const aVec = buildVec(aTokens);
  const bVec = buildVec(bTokens);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [t, v] of aVec) {
    dot += v * (bVec.get(t) || 0);
    normA += v * v;
  }
  for (const [, v] of bVec) normB += v * v;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** Extract capitalized entities and technical identifiers from text. */
function extractEntities(text: string): Set<string> {
  const entities = new Set<string>();
  // Multi-word capitalized names
  const names = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
  if (names) names.forEach((n) => entities.add(n.toLowerCase()));
  // Numbers and dates
  const numbers = text.match(/\b\d+(?:\.\d+)?\b/g);
  if (numbers) numbers.forEach((n) => entities.add(n));
  // Camel/PascalCase identifiers
  const idents = text.match(/\b[a-z]+[A-Z]\w+\b|\b[A-Z][a-z]+[A-Z]\w+\b/g);
  if (idents) idents.forEach((i) => entities.add(i.toLowerCase()));
  return entities;
}

function entityPreservation(a: string, b: string): number {
  const eA = extractEntities(a);
  const eB = extractEntities(b);
  if (eA.size === 0) return 1;
  let matched = 0;
  for (const e of eA) if (eB.has(e)) matched++;
  return matched / eA.size;
}

export interface FidelityBreakdown {
  score: number;             // 0-1 overall fidelity
  cosineSimilarity: number;  // TF-IDF cosine
  entityPreservation: number; // named-entity retention
  lengthRatio: number;       // relative response length
  verdict: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Compute reasoning fidelity between two LLM outputs.
 * A high score means the compressed prompt produced the same answer.
 */
export function computeFidelity(originalOutput: string, compressedOutput: string): FidelityBreakdown {
  if (!originalOutput.trim() || !compressedOutput.trim()) {
    return {
      score: 0,
      cosineSimilarity: 0,
      entityPreservation: 0,
      lengthRatio: 0,
      verdict: 'poor',
    };
  }

  const cosine = tfidfCosine(originalOutput, compressedOutput);
  const entities = entityPreservation(originalOutput, compressedOutput);
  const lenRatio = Math.min(compressedOutput.length, originalOutput.length) /
                   Math.max(compressedOutput.length, originalOutput.length);

  // Weighted score: cosine dominates, entities and length ratio add nuance
  const score = Math.max(0, Math.min(1,
    cosine * 0.6 + entities * 0.25 + lenRatio * 0.15
  ));

  let verdict: FidelityBreakdown['verdict'];
  if (score >= 0.85) verdict = 'excellent';
  else if (score >= 0.7) verdict = 'good';
  else if (score >= 0.55) verdict = 'fair';
  else verdict = 'poor';

  return {
    score,
    cosineSimilarity: cosine,
    entityPreservation: entities,
    lengthRatio: lenRatio,
    verdict,
  };
}
