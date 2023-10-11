import { Global, Module } from '@nestjs/common';
import { HumanDescriptionApi } from '@/datasources/human-description-api/human-description-api.service';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';

@Global()
@Module({
  providers: [{ provide: IHumanDescriptionApi, useClass: HumanDescriptionApi }],
  exports: [IHumanDescriptionApi],
})
export class HumanDescriptionApiModule {}
