// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/**
 * Shared 400 message for malformed Space identifiers. Both pipes use it so
 * clients see a single, stable error body regardless of which one validates.
 */
export const INVALID_SPACE_IDENTIFIER_MESSAGE = 'Invalid space identifier';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_REGEX = /^\d+$/;

/**
 * Resolves a route param holding a Space UUID into the numeric primary key.
 * Rejects non-UUID input with {@link INVALID_SPACE_IDENTIFIER_MESSAGE}.
 */
@Injectable()
export class SpaceIdPipe
  implements PipeTransform<string, Promise<Space['id']>>
{
  constructor(
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  async transform(value: string): Promise<Space['id']> {
    if (!UUID_REGEX.test(value)) {
      throw new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE);
    }
    return await this.spacesRepository.findIdByUuid(value as UUID);
  }
}

/**
 * Like SpaceIdPipe but also accepts a legacy numeric Space id for the FE
 * fallback window. Rejects malformed input with the same
 * {@link INVALID_SPACE_IDENTIFIER_MESSAGE} as SpaceIdPipe. Remove together with
 * the legacy numeric Space ID fallback.
 */
@Injectable()
export class LegacySpaceIdPipe
  implements PipeTransform<string, Promise<Space['id']>>
{
  constructor(
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  async transform(value: string): Promise<Space['id']> {
    if (NUMERIC_REGEX.test(value)) {
      const numericId = Number(value);
      if (!Number.isSafeInteger(numericId) || numericId > DB_MAX_SAFE_INTEGER) {
        throw new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE);
      }
    } else if (!UUID_REGEX.test(value)) {
      throw new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE);
    }
    return await this.spacesRepository.findIdByIdOrUuid(value);
  }
}
