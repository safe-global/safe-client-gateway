// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';

export class GetCounterfactualSafeItem {
  @ApiProperty({ type: String })
  public readonly address!: Address;

  @ApiProperty({ type: String })
  public readonly factoryAddress!: Address;

  @ApiProperty({ type: String })
  public readonly masterCopy!: Address;

  @ApiProperty({ type: String })
  public readonly saltNonce!: string;

  @ApiProperty({ type: String })
  public readonly safeVersion!: string;

  @ApiProperty({ type: Number })
  public readonly threshold!: number;

  @ApiProperty({ type: [String] })
  public readonly owners!: Array<Address>;

  @ApiProperty({ type: String, nullable: true })
  public readonly fallbackHandler!: Address | null;

  @ApiProperty({ type: String, nullable: true })
  public readonly to!: Address | null;

  @ApiProperty({ type: String })
  public readonly data!: Hex;

  @ApiProperty({ type: String, nullable: true })
  public readonly paymentToken!: Address | null;

  @ApiProperty({ type: String, nullable: true })
  public readonly payment!: string | null;

  @ApiProperty({ type: String, nullable: true })
  public readonly paymentReceiver!: Address | null;
}

@ApiExtraModels(GetCounterfactualSafeItem)
export class GetCounterfactualSafesResponse {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        $ref: getSchemaPath(GetCounterfactualSafeItem),
      },
    },
    example: {
      '{chainId}': [
        {
          address: '0x...',
          factoryAddress: '0x...',
          masterCopy: '0x...',
          saltNonce: '1712000000000',
          safeVersion: '1.4.1',
          threshold: 1,
          owners: ['0x...'],
          fallbackHandler: '0x...',
          to: null,
          data: '0x...',
          paymentToken: null,
          payment: null,
          paymentReceiver: null,
        },
      ],
    },
  })
  public readonly safes!: {
    [chainId: CounterfactualSafe['chainId']]: Array<GetCounterfactualSafeItem>;
  };
}
