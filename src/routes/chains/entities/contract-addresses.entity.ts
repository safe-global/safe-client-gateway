import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractAddresses as DomainContractAddresses } from '@/domain/chains/entities/contract-addresses.entity';

export class ContractAddresses implements DomainContractAddresses {
  @ApiPropertyOptional({ type: String, nullable: true })
  safeSingletonAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safeProxyFactoryAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  multiSendAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  multiSendCallOnlyAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  fallbackHandlerAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  signMessageLibAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  createCallAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  simulateTxAccessorAddress!: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safeWebAuthnSignerFactoryAddress!: `0x${string}` | null;
}
