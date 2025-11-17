import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@/modules/users/domain/entities/user.entity';

export class CreatedUserWithWallet implements Pick<User, 'id'> {
  @ApiProperty()
  id!: number;
}
