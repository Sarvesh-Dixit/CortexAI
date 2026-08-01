export class TokenOptimizer {
  optimize(text: string, target: number): string {
    let result = text;

    // Normalize whitespace
    result = result.replace(/[ \t]+/g, ' ');
    result = result.replace(/\n{3,}/g, '\n\n');

    // Replace common long words with shorter equivalents
    if (target >= 0.4) {
      result = this.shortenWords(result);
    }

    // Contract verb phrases
    if (target >= 0.5) {
      result = this.contractVerbs(result);
    }

    // Remove unnecessary punctuation
    if (target >= 0.6) {
      result = this.optimizePunctuation(result);
    }

    // Abbreviate common terms
    if (target >= 0.7) {
      result = this.abbreviateTerms(result);
    }

    // Final cleanup
    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(/ \n/g, '\n');
    result = result.replace(/\n /g, '\n');

    return result;
  }

  private shortenWords(text: string): string {
    const replacements: Record<string, string> = {
      'approximately': 'approx',
      'configuration': 'config',
      'documentation': 'docs',
      'implementation': 'impl',
      'functionality': 'function',
      'infrastructure': 'infra',
      'communication': 'comms',
      'authentication': 'auth',
      'authorization': 'authz',
      'environment': 'env',
      'application': 'app',
      'information': 'info',
      'development': 'dev',
      'production': 'prod',
      'repository': 'repo',
      'directory': 'dir',
      'parameter': 'param',
      'temporary': 'temp',
      'administrator': 'admin',
      'specification': 'spec',
      'requirements': 'reqs',
      'performance': 'perf',
      'demonstrate': 'demo',
      'introduction': 'intro',
      'continuous': 'cont',
      'integration': 'integ',
    };

    let result = text;
    for (const [long, short] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${long}\\b`, 'gi');
      result = result.replace(regex, short);
    }

    return result;
  }

  private contractVerbs(text: string): string {
    const contractions: Array<[RegExp, string]> = [
      [/\bdo not\b/gi, "don't"],
      [/\bcannot\b/gi, "can't"],
      [/\bwill not\b/gi, "won't"],
      [/\bshould not\b/gi, "shouldn't"],
      [/\bwould not\b/gi, "wouldn't"],
      [/\bcould not\b/gi, "couldn't"],
      [/\bdoes not\b/gi, "doesn't"],
      [/\bhave not\b/gi, "haven't"],
      [/\bhas not\b/gi, "hasn't"],
      [/\bhad not\b/gi, "hadn't"],
      [/\bis not\b/gi, "isn't"],
      [/\bare not\b/gi, "aren't"],
      [/\bwas not\b/gi, "wasn't"],
      [/\bwere not\b/gi, "weren't"],
      [/\bit is\b/gi, "it's"],
      [/\bthat is\b/gi, "that's"],
      [/\bwhat is\b/gi, "what's"],
      [/\bthere is\b/gi, "there's"],
      [/\bI am\b/g, "I'm"],
      [/\bI have\b/g, "I've"],
      [/\bI will\b/g, "I'll"],
      [/\bI would\b/g, "I'd"],
      [/\bthey are\b/gi, "they're"],
      [/\bwe are\b/gi, "we're"],
      [/\byou are\b/gi, "you're"],
      [/\bthey have\b/gi, "they've"],
      [/\bwe have\b/gi, "we've"],
      [/\byou have\b/gi, "you've"],
    ];

    let result = text;
    for (const [pattern, replacement] of contractions) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private optimizePunctuation(text: string): string {
    let result = text;

    // Remove excessive exclamation/question marks
    result = result.replace(/!{2,}/g, '!');
    result = result.replace(/\?{2,}/g, '?');

    // Remove parenthetical asides if short
    result = result.replace(/\s*\([^)]{1,20}\)\s*/g, ' ');

    // Remove em-dashes with surrounding clauses if short
    result = result.replace(/\s*—[^—]{1,30}—\s*/g, ' ');

    return result;
  }

  private abbreviateTerms(text: string): string {
    const abbreviations: Record<string, string> = {
      'for example': 'e.g.',
      'that is to say': 'i.e.',
      'and so on': 'etc.',
      'and others': 'et al.',
      'in other words': 'i.e.',
      'with reference to': 're:',
      'as soon as possible': 'ASAP',
      'by the way': 'BTW',
      'versus': 'vs',
      'compared to': 'vs',
      'and et cetera': 'etc.',
    };

    let result = text;
    for (const [full, abbr] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, abbr);
    }

    return result;
  }
}
