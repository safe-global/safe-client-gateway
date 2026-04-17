import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AddConfirmationDto as DomainCreateConfirmationDto } from '@/modules/transactions/domain/entities/add-confirmation.dto.entity';

export class AddConfirmationDto implements DomainCreateConfirmationDto {
  @ApiProperty()
  signature!: Address;
}
