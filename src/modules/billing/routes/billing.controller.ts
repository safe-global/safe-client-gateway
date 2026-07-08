// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class BillingController {
  @UseGuards(BillingWebhookAuthGuard)
  @Post('/billing/webhooks')
  @HttpCode(202)
  postWebhook(): void {
    // Origin is authenticated by BillingWebhookAuthGuard.
    // TODO(PLA-1678 follow-up): validate and process the webhook payload.
  }
}
