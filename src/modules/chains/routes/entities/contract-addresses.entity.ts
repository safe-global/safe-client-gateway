import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractAddresses as DomainContractAddresses } from '@/modules/chains/domain/entities/contract-addresses.entity';
import type { Address } from 'viem';

export class ContractAddresses implements DomainContractAddresses {
  @ApiPropertyOptional({ type: String, nullable: true })
  safeSingletonAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safeProxyFactoryAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  multiSendAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  multiSendCallOnlyAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  fallbackHandlerAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  signMessageLibAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  createCallAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  simulateTxAccessorAddress!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safeWebAuthnSignerFactoryAddress!: Address | null;
}
