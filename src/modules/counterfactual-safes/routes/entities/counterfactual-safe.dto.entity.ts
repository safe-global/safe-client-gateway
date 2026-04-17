// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { SemverSchema } from '@/validation/entities/schemas/semver.schema';
import z from 'zod';

export const CounterfactualSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
  factoryAddress: AddressSchema,
  masterCopy: AddressSchema,
  saltNonce: NumericStringSchema.pipe(z.string().max(78)),
  safeVersion: SemverSchema,
  threshold: z.number().int().positive(),
  owners: z.array(AddressSchema).nonempty(),
  fallbackHandler: AddressSchema.nullish(),
  to: AddressSchema.nullish(),
  data: HexSchema,
  paymentToken: AddressSchema.nullish(),
  payment: NumericStringSchema.nullish(),
  paymentReceiver: AddressSchema.nullish(),
});

export const CounterfactualSafesSchema = z.object({
  safes: z.array(CounterfactualSafeSchema).nonempty().max(100),
});

export class CounterfactualSafeDto
  implements z.infer<typeof CounterfactualSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: CounterfactualSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: CounterfactualSafe['address'];

  @ApiProperty({ type: String })
  public readonly factoryAddress!: CounterfactualSafe['factoryAddress'];

  @ApiProperty({ type: String })
  public readonly masterCopy!: CounterfactualSafe['masterCopy'];

  @ApiProperty({ type: String })
  public readonly saltNonce!: CounterfactualSafe['saltNonce'];

  @ApiProperty({ type: String })
  public readonly safeVersion!: CounterfactualSafe['safeVersion'];

  @ApiProperty({ type: Number })
  public readonly threshold!: CounterfactualSafe['threshold'];

  @ApiProperty({ type: [String] })
  public readonly owners!: CounterfactualSafe['owners'];

  @ApiPropertyOptional({ type: String, nullable: true })
  public readonly fallbackHandler?: CounterfactualSafe['fallbackHandler'];

  @ApiPropertyOptional({ type: String, nullable: true })
  public readonly to?: CounterfactualSafe['setupTo'];

  @ApiProperty({ type: String })
  public readonly data!: CounterfactualSafe['setupData'];

  @ApiPropertyOptional({ type: String, nullable: true })
  public readonly paymentToken?: CounterfactualSafe['paymentToken'];

  @ApiPropertyOptional({ type: String, nullable: true })
  public readonly payment?: CounterfactualSafe['payment'];

  @ApiPropertyOptional({ type: String, nullable: true })
  public readonly paymentReceiver?: CounterfactualSafe['paymentReceiver'];
}

export class CounterfactualSafesDto
  implements z.infer<typeof CounterfactualSafesSchema>
{
  @ApiProperty({ type: CounterfactualSafeDto, isArray: true })
  public readonly safes!: [
    CounterfactualSafeDto,
    ...Array<CounterfactualSafeDto>,
  ];
}
