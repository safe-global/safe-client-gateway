// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Shape of a Rhinestone error response body.
 *
 * Rhinestone reports failures as
 * `{ errors: [{ message, context }], traceId }` — it does not use the
 * top-level `message` field that {@link HttpErrorFactory} reads, so without
 * this schema a rejection reaches the client as a bare
 * `{ code: <status>, message: 'An error occurred' }` and the reason is lost.
 *
 * Every field is optional: this parses an error path, so it must never throw
 * and mask the original failure. `context` is deliberately not declared —
 * it echoes request details (chain ID, addresses) that the structured-logging
 * rule in `docs/agents/security.md` keeps out of logs, and Zod strips
 * undeclared keys.
 */
export const RhinestoneErrorResponseSchema = z.object({
  errors: z.array(z.object({ message: z.string() })).optional(),
  traceId: z.string().optional(),
});

export type RhinestoneErrorResponse = z.infer<
  typeof RhinestoneErrorResponseSchema
>;
