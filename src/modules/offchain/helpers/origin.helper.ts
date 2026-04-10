// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Parses a TX-service-style origin JSON string into separate name/url fields.
 *
 * @param origin - The JSON string to parse (typically from the Safe Transaction Service's "origin").
 *
 * @returns An object with the extracted originName and originUrl fields if both exist, otherwise null.
 */
export function parseOrigin(origin: string | null): {
  originName?: string;
  originUrl?: string;
} {
  const parsedOrigin = {
    originName: undefined,
    originUrl: undefined,
  };
  if (!origin) {
    return parsedOrigin;
  }

  try {
    const { name, url } = JSON.parse(origin);
    parsedOrigin.originName = name;
    parsedOrigin.originName = url;
  } catch {
    // Ignore, no origin
  }
  return parsedOrigin;
}

/**
 * Builds a TX-service-style origin JSON string from separate name/url fields.
 *
 * @param originName - Name of the origin (e.g., application or Safe App name).
 * @param originUrl - URL of the origin (e.g., application or Safe App URL).
 *
 * @returns A stringified JSON object containing name and url fields if either exists, otherwise null.
 */
export function buildOrigin(
  originName: string | null,
  originUrl: string | null,
): string | null {
  if (!originName && !originUrl) {
    return null;
  }
  return JSON.stringify({ name: originName, url: originUrl });
}
