/**
 * Calendar days as ISO strings (`YYYY-MM-DD`), always UTC.
 *
 * Cloudflare bills in UTC: billing periods start at 00:00Z and every analytics
 * dataset groups by a UTC `date`. Keeping days as strings means they compare
 * and sort correctly without ever going through a local-timezone `Date`.
 */
export type IsoDate = string;

export const DAY_MS = 86_400_000;

export function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function fromIso(iso: IsoDate): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: IsoDate, count: number): IsoDate {
  return toIso(fromIso(iso) + count * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((fromIso(to) - fromIso(from)) / DAY_MS);
}

/** Every day from `from` to `to`, both included. Empty when `to` is earlier. */
export function rangeDays(from: IsoDate, to: IsoDate): IsoDate[] {
  const length = diffDays(from, to) + 1;
  return length <= 0 ? [] : Array.from({ length }, (_, index) => addDays(from, index));
}
