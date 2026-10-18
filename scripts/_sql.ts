import type { Stmt } from '../api/_lib/db.js';

/** Multi-row INSERT statements in chunks. `casts` maps column -> pg type cast. */
export function insertRows(
  table: string,
  cols: string[],
  rows: Record<string, unknown>[],
  conflict: string,
  casts: Record<string, string> = {},
  chunk = 100,
): Stmt[] {
  const out: Stmt[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = slice.map((r) => {
      const ph = cols.map((c) => {
        params.push(r[c] ?? null);
        return `$${params.length}${casts[c] ? `::${casts[c]}` : ''}`;
      });
      return `(${ph.join(', ')})`;
    });
    out.push({ text: `insert into ${table} (${cols.join(', ')}) values ${values.join(', ')} ${conflict}`, params });
  }
  return out;
}

export function excludedSet(cols: string[], skip: string[]): string {
  return cols.filter((c) => !skip.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ');
}
