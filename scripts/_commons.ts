// Pure helpers for picking freely licensed Wikimedia Commons photos of a
// restaurant. Network code lives in scripts/photos.ts; this file is tested.

export interface CommonsPage {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

export interface Candidate {
  title: string;
  image_url: string;
  source_url: string;
  license: string;
  attribution: string;
  score: number;
  width: number;
  height: number;
}

/** Licences that allow storing and showing the image with a credit line. */
const FREE_LICENSE = /^(cc-by(-sa)?-\d(\.\d)?(-[a-z]+)?|cc0|pd|public domain)$/i;

const STOP = new Set(['the', 'and', 'of', 'a', 'at', 'by', 'de', 'la', 'le', 'les', 'cafe', 'café', 'co', 'inn', 'starbucks']);

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function nameTokens(name: string): string[] {
  return fold(name)
    .replace(/['’]s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** 0..1: share of the restaurant's distinctive words found in the file title/description. */
export function matchScore(name: string, haystack: string): number {
  const tokens = nameTokens(name);
  if (!tokens.length) return 0;
  const hay = fold(haystack);
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits / tokens.length;
}

export function licenseOf(meta: Record<string, { value: string } | undefined>): { code: string; label: string } | null {
  const code = stripHtml(meta.License?.value ?? '').toLowerCase();
  const label = stripHtml(meta.LicenseShortName?.value ?? '');
  if (FREE_LICENSE.test(code)) return { code, label: label || code.toUpperCase() };
  if (/^public domain$/i.test(label) || /^cc0/i.test(label)) return { code: code || 'pd', label };
  return null;
}

export function attributionFor(meta: Record<string, { value: string } | undefined>, license: string): string {
  const artist = stripHtml(meta.Artist?.value ?? '') || stripHtml(meta.Credit?.value ?? '') || 'Unknown author';
  return `Photo: ${artist.slice(0, 120)}, ${license}, via Wikimedia Commons`;
}

const REJECT_TITLE = /\b(logo|map|menu|sign(age)?|ticket|receipt|wordmark|icon|svg)\b/i;

/**
 * Turns a Commons search response into ranked candidates for one restaurant:
 * freely licensed raster photos at least 800px wide whose title or
 * description names the place (full or short name). `minScore` guards against near-misses.
 */
export function pickCandidates(names: string[], pages: CommonsPage[], minScore = 0.67): Candidate[] {
  const out: Candidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || ii.width < 800) continue;
    if (REJECT_TITLE.test(p.title)) continue;
    const meta = ii.extmetadata ?? {};
    const lic = licenseOf(meta);
    if (!lic) continue;
    const desc = stripHtml(meta.ImageDescription?.value ?? '') + ' ' + stripHtml(meta.ObjectName?.value ?? '');
    const score = Math.max(...names.map((n) => Math.max(matchScore(n, p.title), matchScore(n, desc) * 0.9)));
    if (score < minScore) continue;
    // Prefer landscape shots (they fill the hero) and higher scores.
    const shape = ii.width >= ii.height ? 0.1 : 0;
    out.push({
      title: p.title,
      image_url: ii.thumburl ?? ii.url,
      source_url: ii.descriptionurl,
      license: lic.label,
      attribution: attributionFor(meta, lic.label),
      score: Math.round((score + shape) * 100) / 100,
      width: ii.width,
      height: ii.height,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.width - a.width);
}
