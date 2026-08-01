/**
 * Vector Store
 * 
 * In-memory vector store for sentence embeddings.
 * Used by the Semantic Similarity Agent for fast nearest-neighbor search.
 * Can be replaced with Pinecone/Weaviate/ChromaDB in production.
 */

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  add(entry: VectorEntry): void {
    this.entries.push(entry);
  }

  addBatch(entries: VectorEntry[]): void {
    this.entries.push(...entries);
  }

  search(queryVector: number[], topK: number = 5): Array<VectorEntry & { score: number }> {
    const scored = this.entries.map(entry => ({
      ...entry,
      score: this.cosineSimilarity(queryVector, entry.vector),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    return this.entries.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

/**
 * Simple TF-IDF based vectorizer for text.
 * Converts text into a numerical vector for similarity comparison.
 */
export class TextVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();

  fit(documents: string[]): void {
    const df: Map<string, number> = new Map();
    const vocabSet = new Set<string>();

    for (const doc of documents) {
      const words = this.tokenize(doc);
      const uniqueWords = new Set(words);

      for (const word of uniqueWords) {
        vocabSet.add(word);
        df.set(word, (df.get(word) || 0) + 1);
      }
    }

    // Build vocabulary index
    let idx = 0;
    for (const word of vocabSet) {
      this.vocabulary.set(word, idx++);
    }

    // Calculate IDF
    const numDocs = documents.length;
    for (const [word, count] of df) {
      this.idf.set(word, Math.log(numDocs / count));
    }
  }

  transform(text: string): number[] {
    const words = this.tokenize(text);
    const vector = new Array(this.vocabulary.size).fill(0);

    // Calculate TF
    const tf: Map<string, number> = new Map();
    for (const word of words) {
      tf.set(word, (tf.get(word) || 0) + 1);
    }

    // Build TF-IDF vector
    for (const [word, count] of tf) {
      const idx = this.vocabulary.get(word);
      if (idx !== undefined) {
        const termFreq = count / words.length;
        const idfScore = this.idf.get(word) || 0;
        vector[idx] = termFreq * idfScore;
      }
    }

    return vector;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
}
