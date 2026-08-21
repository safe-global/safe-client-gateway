// SPDX-License-Identifier: FSL-1.1-MIT
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import { asError } from '@/logging/utils';
import { RhinestoneErrorResponseSchema } from '@/modules/relay/datasources/schemas/rhinestone-error.schema';

/**
 * Cap on how many of a Rhinestone error body's `errors[]` entries are copied
 * into a log line. Rhinestone can report several validation failures at once;
 * the first few carry the diagnosis, the rest would only bloat the entry.
 */
export const MAX_LOGGED_UPSTREAM_ERRORS = 3;

/**
 * Per-message character cap for upstream-controlled strings copied into a log
 * line, so a long or hostile body cannot flood log storage.
 */
export const MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH = 200;

/**
 * Builds a log-friendly string from an error raised by a Rhinestone call.
 *
 * Both network error classes extend {@link Error} without setting a message,
 * so `asError(error).message` alone is empty and undiagnosable. This surfaces
 * the HTTP status (or the target URL, when no response was received), plus
 * the whitelisted diagnostic fields of the response body — see
 * {@link describeUpstreamError} for what is and is not copied out of it.
 */
export function formatRhinestoneError(error: unknown): string {
  if (error instanceof NetworkResponseError) {
    return `status=${error.response.status} ${error.response.statusText}${describeUpstreamError(error.data)}`;
  }
  if (error instanceof NetworkRequestError) {
    return `no response received from ${error.url}`;
  }
  return asError(error).message;
}

/**
 * Extracts the loggable part of a Rhinestone error body.
 *
 * Rhinestone nests its rejection reason under `errors[].message`, which
 * `HttpErrorFactory` cannot see (it reads only `data.message`), so without
 * this the reason — e.g. "`to` is not a canonical Safe proxy factory" — is
 * discarded and the failure is undiagnosable from logs alone.
 *
 * The body is not logged wholesale: only `errors[].message` and `traceId`
 * are copied, per the structured-logging rule in `docs/agents/security.md`.
 * The `errors[].context` object is dropped — it echoes back request details
 * (chain ID, addresses) that do not belong in log storage. Messages are
 * whitespace-collapsed and length-capped so an upstream-controlled string
 * cannot forge additional log lines or flood a log entry.
 *
 * Blank entries are discarded *before* the cap is applied, so a body whose
 * leading entries carry no message still reports the ones that do.
 *
 * @returns a leading-space-prefixed fragment ready to append to a log line,
 * or an empty string when the body carries nothing loggable.
 */
function describeUpstreamError(data: unknown): string {
  const parsed = RhinestoneErrorResponseSchema.safeParse(data);
  if (!parsed.success) {
    return '';
  }

  const messages = (parsed.data.errors ?? [])
    .filter((error) => error.message.trim().length > 0)
    .slice(0, MAX_LOGGED_UPSTREAM_ERRORS)
    .map((error) => truncateForLog(error.message));

  const fragments: Array<string> = [];
  if (messages.length > 0) {
    fragments.push(`upstreamErrors="${messages.join('; ')}"`);
  }
  if (parsed.data.traceId) {
    fragments.push(`traceId=${truncateForLog(parsed.data.traceId)}`);
  }

  return fragments.length > 0 ? ` ${fragments.join(' ')}` : '';
}

/**
 * Collapses whitespace (including newlines, which would otherwise let an
 * upstream string forge log lines) and caps length.
 */
function truncateForLog(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH
    ? `${collapsed.slice(0, MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH)}…`
    : collapsed;
}
