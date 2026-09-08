// The club bills in whole KES with 2dp; amounts are small enough that JS
// number math with a round-to-cents guard is fine here. Prisma Decimal
// columns accept a plain number on write and come back as Decimal on read
// (num() below normalises either).

export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return Number(v as { toString(): string });
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Render a CSV row, quoting fields that contain a comma, quote or newline. */
export function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      const s = f === null || f === undefined ? '' : String(f);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}
