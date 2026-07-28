// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Authenticator {
  @ApiProperty({
    description: 'Auth0 authentication method identifier (e.g. totp|...)',
  })
  id!: string;

  @ApiProperty({ description: 'Authentication method type (e.g. totp)' })
  type!: string;

  @ApiPropertyOptional({ description: 'User-visible authenticator name' })
  name?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp of when the method was enrolled',
  })
  createdAt?: string;
}
