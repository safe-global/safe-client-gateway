// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { EmailAddress } from '@/validation/entities/schemas/email-address.schema';

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
  email?: EmailAddress;
}
