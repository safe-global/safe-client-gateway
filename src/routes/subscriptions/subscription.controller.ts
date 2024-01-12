import { Controller, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SubscriptionService } from '@/routes/subscriptions/subscription.service';

@Controller({
  path: 'subscriptions',
  version: '1',
})
@ApiExcludeController()
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Delete()
  async unsubscribe(
    @Query('category') category: string,
    @Query('token', new ParseUUIDPipe()) token: string,
  ): Promise<void> {
    return this.service.unsubscribe({ notificationTypeKey: category, token });
  }

  @Delete('all')
  async unsubscribeAll(
    @Query('token', new ParseUUIDPipe()) token: string,
  ): Promise<void> {
    return this.service.unsubscribeAll({ token });
  }
}
