// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DECLARED_APP_NAME_MAX_LENGTH,
  DECLARED_APP_URL_MAX_LENGTH,
  DECLARED_CHANNEL_MAX_LENGTH,
  type DeclaredAttribution,
  KnownDeclaredChannels,
} from '#/modules/transactions/domain/entities/declared-attribution.entity';

export const DECLARED_ATTRIBUTION_DESCRIPTION =
  'Where the request came from, as reported by the client.';

export class DeclaredAttributionDto implements DeclaredAttribution {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `Where the user started the request. Known values: ${KnownDeclaredChannels.join(', ')}. Truncated to ${DECLARED_CHANNEL_MAX_LENGTH} characters.`,
  })
  channel!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `App name. Truncated to ${DECLARED_APP_NAME_MAX_LENGTH} characters.`,
  })
  appName!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `App origin and path. Truncated to ${DECLARED_APP_URL_MAX_LENGTH} characters.`,
  })
  appUrl!: string | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'ID of a listed Safe App.',
  })
  appId!: number | null;
}
