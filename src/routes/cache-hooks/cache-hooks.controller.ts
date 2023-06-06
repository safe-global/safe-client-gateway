import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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

@Controller({
  path: '',
  version: '1',
})
export class CacheHooksController {
  constructor(private readonly service: CacheHooksService) {}

  @UseGuards(BasicAuthGuard)
  @Post('/chains/:chainId/hooks/events')
  @HttpCode(200)
  async postEvent(
    @Param('chainId') chainId: string,
    @Body(EventValidationPipe)
    eventPayload:
      | ExecutedTransaction
      | NewConfirmation
      | PendingTransaction
      | IncomingToken
      | OutgoingToken
      | IncomingEther
      | OutgoingEther,
  ): Promise<void[]> {
    return await this.service.onEvent(chainId, eventPayload);
  }
}
