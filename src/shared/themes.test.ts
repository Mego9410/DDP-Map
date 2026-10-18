import { describe, expect, it } from 'vitest';
import { THEMES, THEME_BY_ID, contrastRatio } from './themes.js';
import { seedData } from '../test/seedData';

describe('themes', () => {
  it.each(THEMES.map((t) => [t.id, t] as const))('%s body text passes WCAG AA (4.5:1)', (_id, theme) => {
    expect(contrastRatio(theme.tokens.ink, theme.tokens.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s muted text passes AA for large text (3:1)', (_id, theme) => {
    expect(contrastRatio(theme.tokens.muted, theme.tokens.bg)).toBeGreaterThanOrEqual(3);
  });

  it('every location renders in a known theme', () => {
    for (const l of seedData().locations) {
      expect(l.theme_id, l.id).toBeTruthy();
      expect(THEME_BY_ID[l.theme_id!], `${l.id} -> ${l.theme_id}`).toBeDefined();
    }
  });

  it('theme ids are unique', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it('contrastRatio is symmetric and bounded', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });
});
