// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IOffchain } from '@/modules/offchain/offchain.interface';
import { OffchainQueueService } from '@/modules/offchain/offchain.queue.service';
import { OffchainTxService } from '@/modules/offchain/offchain.tx.service';
import { OffchainErrorMapper } from '@/modules/offchain/mappers/error.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  ITransactionApiManager,
  TransactionApiManagerModule,
} from '@/domain/interfaces/transaction-api.manager.interface';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    OffchainErrorMapper,
    {
      provide: IOffchain,
      useFactory: (
        configurationService: IConfigurationService,
        transactionApiManager: ITransactionApiManager,
        networkService: INetworkService,
        loggingService: ILoggingService,
        errorMapper: OffchainErrorMapper,
      ): IOffchain => {
        const isEnabled = configurationService.getOrThrow<boolean>(
          'features.queueService',
        );
        if (isEnabled) {
          return new OffchainQueueService(
            configurationService,
            networkService,
            loggingService,
            errorMapper,
          );
        }
        return new OffchainTxService(transactionApiManager);
      },
      inject: [
        IConfigurationService,
        ITransactionApiManager,
        NetworkService,
        LoggingService,
        OffchainErrorMapper,
      ],
    },
  ],
  exports: [IOffchain],
})
export class OffchainModule {}
