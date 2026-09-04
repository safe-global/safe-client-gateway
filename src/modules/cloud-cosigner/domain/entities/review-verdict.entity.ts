// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export enum Verdict {
  APPROVE = 'approve',
  REJECT = 'reject',
}

/**
 * The structured output the model must produce for a review. Kept flat and
 * closed so it can be handed to the API as a strict output format.
 */
export const REVIEW_CONFIDENCE = ['low', 'medium', 'high'] as const;

export const ReviewVerdictSchema = z.object({
  verdict: z.enum(Verdict),
  confidence: z.enum(REVIEW_CONFIDENCE),
  // One short paragraph an owner can read in the queue.
  summary: z.string(),
  // Short labels for anything suspicious, empty when nothing was found.
  risk_flags: z.array(z.string()),
});

export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export type ReviewOutcome =
  | { kind: 'verdict'; verdict: ReviewVerdict; model: string }
  | { kind: 'refusal'; category: string | null; model: string };
