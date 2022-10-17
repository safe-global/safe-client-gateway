import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateDataDecodedDto } from './entities/create-data-decoded.dto';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';
import { DataDecodedService } from './data-decoded.service';
import { DataDecoded as ApiDataDecoded } from './entities/data-decoded.entity';

@ApiTags('data-decoded')
@Controller({
  path: '',
  version: '1',
})
export class DataDecodedController {
  constructor(private readonly dataDecodedService: DataDecodedService) {}

  @ApiOkResponse({ type: ApiDataDecoded })
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
