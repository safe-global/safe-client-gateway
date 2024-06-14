import { Account } from '@/datasources/accounts/entities/account.entity';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
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
    const [account] = await this.sql<[Account]>`INSERT INTO
                                                    accounts (address)
                                                VALUES
                                                    (${address}) RETURNING *`.catch(
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
    const [account] = await this.sql<[Account]>`SELECT
                                                    *
                                                FROM
                                                    accounts
                                                WHERE
                                                    address = ${address}`.catch(
      (e) => {
        this.loggingService.info(
          `Error getting account: ${asError(e).message}`,
        );
        return [];
      },
    );

    if (!account) {
      throw new NotFoundException('Error getting account.');
    }

    return account;
  }
}
