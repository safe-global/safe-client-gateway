import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Address } from 'viem';
import { ThreatAnalysisRequest } from '../analysis-requests.entity';
import { TypedData } from '@/modules/messages/routes/entities/typed-data.entity';
/**
 * DTO for threat analysis request.
 *
 * Contains EIP-712 typed data and wallet information for comprehensive
 * threat analysis including signature farming, phishing attempts, and
 * malicious structured data patterns.
 */
export class ThreatAnalysisRequestDto implements ThreatAnalysisRequest {
  @ApiProperty({
    type: TypedData,
    description:
      'EIP-712 typed data to analyze for security threats. ' +
      'Contains domain, primaryType, types, and message fields ' +
      'following the EIP-712 standard for structured data signing.',
  })
  data!: TypedData;

  @ApiProperty({
    description: 'Address of the transaction signer/wallet',
  })
  walletAddress!: Address;

  @ApiPropertyOptional({
    description: 'Optional origin identifier for the request',
  })
  origin?: string;
}
