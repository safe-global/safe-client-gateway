// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { SpaceSafeDto } from '@/modules/spaces/routes/safes/entities/space-safe.dto.entity';

export type GetSpacesSafesResponse = Record<Space['uuid'], Array<SpaceSafeDto>>;
