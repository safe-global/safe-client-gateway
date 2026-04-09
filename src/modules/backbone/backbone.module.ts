// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.module';
import { IBackboneRepository } from '@/modules/backbone/domain/backbone.repository.interface';
import { BackboneRepository } from '@/modules/backbone/domain/backbone.repository';

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
export class BackboneModule {}
