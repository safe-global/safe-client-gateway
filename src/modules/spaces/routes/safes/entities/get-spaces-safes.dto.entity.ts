// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { GetSpaceSafeResponse } from '#/modules/spaces/routes/safes/entities/get-space-safe.dto.entity';

export class GetSpacesSafesResponse extends GetSpaceSafeResponse {
  @ApiProperty({ type: String, description: 'Space UUID' })
  public readonly spaceUuid!: Space['uuid'];
}
