import { CreateAccountDto as DomainCreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto implements DomainCreateAccountDto {
  @ApiProperty()
  address!: `0x${string}`;
}
