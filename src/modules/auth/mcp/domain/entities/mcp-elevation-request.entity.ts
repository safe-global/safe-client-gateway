// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';

/**
 * A pending step-up for one MCP connection, created when a call was refused
 * with `elevation_required` and completed through the OIDC step-up flow.
 */
export const McpElevationRequestSchema = z.object({
  userId: z.number().int().positive(),
  clientId: z.string().min(1),
});

export type McpElevationRequest = z.infer<typeof McpElevationRequestSchema>;

export const McpElevationRequestIdSchema = z.hex().length(64);
