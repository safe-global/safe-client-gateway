import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { GetDataDecodedDto } from '@/routes/data-decode/entities/get-data-decoded.dto.entity';
import { GetDataDecodedDtoValidationPipe } from '@/routes/data-decode/pipes/get-data-decoded.dto.validation.pipe';

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
    @Body(GetDataDecodedDtoValidationPipe) getDataDecodedDto: GetDataDecodedDto,
  ): Promise<DataDecoded> {
    return this.dataDecodedService.getDataDecoded({
      chainId,
      getDataDecodedDto,
    });
  }
}
