// SPDX-License-Identifier: FSL-1.1-MIT
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class UserSession {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: Object.values(AuthMethod) })
  authMethod!: (typeof AuthMethod)[keyof typeof AuthMethod];

  @ApiPropertyOptional({
    description:
      'Wallet signer address. Present only for SIWE-authenticated users.',
  })
  signerAddress?: Address;

  @ApiPropertyOptional({
    description:
      'Verified email address. Present only for OIDC-authenticated users when stored.',
  })
  email?: string;
}
