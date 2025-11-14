import { Injectable, Module } from '@nestjs/common';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import { FunctionSignature } from '@/modules/human-description/domain/entities/human-description.entity';
import ContractDescriptions from '@/modules/human-description/datasources/json';

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  getDescriptions(): Record<FunctionSignature, string> {
    return ContractDescriptions;
  }
}

@Module({
  providers: [
    {
      provide: IHumanDescriptionApi,
      useClass: HumanDescriptionApi,
    },
  ],
  exports: [IHumanDescriptionApi],
})
export class HumanDescriptionApiModule {}
