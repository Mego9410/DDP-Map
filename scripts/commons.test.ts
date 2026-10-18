import { describe, expect, it } from 'vitest';
import { attributionFor, licenseOf, matchScore, nameTokens, pickCandidates, stripHtml, type CommonsPage } from './_commons.js';

const meta = (license: string, short: string, artist = '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>') => ({
  License: { value: license },
  LicenseShortName: { value: short },
  Artist: { value: artist },
  ImageDescription: { value: '' },
});

function page(title: string, m: ReturnType<typeof meta>, over: Partial<NonNullable<CommonsPage['imageinfo']>[0]> = {}): CommonsPage {
  return {
    title,
    imageinfo: [{
      url: `https://upload.wikimedia.org/${encodeURIComponent(title)}`,
      thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}/1280px.jpg`,
      descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      width: 3000, height: 2000, mime: 'image/jpeg', extmetadata: m, ...over,
    }],
  };
}

describe('commons helpers', () => {
  it('tokenises names without filler words', () => {
    expect(nameTokens("Pecos Bill Tall Tale Inn and Cafe")).toEqual(['pecos', 'bill', 'tall', 'tale']);
    expect(nameTokens("Cosmic Ray's Starlight Café")).toEqual(['cosmic', 'ray', 'starlight']);
  });

  it('scores the share of distinctive words present', () => {
    expect(matchScore("Cosmic Ray's Starlight Café", "File:Cosmic Ray's Starlight Cafe, Magic Kingdom.jpg")).toBe(1);
    expect(matchScore('Pecos Bill Tall Tale Inn and Cafe', 'File:Pecos Bill restaurant.jpg')).toBe(0.5);
  });

  it('accepts only licences that allow storing with credit', () => {
    expect(licenseOf(meta('cc-by-sa-4.0', 'CC BY-SA 4.0'))?.label).toBe('CC BY-SA 4.0');
    expect(licenseOf(meta('cc0', 'CC0'))).not.toBeNull();
    expect(licenseOf(meta('pd', 'Public domain'))).not.toBeNull();
    expect(licenseOf(meta('cc-by-nc-2.0', 'CC BY-NC 2.0'))).toBeNull();
    expect(licenseOf(meta('', 'Fair use'))).toBeNull();
  });

  it('builds a plain-text credit line', () => {
    expect(attributionFor(meta('cc-by-2.0', 'CC BY 2.0'), 'CC BY 2.0')).toBe('Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons');
    expect(stripHtml('<span>A &amp; B</span>')).toBe('A & B');
  });

  it('ranks matching free photos and drops logos, small, non-free and unrelated files', () => {
    const pages = [
      page("File:Cosmic Ray's Starlight Cafe.jpg", meta('cc-by-sa-3.0', 'CC BY-SA 3.0')),
      page("File:Cosmic Ray's logo.png", meta('cc-by-sa-3.0', 'CC BY-SA 3.0'), { mime: 'image/png' }),
      page("File:Cosmic Ray's tiny.jpg", meta('cc-by-sa-3.0', 'CC BY-SA 3.0'), { width: 640, height: 480 }),
      page("File:Cosmic Ray's Starlight Cafe interior.jpg", meta('cc-by-nc-2.0', 'CC BY-NC 2.0')),
      page('File:Space Mountain.jpg', meta('cc-by-2.0', 'CC BY 2.0')),
      page("File:Cosmic Rays Starlight Cafe portrait.jpg", meta('cc0', 'CC0'), { width: 1500, height: 2400 }),
    ];
    const picks = pickCandidates(["Cosmic Ray's Starlight Café", "Cosmic Ray's"], pages);
    expect(picks.map((p) => p.title)).toEqual(["File:Cosmic Ray's Starlight Cafe.jpg", 'File:Cosmic Rays Starlight Cafe portrait.jpg']);
    expect(picks[0].image_url).toContain('1280px');
    expect(picks[0].attribution).toBe('Photo: Jane Doe, CC BY-SA 3.0, via Wikimedia Commons');
  });

  it('short names rescue long official names', () => {
    const pages = [page('File:Pecos Bill Cafe Frontierland.jpg', meta('cc-by-2.0', 'CC BY 2.0'))];
    expect(pickCandidates(['Pecos Bill Tall Tale Inn and Cafe'], pages)).toHaveLength(0);
    expect(pickCandidates(['Pecos Bill Tall Tale Inn and Cafe', 'Pecos Bill'], pages)).toHaveLength(1);
  });
});
