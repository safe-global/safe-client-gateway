// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { EncryptedEntitySubscriber } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { getAddress } from 'viem';

@Injectable()
export class WalletSubscriber extends EncryptedEntitySubscriber<Wallet> {
  protected readonly fieldConfigs = [
    {
      field: 'address',
      hashField: 'addressHash',
      postDecrypt: (value: string): string => getAddress(value),
    },
  ];

  constructor(
    @Inject(IFieldEncryptionService)
    encryptionService: IFieldEncryptionService,
    @Inject(LoggingService)
    loggingService: ILoggingService,
    dataSource: DataSource,
  ) {
    super(encryptionService, loggingService, dataSource);
  }

  listenTo(): typeof Wallet {
    return Wallet;
  }
}
