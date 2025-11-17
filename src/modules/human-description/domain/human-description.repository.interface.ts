import {
  FunctionSignatureHash,
  HumanDescriptionFragment,
} from '@/modules/human-description/domain/entities/human-description.entity';
import { Module } from '@nestjs/common';
import { HumanDescriptionRepository } from '@/modules/human-description/domain/human-description.repository';
import { HumanDescriptionApiModule } from '@/modules/human-description/datasources/human-description-api.service';

export const IHumanDescriptionRepository = Symbol(
  'IHumanDescriptionRepository',
);

export interface IHumanDescriptionRepository {
  /**
   * Returns a human description for the provided data.
   *
   * The human description is tied to the provided {@link FunctionSignatureHash}
   */
  getHumanDescription(args: {
    functionSignatureHash: FunctionSignatureHash;
    to: string;
    data: string;
  }): Array<HumanDescriptionFragment>;
}

@Module({
  imports: [HumanDescriptionApiModule],
  providers: [
    {
      provide: IHumanDescriptionRepository,
      useClass: HumanDescriptionRepository,
    },
  ],
  exports: [IHumanDescriptionRepository],
})
export class HumanDescriptionRepositoryModule {}
