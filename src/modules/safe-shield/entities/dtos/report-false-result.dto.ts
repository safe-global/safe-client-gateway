import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Event types for reporting false Blockaid scan results.
 *
 * - FALSE_POSITIVE: Transaction was flagged as malicious but is actually safe
 * - FALSE_NEGATIVE: Transaction was not flagged but should have been
 */
export const ReportEvent = ['FALSE_POSITIVE', 'FALSE_NEGATIVE'] as const;

/**
 * Zod schema for validating ReportEvent enum values.
 */
export const ReportEventSchema = z.enum(ReportEvent);

export type ReportEvent = z.infer<typeof ReportEventSchema>;

/**
 * Zod schema for validating report false result requests.
 *
 * The 1000 character limit on details is a CGW-imposed safeguard
 * to prevent abuse, as Blockaid does not enforce a specific limit.
 */
export const ReportFalseResultRequestSchema = z.object({
  event: ReportEventSchema,
  request_id: z.uuid(),
  details: z.string().min(1).max(1000),
});

export type ReportFalseResultRequest = z.infer<
  typeof ReportFalseResultRequestSchema
>;

/**
 * DTO for reporting false Blockaid scan results.
 * Used to submit feedback when a transaction was incorrectly classified.
 */
export class ReportFalseResultRequestDto implements ReportFalseResultRequest {
  @ApiProperty({
    enum: [...ReportEvent],
    description:
      'Type of report: FALSE_POSITIVE if flagged incorrectly, FALSE_NEGATIVE if should have been flagged',
  })
  public readonly event!: ReportEvent;

  @ApiProperty({
    description: 'The request_id from the original Blockaid scan response',
    example: '11111111-1111-1111-1111-111111111111',
  })
  public readonly request_id!: string;

  @ApiProperty({
    description: 'Details about why this is a false result',
    maxLength: 1000,
    example: 'This transaction was incorrectly flagged as malicious',
  })
  public readonly details!: string;
}

/**
 * DTO for report false result response.
 * Indicates whether the report was successfully submitted to Blockaid.
 */
export class ReportFalseResultResponseDto {
  @ApiProperty({
    description: 'Whether the report was submitted successfully',
    example: true,
  })
  public readonly success!: boolean;
}
