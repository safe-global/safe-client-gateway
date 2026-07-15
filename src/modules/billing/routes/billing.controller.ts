// SPDX-License-Identifier: FSL-1.1-MIT
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { BillingWebhookEvent } from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import { BillingWebhookEventSchema } from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import { BillingWebhookService } from '@/modules/billing/routes/billing-webhook.service';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class BillingController {
  public constructor(
    private readonly billingWebhookService: BillingWebhookService,
  ) {}

  @UseGuards(BillingWebhookAuthGuard)
  @Post('/billing/webhooks')
  @HttpCode(202)
  public async postWebhook(
    // Origin is authenticated by BillingWebhookAuthGuard.
    @Body(new ValidationPipe(BillingWebhookEventSchema))
    event: BillingWebhookEvent,
  ): Promise<void> {
    await this.billingWebhookService.handle(event);
  }
}
