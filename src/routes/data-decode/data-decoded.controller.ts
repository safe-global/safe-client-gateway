import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import {
  TransactionDataDto,
  TransactionDataDtoSchema,
} from '@/routes/common/entities/transaction-data.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('data-decoded')
@Controller({
  path: '',
  version: '1',
})
export class DataDecodedController {
  constructor(private readonly dataDecodedService: DataDecodedService) {}

  @ApiOkResponse({ type: DataDecoded })
  @HttpCode(200)
  @Post('chains/:chainId/data-decoder')
  async getDataDecoded(
    @Param('chainId') chainId: string,
    @Body(new ValidationPipe(TransactionDataDtoSchema))
    getDataDecodedDto: TransactionDataDto,
  ): Promise<DataDecoded> {
    return this.dataDecodedService.getDataDecoded({
      chainId,
      getDataDecodedDto,
    });
  }
}
