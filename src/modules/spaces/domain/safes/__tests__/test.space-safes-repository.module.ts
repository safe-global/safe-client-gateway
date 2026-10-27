// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';

/**
 * Test module that overrides {@link SpaceSafesRepositoryModule} for specs
 * that build their module without a database.
 */
@Module({
  providers: [
    {
      provide: ISpaceSafesRepository,
      useFactory: (): MockedObject<
        Pick<ISpaceSafesRepository, 'findSpaceIdsBySafe'>
      > => ({
        findSpaceIdsBySafe: vi.fn().mockResolvedValue([]),
      }),
    },
  ],
  exports: [ISpaceSafesRepository],
})
export class TestSpaceSafesRepositoryModule {}
