import {
  Body,
  Controller,
  HttpCode,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfirmationView } from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  TransactionDataDto,
  TransactionDataDtoSchema,
} from '@/routes/common/entities/transaction-data.dto.entity';
import { TransactionsViewService } from '@/routes/transactions/transactions-view.service';
import { DataDecodedRepositoryModule } from '@/domain/data-decoder/data-decoded.repository.interface';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsViewController {
  constructor(private readonly service: TransactionsViewService) {}

  @HttpCode(200)
  @ApiOkResponse({ type: ConfirmationView })
  @Post('chains/:chainId/safes/:safeAddress/views/transaction-confirmation')
  @ApiOperation({
    summary: 'Confirm Transaction View',
    description: 'This endpoint is experimental and may change.',
  })
  async getTransactionConfirmationView(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(TransactionDataDtoSchema))
    transactionDataDto: TransactionDataDto,
  ): Promise<ConfirmationView> {
    return this.service.getTransactionConfirmationView({
      chainId,
      transactionDataDto,
    });
  }
}

@Module({
  imports: [DataDecodedRepositoryModule],
  providers: [TransactionsViewService],
  controllers: [TransactionsViewController],
})
export class TransactionsViewControllerModule {}
