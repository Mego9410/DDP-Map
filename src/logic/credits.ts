import type { Credit, ItemSection, Location, MenuItem, Tri } from '../shared/types';

export type Badge =
  | { kind: 'qs'; label: '1 QS credit' }
  | { kind: 'qs-kids'; label: '1 QS credit (ages 3–9)' }
  | { kind: 'snack'; label: 'Snack credit' }
  | { kind: 'check'; label: 'Check DDP symbol' }
  | { kind: 'cash'; label: 'Cash only' };

export const QS: Badge = { kind: 'qs', label: '1 QS credit' };
export const QS_KIDS: Badge = { kind: 'qs-kids', label: '1 QS credit (ages 3–9)' };
export const SNACK: Badge = { kind: 'snack', label: 'Snack credit' };
export const CHECK: Badge = { kind: 'check', label: 'Check DDP symbol' };
export const CASH: Badge = { kind: 'cash', label: 'Cash only' };

/**
 * The single source of truth for every credit badge (TRD §5), so the map
 * filter, list and menu always agree. One addition to the TRD version: an
 * entrée or kids' meal explicitly marked qs_eligible = 'unknown' shows
 * "Check DDP symbol" rather than claiming a credit.
 */
export function badgeFor(
  loc: { credit: Credit },
  item: { section: ItemSection; qs_eligible: Tri; snack_eligible: Tri },
): Badge {
  if (loc.credit === 'none') return CASH;
  if (loc.credit === 'quick_service' && item.qs_eligible !== 'no') {
    if (item.qs_eligible === 'unknown' && (item.section === 'entree' || item.section === 'kids')) return CHECK;
    if (item.section === 'entree') return QS;
    if (item.section === 'kids') return QS_KIDS;
  }
  if (item.snack_eligible === 'yes') return SNACK;
  if (item.snack_eligible === 'unknown' && item.section !== 'entree') return CHECK;
  return CASH;
}

export type CreditFilter = 'quick_service' | 'snack' | 'none';

export const CREDIT_LABEL: Record<Credit, string> = {
  quick_service: 'Quick-Service credit',
  snack: 'Snack credit',
  none: 'Not on plan',
};

export const CREDIT_SHORT: Record<Credit, string> = {
  quick_service: 'QS',
  snack: 'Snack',
  none: 'Cash',
};

/** Location ids that sell at least one confirmed snack-credit item. */
export function snackSellers(items: Pick<MenuItem, 'location_id' | 'snack_eligible'>[]): Set<string> {
  const s = new Set<string>();
  for (const i of items) if (i.snack_eligible === 'yes') s.add(i.location_id);
  return s;
}

/**
 * Filter rules (TRD §5): chips are OR'd; none selected shows everything.
 * "Snack credit" also includes QS places that sell a snack-eligible item.
 */
export function matchesCreditFilter(
  loc: Pick<Location, 'id' | 'credit'>,
  filters: ReadonlySet<CreditFilter>,
  sellsSnack: ReadonlySet<string>,
): boolean {
  if (filters.size === 0) return true;
  if (filters.has('quick_service') && loc.credit === 'quick_service') return true;
  if (filters.has('snack') && (loc.credit === 'snack' || sellsSnack.has(loc.id))) return true;
  if (filters.has('none') && loc.credit === 'none') return true;
  return false;
}
