// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { UUID_REGEX } from '@/domain/common/constants';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/**
 * Shared 400 message for malformed Space identifiers.
 */
export const INVALID_SPACE_IDENTIFIER_MESSAGE = 'Invalid space identifier';

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
