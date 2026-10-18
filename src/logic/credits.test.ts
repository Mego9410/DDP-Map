import { describe, expect, it } from 'vitest';
import { badgeFor, matchesCreditFilter, snackSellers, type CreditFilter } from './credits';
import { seedData } from '../test/seedData';

const item = (section: 'entree' | 'kids' | 'snack' | 'drink', qs: 'yes' | 'no' | 'unknown', snack: 'yes' | 'no' | 'unknown') => ({
  section,
  qs_eligible: qs,
  snack_eligible: snack,
});

describe('badgeFor', () => {
  it('not-on-plan location is always cash only', () => {
    expect(badgeFor({ credit: 'none' }, item('entree', 'yes', 'yes')).kind).toBe('cash');
    expect(badgeFor({ credit: 'none' }, item('snack', 'no', 'yes')).kind).toBe('cash');
  });

  it('QS entrée costs one QS credit', () => {
    expect(badgeFor({ credit: 'quick_service' }, item('entree', 'yes', 'unknown'))).toEqual({ kind: 'qs', label: '1 QS credit' });
  });

  it('QS kids meal shows the age range', () => {
    expect(badgeFor({ credit: 'quick_service' }, item('kids', 'yes', 'unknown')).label).toBe('1 QS credit (ages 3–9)');
  });

  it('QS entrée with unconfirmed eligibility asks to check the symbol', () => {
    expect(badgeFor({ credit: 'quick_service' }, item('entree', 'unknown', 'unknown')).kind).toBe('check');
    expect(badgeFor({ credit: 'quick_service' }, item('kids', 'unknown', 'no')).kind).toBe('check');
  });

  it('QS entrée marked not eligible falls through to snack rules', () => {
    expect(badgeFor({ credit: 'quick_service' }, item('entree', 'no', 'yes')).kind).toBe('snack');
    expect(badgeFor({ credit: 'quick_service' }, item('entree', 'no', 'unknown')).kind).toBe('cash');
    expect(badgeFor({ credit: 'quick_service' }, item('entree', 'no', 'no')).kind).toBe('cash');
  });

  it('snack and drink items follow the snack flag', () => {
    for (const credit of ['quick_service', 'snack'] as const) {
      expect(badgeFor({ credit }, item('snack', 'no', 'yes')).kind).toBe('snack');
      expect(badgeFor({ credit }, item('drink', 'no', 'unknown')).kind).toBe('check');
      expect(badgeFor({ credit }, item('snack', 'no', 'no')).kind).toBe('cash');
    }
  });

  it('entrée at a snack-only location is not a QS credit', () => {
    expect(badgeFor({ credit: 'snack' }, item('entree', 'yes', 'unknown')).kind).toBe('cash');
    expect(badgeFor({ credit: 'snack' }, item('kids', 'yes', 'unknown')).kind).toBe('check');
  });
});

describe('credit filter', () => {
  const sells = new Set(['qs-with-snack']);
  const f = (...xs: CreditFilter[]) => new Set(xs);
  const qs = { id: 'qs-plain', credit: 'quick_service' as const };
  const qsSnack = { id: 'qs-with-snack', credit: 'quick_service' as const };
  const snack = { id: 'snack-only', credit: 'snack' as const };
  const none = { id: 'cash', credit: 'none' as const };

  it('none selected shows all', () => {
    for (const l of [qs, qsSnack, snack, none]) expect(matchesCreditFilter(l, f(), sells)).toBe(true);
  });

  it('QS shows only QS locations', () => {
    expect([qs, qsSnack, snack, none].map((l) => matchesCreditFilter(l, f('quick_service'), sells))).toEqual([true, true, false, false]);
  });

  it('Snack shows snack locations plus QS places selling snack-eligible items', () => {
    expect([qs, qsSnack, snack, none].map((l) => matchesCreditFilter(l, f('snack'), sells))).toEqual([false, true, true, false]);
  });

  it('Not on plan shows only cash locations', () => {
    expect([qs, qsSnack, snack, none].map((l) => matchesCreditFilter(l, f('none'), sells))).toEqual([false, false, false, true]);
  });

  it('filters are ORed', () => {
    expect([qs, qsSnack, snack, none].map((l) => matchesCreditFilter(l, f('snack', 'none'), sells))).toEqual([false, true, true, true]);
  });
});

describe('seed data credit rules', () => {
  const { locations, menu_items } = seedData();
  const byId = Object.fromEntries(locations.map((l) => [l.id, l]));

  it('the three conflicting-source locations carry a confirm-at-counter note', () => {
    for (const id of ['the-trolley-car-cafe-starbucks', 'amorette-s-patisserie', 'yak-yeti-local-food-cafes']) {
      expect(byId[id].credit_note).toMatch(/confirm at the counter/i);
    }
  });

  it('conflicting locations still badge per their recorded credit type', () => {
    const trolley = menu_items.filter((i) => i.location_id === 'the-trolley-car-cafe-starbucks');
    expect(trolley.length).toBeGreaterThan(0);
    for (const i of trolley) expect(['snack', 'check', 'cash']).toContain(badgeFor(byId[i.location_id], i).kind);
    const yak = menu_items.filter((i) => i.location_id === 'yak-yeti-local-food-cafes' && i.section === 'entree');
    expect(yak.every((i) => badgeFor(byId['yak-yeti-local-food-cafes'], i).kind === 'qs')).toBe(true);
  });

  it('Pecos Bill entrées are 1 QS credit and kids meals show ages', () => {
    const pecos = byId['pecos-bill-tall-tale-inn-and-cafe'];
    const items = menu_items.filter((i) => i.location_id === pecos.id);
    for (const i of items.filter((i) => i.section === 'entree')) expect(badgeFor(pecos, i).label).toBe('1 QS credit');
    for (const i of items.filter((i) => i.section === 'kids')) expect(badgeFor(pecos, i).label).toBe('1 QS credit (ages 3–9)');
  });

  it('snack sellers include QS places with confirmed snack items', () => {
    const s = snackSellers(menu_items);
    expect(s.size).toBeGreaterThan(0);
    for (const id of s) expect(menu_items.some((i) => i.location_id === id && i.snack_eligible === 'yes')).toBe(true);
  });
});
