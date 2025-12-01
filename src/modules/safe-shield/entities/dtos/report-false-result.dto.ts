import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

// Zod schemas
export const ReportEventSchema = z.enum(['FALSE_POSITIVE', 'FALSE_NEGATIVE']);

export const ReportFalseResultRequestSchema = z.object({
  event: ReportEventSchema,
  request_id: z.string().uuid(),
  details: z.string().min(1).max(1000),
});

export type ReportFalseResultRequest = z.infer<
  typeof ReportFalseResultRequestSchema
>;

// Swagger DTOs
export class ReportFalseResultRequestDto implements ReportFalseResultRequest {
  @ApiProperty({
    enum: ['FALSE_POSITIVE', 'FALSE_NEGATIVE'],
    description:
      'Type of report: FALSE_POSITIVE if flagged incorrectly, FALSE_NEGATIVE if should have been flagged',
  })
  event!: 'FALSE_POSITIVE' | 'FALSE_NEGATIVE';

  @ApiProperty({
    description: 'The request_id from the original Blockaid scan response',
    example: '11111111-1111-1111-1111-111111111111',
  })
  request_id!: string;

  @ApiProperty({
    description: 'Details about why this is a false result',
    maxLength: 1000,
    example: 'This transaction was incorrectly flagged as malicious',
  })
  details!: string;
}

export class ReportFalseResultResponseDto {
  @ApiProperty({
    description: 'Whether the report was submitted successfully',
    example: true,
  })
  success!: boolean;
}
