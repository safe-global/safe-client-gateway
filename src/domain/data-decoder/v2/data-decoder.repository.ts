import { Inject, Injectable } from '@nestjs/common';
import {
  DataDecoded,
  DataDecodedSchema,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import { Page } from '@/domain/entities/page.entity';
import {
  Contract,
  ContractPageSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';

@Injectable()
export class DataDecoderRepository implements IDataDecoderRepository {
  constructor(
    @Inject(IDataDecoderApi)
    private readonly dataDecoderApi: IDataDecoderApi,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  public async getDecodedData(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<DataDecoded> {
    const dataDecoded = await this.dataDecoderApi.getDecodedData(args);
    return DataDecodedSchema.parse(dataDecoded);
  }

  public async getContracts(args: {
    chainIds: Array<string>;
    address: `0x${string}`;
  }): Promise<Page<Contract>> {
    const contracts = await this.dataDecoderApi.getContracts(args);
    return ContractPageSchema.parse(contracts);
  }

  public async getTransactionDataDecoded(args: {
    chainId: string;
    transaction: Transaction;
  }): Promise<DataDecoded | null> {
    const data = this.getDataDecodedData(args.transaction);

    if (!data || data === '0x') {
      return null;
    }

    try {
      return await this.getDecodedData({
        chainId: args.chainId,
        data,
        to: this.getDataDecodedTo(args.transaction),
      });
    } catch (e) {
      this.loggingService.warn(
        `Error decoding transaction data: ${asError(e).message}`,
      );
      return null;
    }
  }

  private getDataDecodedData(transaction: Transaction): `0x${string}` | null {
    // Multisig transaction
    if ('data' in transaction) {
      return transaction.data;
    }
    // Creation
    if ('setupData' in transaction) {
      return transaction.setupData;
    }

    throw Error('Unrecognized transaction type');
  }

  private getDataDecodedTo(transaction: Transaction): `0x${string}` {
    // Multisig transaction
    if ('to' in transaction) {
      return transaction.to;
    }
    // Native transfer
    if ('from' in transaction) {
      return transaction.from;
    }
    // Creation
    if ('factoryAddress' in transaction) {
      return transaction.factoryAddress;
    }

    throw Error('Unrecognized transaction type');
  }
}
