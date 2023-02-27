import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatedMessageConfirmation } from './created-message-confirmation.entity';

export class CreatedMessage {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  modified: Date;
  @ApiProperty()
  safe: string;
  @ApiProperty()
  messageHash: string;
  @ApiProperty()
  message: string | unknown;
  @ApiProperty()
  proposedBy: string;
  @ApiPropertyOptional()
  safeAppId: number | null;
  @ApiProperty()
  confirmations: CreatedMessageConfirmation[];
  @ApiPropertyOptional()
  preparedSignature: string | null;
}
