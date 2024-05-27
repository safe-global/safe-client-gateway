import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { RelayDtoSchema } from '@/routes/relay/entities/schemas/relay.dto.schema';

export class RelayDto implements z.infer<typeof RelayDtoSchema> {
  @ApiProperty()
  version!: string;

  @ApiProperty()
  to!: `0x${string}`;

  @ApiProperty()
  data!: `0x${string}`;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `If specified, a gas buffer of 150k will be added on top of the expected gas usage for the transaction.
      This is for the <a href="https://docs.gelato.network/developer-services/relay/quick-start/optional-parameters" target="_blank">
      Gelato Relay execution overhead</a>, reducing the chance of the task cancelling before it is executed on-chain.`,
  })
  gasLimit!: bigint | null;
}
