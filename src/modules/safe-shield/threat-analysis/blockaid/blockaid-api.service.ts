import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import Blockaid from '@blockaid/client';
import { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import { JsonRpcScanParams } from '@blockaid/client/resources/evm/json-rpc';
import { Injectable } from '@nestjs/common';
import { Address, stringToHex } from 'viem';

@Injectable()
export class BlockaidApi implements IBlockaidApi {
  private readonly blockaidClient: Blockaid;

  constructor() {
    this.blockaidClient = new Blockaid();
  }

  //    data: {
  //     method: 'eth_signTypedData_v4',
  //     params: [
  //       '0x49c73c9d361c04769a452E85D343b41aC38e0EE4',
  //       '{"domain":{"chainId":1,"name":"Aave interest bearing WETH","version":"1","verifyingContract":"0x030ba81f1c18d280636f32af80b9aad02cf0854e"},"message":{"owner":"0x49c73c9d361c04769a452E85D343b41aC38e0EE4","spender":"0xa74cbd5b80f73b5950768c8dc467f1c6307c00fd","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935","nonce":"0","deadline":"1988064000","holder":"0x49c73c9d361c04769a452E85D343b41aC38e0EE4"},"primaryType":"Permit","types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
  //     ],
  //   }
  //TODO caching ?
  async scanTransaction(
    chainId: string,
    safeAddress: Address,
    message: string,
  ): Promise<TransactionScanResponse> {
    const chain = stringToHex(chainId);
    const params: JsonRpcScanParams = {
      chain,
      data: {
        method: 'eth_signTypedData_v4',
        params: [safeAddress, message],
      },
      options: ['simulation', 'validation'],
      //    account_address: walletAddress, //TODO in wallet: signer address
      metadata: { domain: 'https://example.com' }, //TODO what is this for Safe?
    };

    return await this.blockaidClient.evm.jsonRpc.scan(params);
  }
}
