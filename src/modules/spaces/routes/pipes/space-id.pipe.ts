// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  ParseUUIDPipe,
  type PipeTransform,
} from '@nestjs/common';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/**
 * Resolves a route param holding a Space UUID into the numeric primary key.
 * Rejects non-UUID input with the standard NestJS ParseUUIDPipe message so
 * client error contracts stay stable.
 */
@Injectable()
export class SpaceIdPipe
  implements PipeTransform<string, Promise<Space['id']>>
{
  private readonly uuidPipe = new ParseUUIDPipe();

  constructor(
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  async transform(value: string): Promise<Space['id']> {
    const uuid = await this.uuidPipe.transform(value, {
      type: 'param',
      metatype: String,
    });
    return await this.spacesRepository.findIdByUuid(uuid);
  }
}

/**
 * Like SpaceIdPipe but also accepts a legacy numeric Space id for the FE
 * fallback window. Remove together with the legacy numeric Space ID fallback.
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
    return await this.spacesRepository.findIdByIdOrUuid(value);
  }
}
