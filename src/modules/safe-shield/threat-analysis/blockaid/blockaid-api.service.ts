import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import Blockaid from '@blockaid/client';
import { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import { JsonRpcScanParams } from '@blockaid/client/resources/evm/json-rpc';
import { Injectable } from '@nestjs/common';
import { Address, numberToHex } from 'viem';

@Injectable()
export class BlockaidApi implements IBlockaidApi {
  private readonly blockaidClient: Blockaid;

  constructor() {
    this.blockaidClient = new Blockaid();
  }

  async scanTransaction(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<TransactionScanResponse> {
    const chain = numberToHex(Number(chainId));
    const params: JsonRpcScanParams = {
      chain,
      data: {
        method: 'eth_signTypedData_v4',
        params: [safeAddress, message],
      },
      options: ['simulation', 'validation'],
      metadata: { domain: origin ?? '' },
      account_address: walletAddress,
    };

    return await this.blockaidClient.evm.jsonRpc.scan(params);
  }
}
