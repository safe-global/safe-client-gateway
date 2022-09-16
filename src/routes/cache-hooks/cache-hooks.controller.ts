import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ExecutedTransaction } from './entities/executed-transaction.entity';
import { NewConfirmation } from './entities/new-confirmation.entity';
import { PendingTransaction } from './entities/pending-transaction.entity';
import { EventValidationPipe } from './pipes/event-validation.pipe';
import { CacheHooksService } from './cache-hooks.service';

@Controller({
  path: '',
  version: '1',
})
export class CacheHooksController {
  constructor(private readonly service: CacheHooksService) {}

  // TODO this endpoint should implement authentication
  @Post('/chains/:chainId/hooks/events')
  @HttpCode(200)
  async postEvent(
    @Param('chainId') chainId: string,
    @Body(EventValidationPipe)
    eventPayload: ExecutedTransaction | NewConfirmation | PendingTransaction,
  ): Promise<void> {
    return await this.service.onEvent(chainId, eventPayload);
  }
}
