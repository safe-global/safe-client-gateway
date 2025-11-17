import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { Wallet } from '@/modules/wallets/domain/entities/wallet.entity';
import type { Address } from 'viem';

class UserWallet implements Pick<Wallet, 'id' | 'address'> {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  address!: Address;
}

@ApiExtraModels(UserWallet)
export class UserWithWallets implements Pick<User, 'id' | 'status'> {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: UserStatus })
  status!: keyof typeof UserStatus;

  @ApiProperty({ isArray: true, type: UserWallet })
  wallets!: Array<UserWallet>;
}
