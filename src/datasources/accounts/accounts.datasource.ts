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
    return this.sql<[AccountDataType]>`SELECT * FROM account_data_types`;
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
    const account = await this.getAccount(address);
    const dataTypes = await this.getDataTypes();
    const { accountDataSettings } = upsertAccountDataSettings;

    const result = [];
    for (const ads of accountDataSettings) {
      const dataType = dataTypes.find((dt) => dt.name === ads.dataTypeName);
      if (!dataType) {
        throw new UnprocessableEntityException('Invalid data type.');
      }
      if (!dataType.is_active) {
        throw new UnprocessableEntityException(
          `Data type ${dataType.name} is inactive.`,
        );
      }
      const [inserted] = await this.sql<[AccountDataSetting]>`
        INSERT INTO account_data_settings (account_id, account_data_type_id, enabled)
        VALUES (${account.id}, ${dataType.id}, ${ads.enabled})
        ON CONFLICT (account_id, account_data_type_id) DO UPDATE SET enabled = EXCLUDED.enabled
        RETURNING *
      `.catch((e) => {
        throw new UnprocessableEntityException(
          `Error updating data settings: ${asError(e).message}`,
        );
      });
      result.push(inserted);
    }

    return result;
  }
}
