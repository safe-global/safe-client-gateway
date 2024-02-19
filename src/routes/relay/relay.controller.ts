import { Controller, Post, Param, Get, UseFilters, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { RelayService } from '@/routes/relay/relay.service';
import { RelayLimitReachedExceptionFilter } from '@/domain/relay/exception-filters/relay-limit-reached.exception-filter';
import { RelayDtoValidationPipe } from '@/routes/relay/pipes/relay.validation.pipe';

@ApiTags('relay')
@Controller({
  version: '1',
  path: 'chains/:chainId/relay',
})
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post()
  @UseFilters(RelayLimitReachedExceptionFilter)
  async relay(
    @Param('chainId') chainId: string,
    @Body(RelayDtoValidationPipe)
    relayDto: RelayDto,
  ): Promise<{ taskId: string }> {
    return this.relayService.relay({ chainId, relayDto });
  }

  @Get(':safeAddress')
  async getRelaysRemaining(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<{
    remaining: number;
    limit: number;
  }> {
    return this.relayService.getRelaysRemaining({ chainId, safeAddress });
  }
}
