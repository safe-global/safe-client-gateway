import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiOkResponse } from '@nestjs/swagger';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { InvalidationPatternDto } from '@/routes/flush/entities/invalidation-pattern.dto.entity';
import { FlushService } from '@/routes/flush/flush.service';
import { InvalidationPatternDtoValidationPipe } from '@/routes/flush/pipes/invalidation-pattern.dto.validation.pipe';

@Controller({
  path: '',
  version: '2',
})
@ApiExcludeController()
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
