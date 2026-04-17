// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import { HumanDescriptionApi } from '@/modules/human-description/datasources/human-description-api.service';
import { HumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository';
import { IHumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository.interface';

@Global()
@Module({
  providers: [
    { provide: IHumanDescriptionApi, useClass: HumanDescriptionApi },
    {
      provide: IHumanDescriptionRepository,
      useClass: HumanDescriptionRepository,
    },
  ],
  exports: [IHumanDescriptionApi, IHumanDescriptionRepository],
})
export class HumanDescriptionModule {}
