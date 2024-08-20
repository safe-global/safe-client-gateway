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
import {
  BaselineConfirmationView,
  ConfirmationView,
  CowSwapConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { TransactionsViewService } from '@/routes/transactions/transactions-view.service';
import { DataDecodedRepositoryModule } from '@/domain/data-decoder/data-decoded.repository.interface';
import { SwapOrderHelperModule } from '@/routes/transactions/helpers/swap-order.helper';
import {
  TransactionDataDto,
  TransactionDataDtoSchema,
} from '@/routes/common/entities/transaction-data.dto.entity';
import { GPv2DecoderModule } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { TwapOrderHelperModule } from '@/routes/transactions/helpers/twap-order.helper';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { SwapAppsHelperModule } from '@/routes/transactions/helpers/swap-apps.helper';
import { NativeStakingDepositConfirmationView } from '@/routes/transactions/entities/staking/native-staking-confirmation-view.entity';
import { KilnNativeStakingHelperModule } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { NativeStakingMapperModule } from '@/routes/transactions/mappers/common/native-staking.mapper';

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
        { $ref: getSchemaPath(NativeStakingDepositConfirmationView) },
      ],
    },
  })
  @ApiExtraModels(
    BaselineConfirmationView,
    CowSwapConfirmationView,
    NativeStakingDepositConfirmationView,
  )
  @ApiOperation({
    summary: 'Confirm Transaction View',
    description: 'This endpoint is experimental and may change.',
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
    SwapOrderHelperModule,
    TwapOrderHelperModule,
    SwapsRepositoryModule,
    SwapAppsHelperModule,
  ],
  providers: [TransactionsViewService, ComposableCowDecoder],
  controllers: [TransactionsViewController],
})
export class TransactionsViewControllerModule {}
