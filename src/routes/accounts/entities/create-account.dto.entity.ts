import { CreateAccountDto as DomainCreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@/domain/common/entities/name.schema';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto implements DomainCreateAccountDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  address!: `0x${string}`;
  @ApiProperty()
  name!: string;
}
