// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  type DeclaredAttribution,
  DeclaredAttributionDescriptions,
} from '#/modules/transactions/domain/entities/declared-attribution.entity';

export class MessageDeclaredAttributionDto implements DeclaredAttribution {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: DeclaredAttributionDescriptions.channel,
  })
  channel!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: DeclaredAttributionDescriptions.appName,
  })
  appName!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: DeclaredAttributionDescriptions.appUrl,
  })
  appUrl!: string | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: DeclaredAttributionDescriptions.appId,
  })
  appId!: number | null;
}
