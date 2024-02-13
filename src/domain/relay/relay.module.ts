import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';

@Module({
  providers: [
    LimitAddressesMapper,
    // TODO: Look into refactoring these with `abi-decoder`
    Erc20ContractHelper,
    SafeContractHelper,
    // TODO: Generify AlertsDecodersModule and import here
    MultiSendDecoder,
  ],
  exports: [LimitAddressesMapper],
})
export class RelayModule {}
