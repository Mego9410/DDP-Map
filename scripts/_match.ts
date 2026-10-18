// Fuzzy name matching shared by the photo and pin importers.

const STOP = new Set(['the', 'and', 'of', 'a', 'at', 'by', 'de', 'la', 'le', 'les', 'cafe', 'café', 'co', 'inn', 'starbucks']);

export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function nameTokens(name: string): string[] {
  return fold(name)
    .replace(/['’]s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** 0..1: share of the name's distinctive words found in `haystack`. */
export function matchScore(name: string, haystack: string): number {
  const tokens = nameTokens(name);
  if (!tokens.length) return 0;
  const hay = fold(haystack);
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits / tokens.length;
}

/**
 * Two-way similarity of two place names: how much of ours is in theirs,
 * averaged with how much of theirs is in ours, so "Connections Café" prefers
 * an OSM "Connections Cafe" over "Connections Eatery". `forward` alone must
 * clear the caller's threshold.
 */
export function nameSimilarity(ours: string, theirs: string): { forward: number; score: number } {
  const forward = matchScore(ours, theirs);
  const backward = matchScore(theirs, ours);
  return { forward, score: (forward + backward) / 2 };
}
