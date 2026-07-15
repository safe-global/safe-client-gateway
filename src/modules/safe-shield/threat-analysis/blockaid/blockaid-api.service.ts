// SPDX-License-Identifier: FSL-1.1-MIT
import Blockaid from '@blockaid/client';
import type { AddressBulkScanResponse } from '@blockaid/client/resources/evm/address-bulk';
import type { TransactionScanSupportedChain } from '@blockaid/client/resources/evm/evm';
import type {
  JsonRpcScanParams,
  JsonRpcScanResponse,
} from '@blockaid/client/resources/evm/json-rpc';
import { Inject, Injectable } from '@nestjs/common';
import { type Address, numberToHex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { ReportEvent } from '@/modules/safe-shield/entities/dtos/report-false-result.dto';
import {
  BLOCKAID_REQUEST_ID_HEADER,
  BLOCKAID_SCAN_DOMAIN,
} from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import type { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { BlockaidScanLogSchema } from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-log.schema';
import {
  type BlockaidScanResponse,
  BlockaidScanResponseSchema,
} from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-response.schema';

@Injectable()
export class BlockaidApi implements IBlockaidApi {
  private readonly blockaidClient: Blockaid;
  private readonly addressScanTimeoutMs: number;

  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.blockaidClient = new Blockaid();
    this.addressScanTimeoutMs = this.configurationService.getOrThrow<number>(
      'safeShield.maliciousAddressScan.timeoutMs',
    );
  }

  public async scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<BlockaidScanResponse> {
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
    const parsedResponse = BlockaidScanResponseSchema.parse({
      ...data,
      request_id,
    });

    return parsedResponse;
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

  public scanAddressBulk(
    chain: TransactionScanSupportedChain,
    addresses: Array<string>,
  ): Promise<AddressBulkScanResponse> {
    return this.blockaidClient.evm.addressBulk.scan(
      { addresses, chain, metadata: { domain: BLOCKAID_SCAN_DOMAIN } },
      { timeout: this.addressScanTimeoutMs, maxRetries: 0 },
    );
  }

  private logScanResponse(
    response: JsonRpcScanResponse & { request_id: string | undefined },
  ): void {
    const logData = BlockaidScanLogSchema.parse({ ...response });
    this.loggingService.info({
      message: 'Blockaid scan response',
      response: logData,
    });
  }
}
