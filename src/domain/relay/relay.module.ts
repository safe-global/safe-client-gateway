import { Module } from '@nestjs/common';
import { SafeContractHelper } from './contracts/safe-contract.helper';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';

@Module({
  providers: [LimitAddressesMapper, Erc20ContractHelper, SafeContractHelper],
  exports: [LimitAddressesMapper],
})
export class RelayModule {}
