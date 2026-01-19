import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { CounterpartyAnalysisRequestSchema } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Address, Hex } from 'viem';
import { z } from 'zod';

export class CounterpartyAnalysisRequestDto implements z.infer<
  typeof CounterpartyAnalysisRequestSchema
> {
  @ApiProperty({
    type: String,
    description: 'Recipient address of the transaction.',
  })
  public readonly to!: Address;

  @ApiProperty({
    description: 'Amount to send with the transaction.',
  })
  public readonly value!: string;

  @ApiProperty({
    type: String,
    description: 'Hex-encoded data payload for the transaction.',
  })
  public readonly data!: Hex;

  @ApiProperty({
    enum: Operation,
    description: 'Operation type: 0 for CALL, 1 for DELEGATECALL.',
  })
  public readonly operation!: Operation;
}
