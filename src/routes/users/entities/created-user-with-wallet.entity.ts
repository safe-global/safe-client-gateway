import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@/domain/users/entities/user.entity';

export class CreatedUserWithWallet implements Pick<User, 'id'> {
  @ApiProperty()
  id!: number;
}
