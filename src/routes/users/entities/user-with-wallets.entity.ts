import { User } from '@/domain/users/entities/user.entity';
import { Wallet } from '@/domain/users/entities/wallet.entity';
import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

class UserWallet implements Pick<Wallet, 'id' | 'address'> {
  @ApiProperty()
  id!: Wallet['id'];

  @ApiProperty()
  address!: Wallet['address'];
}

@ApiExtraModels(UserWallet)
export class UserWithWallets {
  @ApiProperty()
  id!: User['id'];

  @ApiProperty()
  status!: User['status'];

  @ApiProperty({ isArray: true })
  wallets!: Array<UserWallet>;
}
