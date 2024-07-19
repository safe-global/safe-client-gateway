import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { getFromCacheOrExecuteAndCache } from '@/datasources/db/utils';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class AccountsDatasource implements IAccountsDatasource, OnModuleInit {
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  /**
   * Function executed when the module is initialized.
   * It deletes the cache for persistent keys.
   */
  async onModuleInit(): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getAccountDataTypesCacheDir().key,
    );
  }

  async createAccount(args: { address: `0x${string}` }): Promise<Account> {
    const [account] = await this.sql<[Account]>`
      INSERT INTO accounts (address) VALUES (${args.address}) RETURNING *`.catch(
      (e) => {
        this.loggingService.warn(
          `Error creating account: ${asError(e).message}`,
        );
        throw new UnprocessableEntityException('Error creating account.');
      },
    );
    const cacheDir = CacheRouter.getAccountCacheDir(args.address);
    await this.cacheService.set(
      cacheDir,
      JSON.stringify([account]),
      this.defaultExpirationTimeInSeconds,
    );
    return account;
  }

  async getAccount(args: { address: `0x${string}` }): Promise<Account> {
    const cacheDir = CacheRouter.getAccountCacheDir(args.address);
    const [account] = await getFromCacheOrExecuteAndCache<Account[]>(
      this.loggingService,
      this.cacheService,
      cacheDir,
      this.sql<
        Account[]
      >`SELECT * FROM accounts WHERE address = ${args.address}`,
      this.defaultExpirationTimeInSeconds,
    );

    if (!account) {
      throw new NotFoundException('Error getting account.');
    }

    return account;
  }

  async deleteAccount(args: { address: `0x${string}` }): Promise<void> {
    try {
      const { count } = await this
        .sql`DELETE FROM accounts WHERE address = ${args.address}`;
      if (count === 0) {
        this.loggingService.debug(
          `Error deleting account ${args.address}: not found`,
        );
      }
    } finally {
      const keys = [
        CacheRouter.getAccountCacheDir(args.address).key,
        CacheRouter.getAccountDataSettingsCacheDir(args.address).key,
        CacheRouter.getCounterfactualSafesCacheDir(args.address).key,
      ];
      await Promise.all(keys.map((key) => this.cacheService.deleteByKey(key)));
    }
  }

  async getDataTypes(): Promise<AccountDataType[]> {
    const cacheDir = CacheRouter.getAccountDataTypesCacheDir();
    return getFromCacheOrExecuteAndCache<AccountDataType[]>(
      this.loggingService,
      this.cacheService,
      cacheDir,
      this.sql<AccountDataType[]>`SELECT * FROM account_data_types`,
      MAX_TTL,
    );
  }

  async getAccountDataSettings(args: {
    address: `0x${string}`;
  }): Promise<AccountDataSetting[]> {
    const account = await this.getAccount(args);
    const cacheDir = CacheRouter.getAccountDataSettingsCacheDir(args.address);
    return getFromCacheOrExecuteAndCache<AccountDataSetting[]>(
      this.loggingService,
      this.cacheService,
      cacheDir,
      this.sql<AccountDataSetting[]>`
        SELECT ads.* FROM account_data_settings ads INNER JOIN account_data_types adt
          ON ads.account_data_type_id = adt.id
        WHERE ads.account_id = ${account.id} AND adt.is_active IS TRUE;`,
      this.defaultExpirationTimeInSeconds,
    );
  }

  /**
   * Adds or updates the existing account data settings for a given address/account.
   * Requirements:
   * - The account must exist.
   * - The data type must exist.
   * - The data type must be active.
   *
   * @param address - account address.
   * @param upsertAccountDataSettings {@link UpsertAccountDataSettingsDto} object.
   * @returns {Array<AccountDataSetting>} inserted account data settings.
   */
  async upsertAccountDataSettings(args: {
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<AccountDataSetting[]> {
    const { accountDataSettings } = args.upsertAccountDataSettingsDto;
    await this.checkDataTypes(accountDataSettings);
    const account = await this.getAccount({ address: args.address });

    const result = await this.sql.begin(async (sql) => {
      await Promise.all(
        accountDataSettings.map(async (accountDataSetting) => {
          return sql`
            INSERT INTO account_data_settings (account_id, account_data_type_id, enabled)
            VALUES (${account.id}, ${accountDataSetting.dataTypeId}, ${accountDataSetting.enabled})
            ON CONFLICT (account_id, account_data_type_id) DO UPDATE SET enabled = EXCLUDED.enabled
          `.catch((e) => {
            throw new UnprocessableEntityException(
              `Error updating data settings: ${asError(e).message}`,
            );
          });
        }),
      );
      return sql<[AccountDataSetting]>`
        SELECT * FROM account_data_settings WHERE account_id = ${account.id}`;
    });

    const cacheDir = CacheRouter.getAccountDataSettingsCacheDir(args.address);
    await this.cacheService.set(
      cacheDir,
      JSON.stringify(result),
      this.defaultExpirationTimeInSeconds,
    );
    return result;
  }

  private async checkDataTypes(
    accountDataSettings: UpsertAccountDataSettingsDto['accountDataSettings'],
  ): Promise<void> {
    const dataTypes = await this.getDataTypes();
    const activeDataTypeIds = dataTypes
      .filter((dt) => dt.is_active)
      .map((ads) => ads.id);
    if (
      !accountDataSettings.every((ads) =>
        activeDataTypeIds.includes(Number(ads.dataTypeId)),
      )
    ) {
      throw new UnprocessableEntityException(
        `Data types not found or not active.`,
      );
    }
  }
}
