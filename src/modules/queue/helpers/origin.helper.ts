// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Parses a TX-service-style origin JSON string into separate name/url/note fields.
 *
 * The note is embedded inside the origin JSON by the transactions service (see
 * `MultisigTransactionNoteMapper`); the queue service expects it as a dedicated
 * field, so we lift it out here.
 *
 * @param origin - The JSON string to parse (typically from the Safe Transaction Service's "origin").
 *
 * @returns An object with the extracted originName, originUrl and note fields if present.
 */
export function parseOrigin(origin: string | null): {
  originName?: string;
  originUrl?: string;
  note?: string;
} {
  const parsedOrigin: {
    originName?: string;
    originUrl?: string;
    note?: string;
  } = {};
  if (!origin) {
    return parsedOrigin;
  }

  try {
    const parsed: unknown = JSON.parse(origin);
    // Guard against valid-but-non-object JSON (e.g. `"hello"` or `42`), which
    // would otherwise destructure into undefined name/url silently.
    if (typeof parsed === 'object' && parsed !== null) {
      const { name, url, note } = parsed as Record<string, unknown>;
      // Only take fields that are actually strings — the declared return type
      // promises `string | undefined`, so a non-string value (e.g. a number)
      // must be dropped rather than passed through untyped.
      parsedOrigin.originName = typeof name === 'string' ? name : undefined;
      parsedOrigin.originUrl = typeof url === 'string' ? url : undefined;
      parsedOrigin.note = typeof note === 'string' ? note : undefined;
    }
  } catch {
    // Ignore, no origin
  }
  return parsedOrigin;
}

/**
 * Builds a TX-service-style origin JSON string from separate name/url/note fields.
 *
 * The note is embedded inside the origin JSON because downstream consumers
 * (e.g. MultisigTransactionNoteMapper) extract it from there rather than from a
 * dedicated field — the queue service exposes it separately, so we re-merge it.
 *
 * @param originName - Name of the origin (e.g., application or Safe App name).
 * @param originUrl - URL of the origin (e.g., application or Safe App URL).
 * @param note - Free-text note attached to the transaction, if any.
 *
 * @returns A stringified JSON object containing the name, url and note fields if any exists, otherwise null.
 */
export function buildOrigin(
  originName: string | null,
  originUrl: string | null,
  note: string | null = null,
): string | null {
  if (!(originName || originUrl || note)) {
    return null;
  }
  // Only emit the note key when present so callers without a note (e.g. messages)
  // keep their original `{name, url}` shape.
  return JSON.stringify(
    note === null
      ? { name: originName, url: originUrl }
      : { name: originName, url: originUrl, note },
  );
}
