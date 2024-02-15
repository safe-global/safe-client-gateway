import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeDecoder } from '@/domain/contracts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/contracts/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';

@Module({
  providers: [
    LimitAddressesMapper,
    // TODO: Look into refactoring these with `abi-decoder`
    Erc20ContractHelper,
    // TODO: Generify AlertsDecodersModule and import here
    SafeDecoder,
    MultiSendDecoder,
    ProxyFactoryDecoder,
  ],
  exports: [LimitAddressesMapper],
})
export class RelayModule {}
