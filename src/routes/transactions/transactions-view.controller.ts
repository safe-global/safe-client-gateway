import { DataDecodedRepositoryModule } from '@/domain/data-decoder/data-decoded.repository.interface';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { GPv2DecoderModule } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import {
  TransactionDataDto,
  TransactionDataDtoSchema,
} from '@/routes/common/entities/transaction-data.dto.entity';
import {
  BaselineConfirmationView,
  ConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { CowSwapConfirmationView } from '@/routes/transactions/entities/swaps/swap-confirmation-view.entity';
import { CowSwapTwapConfirmationView } from '@/routes/transactions/entities/swaps/twap-confirmation-view.entity';
import { NativeStakingDepositConfirmationView } from '@/routes/transactions/entities/staking/native-staking-deposit-confirmation-view.entity';
import { NativeStakingValidatorsExitConfirmationView } from '@/routes/transactions/entities/staking/native-staking-validators-exit-confirmation-view.entity';
import { NativeStakingWithdrawConfirmationView } from '@/routes/transactions/entities/staking/native-staking-withdraw-confirmation-view.entity';
import { KilnNativeStakingHelperModule } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { SwapAppsHelperModule } from '@/routes/transactions/helpers/swap-apps.helper';
import { SwapOrderHelperModule } from '@/routes/transactions/helpers/swap-order.helper';
import { TwapOrderHelperModule } from '@/routes/transactions/helpers/twap-order.helper';
import { NativeStakingMapperModule } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { TransactionsViewService } from '@/routes/transactions/transactions-view.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  HttpCode,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsViewController {
  constructor(private readonly service: TransactionsViewService) {}

  @HttpCode(200)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BaselineConfirmationView) },
        { $ref: getSchemaPath(CowSwapConfirmationView) },
        { $ref: getSchemaPath(CowSwapTwapConfirmationView) },
        { $ref: getSchemaPath(NativeStakingDepositConfirmationView) },
        { $ref: getSchemaPath(NativeStakingValidatorsExitConfirmationView) },
        { $ref: getSchemaPath(NativeStakingWithdrawConfirmationView) },
      ],
    },
  })
  @ApiExtraModels(
    BaselineConfirmationView,
    CowSwapConfirmationView,
    CowSwapTwapConfirmationView,
    NativeStakingDepositConfirmationView,
    NativeStakingValidatorsExitConfirmationView,
    NativeStakingWithdrawConfirmationView,
  )
  @ApiOperation({
    description:
      'Deprecated in favour of /v1/chains/:chainId/transactions/:safeAddress/preview.',
    deprecated: true,
  })
  @Post('chains/:chainId/safes/:safeAddress/views/transaction-confirmation')
  async getTransactionConfirmationView(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(TransactionDataDtoSchema))
    transactionDataDto: TransactionDataDto,
  ): Promise<ConfirmationView> {
    return this.service.getTransactionConfirmationView({
      chainId,
      safeAddress,
      transactionDataDto,
    });
  }
}

@Module({
  imports: [
    DataDecodedRepositoryModule,
    GPv2DecoderModule,
    KilnNativeStakingHelperModule,
    NativeStakingMapperModule,
    SwapAppsHelperModule,
    SwapOrderHelperModule,
    SwapsRepositoryModule,
    TwapOrderHelperModule,
  ],
  providers: [TransactionsViewService, ComposableCowDecoder, KilnDecoder],
  controllers: [TransactionsViewController],
})
export class TransactionsViewControllerModule {}
