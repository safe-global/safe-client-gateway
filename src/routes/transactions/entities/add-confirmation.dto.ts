import { ApiProperty } from '@nestjs/swagger';
import { AddConfirmationDto as DomainCreateConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import type { Address } from 'viem';

export class AddConfirmationDto implements DomainCreateConfirmationDto {
  @ApiProperty()
  signature!: Address;
}
