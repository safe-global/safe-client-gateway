import { User, UserStatus } from '@/domain/users/entities/user.entity';
import { Wallet } from '@/domain/users/entities/wallet.entity';
import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

class UserWallet implements Pick<Wallet, 'id' | 'address'> {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  address!: `0x${string}`;
}

@ApiExtraModels(UserWallet)
export class UserWithWallets implements Pick<User, 'id' | 'status'> {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ isArray: true, type: UserWallet })
  wallets!: Array<UserWallet>;
}
