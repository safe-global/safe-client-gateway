// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { TokenSpenderSchema } from '#/modules/token-approvals/domain/entities/token-approval.entity';
import {
  type Erc20Token,
  Erc20TokenSchema,
} from '#/modules/tokens/domain/entities/token.entity';
import { NumericStringSchema } from '#/validation/entities/schemas/numeric-string.schema';

const TokenApprovalResponseSchema = TokenSpenderSchema.extend({
  tokenMetadata: Erc20TokenSchema.nullable(),
  /** Decimal string, in the smallest unit of the token. */
  allowance: NumericStringSchema,
});

const TokenApprovalsResponseSchema = z.object({
  approvals: z.array(TokenApprovalResponseSchema),
  isComplete: z.boolean(),
});

export type TokenApprovalsResponse = z.infer<
  typeof TokenApprovalsResponseSchema
>;

/**
 * Mirrors the token module's own `Erc20TokenMetadata` DTO
 * (`src/modules/tokens/routes/entities/token.dto.entity.ts`) - not imported
 * from there directly, since a module reaches another only through its
 * `domain/` (see `docs/agents/module-structure.md`).
 */
export class Erc20TokenMetadataDto implements Erc20Token {
  @ApiProperty({ enum: ['ERC20'] })
  public readonly type!: 'ERC20';
  @ApiProperty({ type: String })
  public readonly address!: Address;
  @ApiProperty()
  public readonly decimals!: number;
  @ApiProperty()
  public readonly logoUri!: string;
  @ApiProperty()
  public readonly name!: string;
  @ApiProperty()
  public readonly symbol!: string;
  @ApiProperty({
    description:
      'Whether the Transaction Service lists the token in one of its imported token lists',
  })
  public readonly trusted!: boolean;
}

export class TokenApprovalDto
  implements z.infer<typeof TokenApprovalResponseSchema>
{
  @ApiProperty({
    type: String,
    description: 'The ERC-20 token the allowance is for',
  })
  public readonly tokenAddress!: Address;
  @ApiProperty({
    type: Erc20TokenMetadataDto,
    nullable: true,
    description:
      'Metadata of `tokenAddress`; null when it does not resolve to an ERC-20 token',
  })
  public readonly tokenMetadata!: Erc20Token | null;
  @ApiProperty({
    type: String,
    description: 'The address allowed to spend the token',
  })
  public readonly spender!: Address;
  @ApiProperty({
    description:
      'The current allowance, as a decimal string in the smallest unit of the token',
  })
  public readonly allowance!: string;
}

export class TokenApprovalsDto implements TokenApprovalsResponse {
  @ApiProperty({ type: TokenApprovalDto, isArray: true })
  public readonly approvals!: Array<TokenApprovalDto>;
  @ApiProperty({
    description:
      'False when the list may miss approvals: the logs are not read up to the latest block yet, or the list reached its size limit. A later request continues the scan.',
  })
  public readonly isComplete!: boolean;
}
