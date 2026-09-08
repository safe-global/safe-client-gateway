// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * A Transaction Service webhook event. Only `PENDING_MULTISIG_TRANSACTION`
 * is acted on; every other type is accepted and ignored, so the service can
 * be subscribed to the full event feed.
 */
export const CloudCosignerHookEventSchema = z
  .object({ type: z.string() })
  .passthrough();

export type CloudCosignerHookEvent = z.infer<
  typeof CloudCosignerHookEventSchema
>;

export class CloudCosignerHookEventDto
  implements z.infer<typeof CloudCosignerHookEventSchema>
{
  @ApiProperty({ type: String, description: 'Transaction Service event type' })
  public readonly type!: string;

  [key: string]: unknown;
}
