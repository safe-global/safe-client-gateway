import { ApiProperty } from '@nestjs/swagger';
import type { Wallet } from '@/modules/wallets/domain/entities/wallet.entity';

export class WalletAddedToUser implements Pick<Wallet, 'id'> {
  @ApiProperty()
  id!: number;
}
