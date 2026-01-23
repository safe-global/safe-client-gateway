import { Global, Module } from '@nestjs/common';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import { HumanDescriptionApi } from '@/modules/human-description/datasources/human-description-api.service';
import { IHumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository.interface';
import { HumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository';

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
