import { ApiProperty } from '@nestjs/swagger';
import type { Wallet } from '@/domain/wallets/entities/wallet.entity';

export class WalletAddedToUser implements Pick<Wallet, 'id'> {
  @ApiProperty()
  id!: number;
}
