import { Operation } from '@/domain/safe/entities/operation.entity';
import { CounterpartyAnalysisRequestSchema } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Address, Hex } from 'viem';
import { z } from 'zod';

export class CounterpartyAnalysisRequestDto
  implements z.infer<typeof CounterpartyAnalysisRequestSchema>
{
  @ApiProperty({
    type: String,
    description: 'Recipient address of the transaction.',
  })
  to!: Address;

  @ApiProperty({
    description: 'Amount to send with the transaction.',
  })
  value!: string;

  @ApiProperty({
    type: String,
    description: 'Hex-encoded data payload for the transaction.',
  })
  data!: Hex;

  @ApiProperty({
    enum: Operation,
    description: 'Operation type: 0 for CALL, 1 for DELEGATECALL.',
  })
  operation!: Operation;
}
