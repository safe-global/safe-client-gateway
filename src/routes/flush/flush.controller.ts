import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BasicAuthGuard } from '../common/auth/basic-auth.guard';
import { InvalidationPatternDto } from './entities/invalidation-pattern.dto.entity';
import { FlushService } from './flush.service';
import { InvalidationPatternDtoValidationPipe } from './pipes/invalidation-pattern.dto.validation.pipe';

@ApiTags('flush')
@Controller({
  path: '',
  version: '2',
})
export class FlushController {
  constructor(private readonly flushService: FlushService) {}

  @UseGuards(BasicAuthGuard)
  @ApiOkResponse()
  @HttpCode(200)
  @Post('flush')
  async flush(
    @Body(InvalidationPatternDtoValidationPipe)
    invalidationPatternDto: InvalidationPatternDto,
  ): Promise<void> {
    return this.flushService.flush(invalidationPatternDto);
  }
}
