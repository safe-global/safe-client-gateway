import { Operation } from '@/domain/safe/entities/operation.entity';
import { CounterpartyAnalysisRequest } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Address, Hex } from 'viem';

export class CounterpartyAnalysisRequestDto
  implements CounterpartyAnalysisRequest
{
  @ApiProperty({ type: String })
  to!: Address;

  @ApiProperty()
  value!: string;

  @ApiProperty({ type: String })
  data!: Hex;

  @ApiProperty({
    enum: Operation,
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation!: Operation;
}
