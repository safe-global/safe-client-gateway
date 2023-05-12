import { ApiProperty } from '@nestjs/swagger';
import { CreateConfirmationDto as DomainCreateConfirmationDto } from '../../../domain/transactions/entities/create-confirmation.dto.entity';

export class CreateConfirmationDto implements DomainCreateConfirmationDto {
  @ApiProperty()
  signedSafeTxHash: string;
}
