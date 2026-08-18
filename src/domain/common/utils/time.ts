// SPDX-License-Identifier: FSL-1.1-MIT

// Beyond this the epoch is not a representable `Date` (ECMAScript time range).
const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

export function getMillisecondsUntil(date: Date): number {
  return date.getTime() - Date.now();
}

export function getSecondsUntil(date: Date): number {
  return Math.floor(getMillisecondsUntil(date) / 1_000);
}

export const toSecondsTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1_000);
};

/**
 * Inverse of {@link toSecondsTimestamp}: `null` for an absent timestamp, and
 * for one no `Date` can hold, so an out-of-range upstream epoch surfaces as a
 * missing value rather than an `Invalid Date` reaching the caller.
 */
export const fromSecondsTimestamp = (
  seconds: number | null | undefined,
): Date | null => {
  if (seconds == null || !Number.isFinite(seconds)) {
    return null;
  }
  const milliseconds = seconds * 1_000;
  return Math.abs(milliseconds) > MAX_TIMESTAMP_MS
    ? null
    : new Date(milliseconds);
};
