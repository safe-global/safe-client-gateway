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
  UnprocessableEntityException,
} from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class AccountsDatasource implements IAccountsDatasource {
  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async createAccount(address: `0x${string}`): Promise<Account> {
    const [account] = await this.sql<
      [Account]
    >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`.catch(
      (e) => {
        this.loggingService.warn(
          `Error creating account: ${asError(e).message}`,
        );
        return [];
      },
    );

    if (!account) {
      throw new UnprocessableEntityException('Error creating account.');
    }

    return account;
  }

  async getAccount(address: `0x${string}`): Promise<Account> {
    const [account] = await this.sql<
      [Account]
    >`SELECT * FROM accounts WHERE address = ${address}`.catch((e) => {
      this.loggingService.info(`Error getting account: ${asError(e).message}`);
      return [];
    });

    if (!account) {
      throw new NotFoundException('Error getting account.');
    }

    return account;
  }

  async deleteAccount(address: `0x${string}`): Promise<void> {
    const { count } = await this
      .sql`DELETE FROM accounts WHERE address = ${address}`;

    if (count === 0) {
      this.loggingService.debug(`Error deleting account ${address}: not found`);
    }
  }

  async getDataTypes(): Promise<AccountDataType[]> {
    // TODO: add caching with clearing mechanism.
    return this.sql<[AccountDataType]>`SELECT * FROM account_data_types`;
  }

  async getAccountDataSettings(
    address: `0x${string}`,
  ): Promise<AccountDataSetting[]> {
    const account = await this.getAccount(address);
    return this.sql<[AccountDataSetting]>`
      SELECT ads.* FROM account_data_settings ads INNER JOIN account_data_types adt
        ON ads.account_data_type_id = adt.id
      WHERE ads.account_id = ${account.id} AND adt.is_active IS TRUE;
    `;
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
  async upsertAccountDataSettings(
    address: `0x${string}`,
    upsertAccountDataSettings: UpsertAccountDataSettingsDto,
  ): Promise<AccountDataSetting[]> {
    const { accountDataSettings } = upsertAccountDataSettings;
    await this.checkDataTypes(accountDataSettings);
    const account = await this.getAccount(address);
    return this.sql.begin(async (sql) => {
      await Promise.all(
        accountDataSettings.map(async (accountDataSetting) => {
          return sql`
            INSERT INTO account_data_settings (account_id, account_data_type_id, enabled)
            VALUES (${account.id}, ${accountDataSetting.id}, ${accountDataSetting.enabled})
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
  }

  private getActiveDataTypes(): Promise<AccountDataType[]> {
    // TODO: add caching with clearing mechanism.
    return this.sql<[AccountDataType]>`
      SELECT * FROM account_data_types WHERE is_active IS TRUE;
    `;
  }

  private async checkDataTypes(
    accountDataSettings: UpsertAccountDataSettingsDto['accountDataSettings'],
  ): Promise<void> {
    const activeDataTypes = await this.getActiveDataTypes();
    const activeDataTypeIds = activeDataTypes.map((ads) => ads.id);
    if (
      !accountDataSettings.every((ads) =>
        activeDataTypeIds.includes(Number(ads.id)),
      )
    ) {
      throw new UnprocessableEntityException(
        `Data types not found or not active.`,
      );
    }
  }
}
