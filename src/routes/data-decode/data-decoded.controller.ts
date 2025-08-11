import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
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

  @ApiOperation({
    summary: 'Decode transaction data',
    description:
      'Decodes raw transaction data into human-readable format using contract ABIs. This helps understand what functions are being called and with what parameters.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the transaction will be executed',
    example: '1',
  })
  @ApiBody({
    type: TransactionDataDto,
    description:
      'Transaction data to decode, including contract address and data payload',
  })
  @ApiOkResponse({
    type: DataDecoded,
    description:
      'Transaction data decoded successfully with method name, parameters, and values',
  })
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
