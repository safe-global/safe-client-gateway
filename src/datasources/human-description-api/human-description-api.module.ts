import { Global, Module } from '@nestjs/common';
import { HumanDescriptionApi } from './human-description-api.service';
import { IHumanDescriptionApi } from '../../domain/interfaces/human-description-api.interface';
import ContractDescriptions from './json';

function contractDescriptionFactory() {
  return ContractDescriptions;
}

@Global()
@Module({
  providers: [
    { provide: 'ContractDescriptions', useFactory: contractDescriptionFactory },
    { provide: IHumanDescriptionApi, useClass: HumanDescriptionApi },
  ],
  exports: [IHumanDescriptionApi],
})
export class HumanDescriptionApiModule {}
