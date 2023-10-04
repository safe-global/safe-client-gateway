import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { EventValidationPipe } from './pipes/event-validation.pipe';
import { CacheHooksService } from './cache-hooks.service';
import { BasicAuthGuard } from '../common/auth/basic-auth.guard';
import { ExecutedTransaction } from './entities/executed-transaction.entity';
import { NewConfirmation } from './entities/new-confirmation.entity';
import { PendingTransaction } from './entities/pending-transaction.entity';
import { IncomingToken } from './entities/incoming-token.entity';
import { OutgoingToken } from './entities/outgoing-token.entity';
import { IncomingEther } from './entities/incoming-ether.entity';
import { OutgoingEther } from './entities/outgoing-ether.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { ApiExcludeController } from '@nestjs/swagger';
import { MessageCreated } from './entities/message-created.entity';
import { NewMessageConfirmation } from './entities/new-message-confirmation.entity';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';

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
    await this.service.onEvent(eventPayload);
  }
}
