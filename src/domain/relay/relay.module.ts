import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';

@Module({
  providers: [LimitAddressesMapper, Erc20ContractHelper, SafeContractHelper],
  exports: [LimitAddressesMapper],
})
export class RelayModule {}
