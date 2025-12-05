import {
  IBlockaidApi,
  type TransactionScanResponseWithRequestId,
} from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { ReportEvent } from '@/modules/safe-shield/entities/dtos/report-false-result.dto';
import { BLOCKAID_REQUEST_ID_HEADER } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import Blockaid from '@blockaid/client';
import { JsonRpcScanParams } from '@blockaid/client/resources/evm/json-rpc';
import { Inject, Injectable } from '@nestjs/common';
import { Address, numberToHex } from 'viem';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { BlockaidScanLogSchema } from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-log.schema';

@Injectable()
export class BlockaidApi implements IBlockaidApi {
  private readonly blockaidClient: Blockaid;

  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.blockaidClient = new Blockaid();
  }

  public async scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<TransactionScanResponseWithRequestId> {
    const chain = numberToHex(Number(chainId));
    const params: JsonRpcScanParams = {
      chain,
      data: {
        method: 'eth_signTypedData_v4',
        params: [safeAddress, message],
      },
      options: ['simulation', 'validation'],
      metadata: origin ? { domain: origin } : { non_dapp: true as const },
      account_address: walletAddress,

      // Temporary disable state override (to be reverted in
      // https://linear.app/safe-global/issue/COR-802/put-back-blockaid-state-override)
      // state_override: {
      //   [safeAddress]: {
      //     stateDiff: {
      //       // Set the Guard storage slot to zero address to disable guard
      //       [GUARD_STORAGE_POSITION]:
      //         '0x0000000000000000000000000000000000000000000000000000000000000000',
      //     },
      //   },
      // },
    };

    const { data, response } = await this.blockaidClient.evm.jsonRpc
      .scan(params)
      .withResponse();
    const request_id =
      response.headers.get(BLOCKAID_REQUEST_ID_HEADER) ?? undefined;

    this.logScanResponse({ ...data, request_id });
    return { ...data, request_id };
  }

  public async reportTransaction(args: {
    event: ReportEvent;
    details: string;
    requestId: string;
  }): Promise<void> {
    await this.blockaidClient.evm.transaction.report({
      event: args.event,
      details: args.details,
      report: {
        type: 'request_id',
        request_id: args.requestId,
      },
    });
  }

  private logScanResponse(
    response: TransactionScanResponseWithRequestId,
  ): void {
    const logData = BlockaidScanLogSchema.parse({ ...response });
    this.loggingService.info({
      message: 'Blockaid scan response',
      response: logData,
    });
  }
}
