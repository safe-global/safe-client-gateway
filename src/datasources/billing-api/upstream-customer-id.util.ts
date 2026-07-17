// SPDX-License-Identifier: FSL-1.1-MIT

// safe-billing-service joins customerGroup and upstreamCustomerId with a
// single '-' and splits on every '-' to parse it back, so a dash-containing
// UUID gets truncated to its first segment. Strip dashes before sending it
// upstream, and restore them when it comes back in a response.

export function stripDashes(uuid: string): string {
  return uuid.replaceAll('-', '');
}

export function withDashes(hex: string): string {
  if (!/^[0-9a-f]{32}$/i.test(hex)) return hex;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
