import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';
import { ExecutedTransaction } from '@/routes/cache-hooks/entities/executed-transaction.entity';
import { IncomingEther } from '@/routes/cache-hooks/entities/incoming-ether.entity';
import { IncomingToken } from '@/routes/cache-hooks/entities/incoming-token.entity';
import { MessageCreated } from '@/routes/cache-hooks/entities/message-created.entity';
import { ModuleTransaction } from '@/routes/cache-hooks/entities/module-transaction.entity';
import { NewConfirmation } from '@/routes/cache-hooks/entities/new-confirmation.entity';
import { NewMessageConfirmation } from '@/routes/cache-hooks/entities/new-message-confirmation.entity';
import { OutgoingEther } from '@/routes/cache-hooks/entities/outgoing-ether.entity';
import { OutgoingToken } from '@/routes/cache-hooks/entities/outgoing-token.entity';
import { PendingTransaction } from '@/routes/cache-hooks/entities/pending-transaction.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';
import { EventValidationPipe } from '@/routes/cache-hooks/pipes/event-validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class CacheHooksController {
  constructor(private readonly service: CacheHooksService) {}

  @UseGuards(BasicAuthGuard)
  @Post('/hooks/events')
  @HttpCode(200)
  async postEvent(
    @Body(EventValidationPipe)
    eventPayload:
      | ChainUpdate
      | ExecutedTransaction
      | IncomingEther
      | IncomingToken
      | MessageCreated
      | ModuleTransaction
      | NewConfirmation
      | NewMessageConfirmation
      | OutgoingToken
      | OutgoingEther
      | PendingTransaction
      | SafeAppsUpdate,
  ): Promise<void> {
    this.service.onEvent(eventPayload);
  }
}
