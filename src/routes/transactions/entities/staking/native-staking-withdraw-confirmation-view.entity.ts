import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingWithdrawConfirmationView implements Baseline {
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingWithdraw],
  })
  type = DecodedType.KilnNativeStakingWithdraw;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  value: string;

  @ApiProperty()
  rewards: string;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    value: string;
    rewards: string;
    tokenInfo: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.value = args.value;
    this.rewards = args.rewards;
    this.tokenInfo = args.tokenInfo;
  }
}
