import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { Module } from '@nestjs/common';
import { BackboneRepository } from '@/domain/backbone/backbone.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IBackboneRepository = Symbol('IBackboneRepository');

export interface IBackboneRepository {
  /**
   * Gets the Safe Transaction Service configuration for {@link chainId}
   * @param chainId
   */
  getBackbone(chainId: string): Promise<Backbone>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IBackboneRepository,
      useClass: BackboneRepository,
    },
  ],
  exports: [IBackboneRepository],
})
export class BackboneRepositoryModule {}
