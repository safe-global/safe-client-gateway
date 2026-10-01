// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { GetSpaceSafeResponse } from '@/modules/spaces/routes/safes/entities/get-space-safe.dto.entity';

export type GetSpacesSafesResponse = Record<
  Space['uuid'],
  GetSpaceSafeResponse['safes']
>;
