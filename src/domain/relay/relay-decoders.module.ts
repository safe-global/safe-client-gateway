import { Module } from '@nestjs/common';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { MultiSendDecoder } from '@/domain/contracts/contracts/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/contracts/safe-decoder.helper';

// TODO: Temporary until https://github.com/safe-global/safe-client-gateway/pull/1148 is merged
@Module({
  providers: [
    Erc20ContractHelper,
    SafeContractHelper,
    SafeDecoder,
    MultiSendDecoder,
    ProxyFactoryDecoder,
  ],
  exports: [
    Erc20ContractHelper,
    SafeContractHelper,
    SafeDecoder,
    MultiSendDecoder,
    ProxyFactoryDecoder,
  ],
})
export class RelayDecodersModule {}
