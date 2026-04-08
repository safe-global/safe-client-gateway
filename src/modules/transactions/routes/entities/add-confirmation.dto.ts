// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { AddConfirmationDto as DomainCreateConfirmationDto } from '@/modules/transactions/domain/entities/add-confirmation.dto.entity';
import type { Address } from 'viem';

export class AddConfirmationDto implements DomainCreateConfirmationDto {
  @ApiProperty()
  signature!: Address;
}
