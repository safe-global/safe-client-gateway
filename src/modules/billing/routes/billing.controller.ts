// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { SubscriptionStatusFilter } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatusFilterSchema } from '@/datasources/billing-api/entities/subscription.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { CheckoutSession } from '@/modules/billing/routes/entities/checkout-session.entity';
import { CheckoutSessionResult } from '@/modules/billing/routes/entities/checkout-session-result.entity';
import { PaymentLink } from '@/modules/billing/routes/entities/payment-link.entity';
import { Plan } from '@/modules/billing/routes/entities/plan.entity';
import { Subscription } from '@/modules/billing/routes/entities/subscription.entity';
import { UrlResponse } from '@/modules/billing/routes/entities/url.entity';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

const ReturnUrlSchema = z.url();

@ApiTags('billing')
@Controller({
  path: 'billing',
  version: '1',
})
export class BillingController {
  public constructor(private readonly billingService: BillingService) {}

  @ApiExcludeEndpoint()
  @UseGuards(BillingWebhookAuthGuard)
  @Post('/webhooks')
  @HttpCode(202)
  postWebhook(): void {
    // Origin is authenticated by BillingWebhookAuthGuard.
    // TODO(PLA-1678 follow-up): validate and process the webhook payload.
  }

  @ApiOperation({ summary: 'Get a space subscriptions' })
  @ApiOkResponse({ type: Subscription, isArray: true })
  @ApiQuery({ name: 'status', required: false })
  @UseGuards(AuthGuard)
  @Get('/spaces/:id/subscriptions')
  public async getSubscriptions(
    @Param('id', SpaceIdPipe) spaceId: Space['id'],
    @Param('id') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
    @Query(
      'status',
      new ValidationPipe(SubscriptionStatusFilterSchema.optional()),
    )
    status?: SubscriptionStatusFilter,
  ): Promise<Array<Subscription>> {
    return await this.billingService.getSubscriptions({
      spaceId,
      spaceUuid,
      authPayload,
      status,
    });
  }

  @ApiOperation({ summary: 'Get a plan by id' })
  @ApiOkResponse({ type: Plan })
  @UseGuards(AuthGuard)
  @Get('/plans/:planId')
  public async getPlan(@Param('planId') planId: string): Promise<Plan> {
    return await this.billingService.getPlan(planId);
  }

  @ApiOperation({ summary: 'Get the billing portal session URL for a space' })
  @ApiOkResponse({ type: UrlResponse })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:id/session-url')
  public async getSessionUrl(
    @Param('id', SpaceIdPipe) spaceId: Space['id'],
    @Param('id') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
    @Query('returnUrl', new ValidationPipe(ReturnUrlSchema)) returnUrl: string,
  ): Promise<UrlResponse> {
    return await this.billingService.getSessionUrl({
      spaceId,
      spaceUuid,
      authPayload,
      returnUrl,
    });
  }

  @ApiOperation({
    summary: 'Get payment links for a space, plus the general catalog',
  })
  @ApiOkResponse({ type: PaymentLink, isArray: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:id/payment-links')
  public async getSpacePaymentLinks(
    @Param('id', SpaceIdPipe) spaceId: Space['id'],
    @Param('id') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<PaymentLink>> {
    return await this.billingService.getSpacePaymentLinks({
      spaceId,
      spaceUuid,
      authPayload,
    });
  }

  @ApiOperation({ summary: 'Create a checkout session for a payment link' })
  @ApiOkResponse({ type: CheckoutSessionResult })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:id/payment-links/:paymentLinkId/checkout-url')
  public async getCheckoutUrl(
    @Param('id', SpaceIdPipe) spaceId: Space['id'],
    @Param('id') spaceUuid: Space['uuid'],
    @Param('paymentLinkId') paymentLinkId: string,
    @Auth() authPayload: AuthPayload,
    @Query('returnUrl', new ValidationPipe(ReturnUrlSchema)) returnUrl: string,
  ): Promise<CheckoutSessionResult> {
    return await this.billingService.createCheckoutUrl({
      paymentLinkId,
      spaceId,
      spaceUuid,
      authPayload,
      returnUrl,
    });
  }

  @ApiOperation({ summary: 'Get a checkout session by id' })
  @ApiOkResponse({ type: CheckoutSession })
  @UseGuards(AuthGuard)
  @Get('/sessions/:sessionId')
  public async getCheckoutSession(
    @Param('sessionId') sessionId: string,
  ): Promise<CheckoutSession> {
    return await this.billingService.getCheckoutSession(sessionId);
  }
}
