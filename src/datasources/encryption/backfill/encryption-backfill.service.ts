// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
import { IsNull } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

interface AddressBackfillConfig {
  name: string;
  entity: new () => ObjectLiteral;
  /** Column containing the address (stores ciphertext after migration) */
  field: string;
  /** HMAC hash column — NULL means row not yet migrated */
  hashField: string;
}

interface NameBackfillConfig {
  name: string;
  entity: new () => ObjectLiteral;
  /** Column containing the name (stores ciphertext after migration) */
  field: string;
}

const ADDRESS_ENTITIES: Array<AddressBackfillConfig> = [
  {
    name: 'Wallet',
    entity: Wallet,
    field: 'address',
    hashField: 'addressHash',
  },
  {
    name: 'SpaceSafe',
    entity: SpaceSafe,
    field: 'address',
    hashField: 'addressHash',
  },
];

const NAME_ENTITIES: Array<NameBackfillConfig> = [
  {
    name: 'AddressBookItem',
    entity: AddressBookItem,
    field: 'name',
  },
  {
    name: 'Member',
    entity: Member,
    field: 'name',
  },
];

@Injectable()
export class EncryptionBackfillService {
  constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IFieldEncryptionService)
    private readonly encryptionService: IFieldEncryptionService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Backfills all entities that have unencrypted data.
   * - Address entities: rows where `addressHash IS NULL`
   * - Name entities: rows where `name NOT LIKE 'v1:%'`
   *
   * @param batchSize - Number of rows to process per batch (default: 500)
   */
  async backfillAll(batchSize = 500): Promise<void> {
    for (const config of ADDRESS_ENTITIES) {
      await this.backfillAddressEntity(config, batchSize);
    }
    for (const config of NAME_ENTITIES) {
      await this.backfillNameEntity(config, batchSize);
    }
  }

  private async backfillAddressEntity(
    config: AddressBackfillConfig,
    batchSize: number,
  ): Promise<void> {
    const repository = await this.postgresDatabaseService.getRepository(
      config.entity,
    );

    let totalProcessed = 0;

    while (true) {
      const rows = await repository.find({
        where: { [config.hashField]: IsNull() },
        take: batchSize,
      });

      if (rows.length === 0) {
        break;
      }

      // Saving triggers the subscriber which encrypts in-place and sets hash
      for (const row of rows) {
        await repository.save(row);
      }

      totalProcessed += rows.length;
      this.loggingService.info(
        `Backfill ${config.name}: processed ${totalProcessed} rows`,
      );
    }

    this.loggingService.info(
      `Backfill ${config.name}: completed. Total rows processed: ${totalProcessed}`,
    );
  }

  private async backfillNameEntity(
    config: NameBackfillConfig,
    batchSize: number,
  ): Promise<void> {
    const repository = await this.postgresDatabaseService.getRepository(
      config.entity,
    );

    let totalProcessed = 0;

    while (true) {
      // Find rows where the name is not yet encrypted (no v1: prefix)
      // Use raw query since TypeORM doesn't support NOT LIKE easily
      const rows = await repository
        .createQueryBuilder('e')
        .where(`e.${config.field} IS NOT NULL`)
        .andWhere(`e.${config.field} NOT LIKE 'v1:%'`)
        .take(batchSize)
        .getMany();

      if (rows.length === 0) {
        break;
      }

      // Saving triggers the transformer which encrypts in-place
      for (const row of rows) {
        await repository.save(row);
      }

      totalProcessed += rows.length;
      this.loggingService.info(
        `Backfill ${config.name}: processed ${totalProcessed} rows`,
      );
    }

    this.loggingService.info(
      `Backfill ${config.name}: completed. Total rows processed: ${totalProcessed}`,
    );
  }
}
