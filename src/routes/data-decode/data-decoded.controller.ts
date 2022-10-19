import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateDataDecodedDto } from './entities/create-data-decoded.dto';
import { DataDecodedService } from './data-decoded.service';
import { DataDecoded } from './entities/data-decoded.entity';

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
    @Body() createDataDecodedDto: CreateDataDecodedDto,
  ): Promise<DataDecoded> {
    return this.dataDecodedService.getDataDecoded(
      chainId,
      createDataDecodedDto,
    );
  }
}
