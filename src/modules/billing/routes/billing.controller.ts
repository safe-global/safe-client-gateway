// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiConflictResponse,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { SubscriptionStatusFilter } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatusFilterSchema } from '@/datasources/billing-api/entities/subscription.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import { WebhookEventSchema } from '@/modules/billing/domain/entities/webhook-event.entity';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { CheckoutSession } from '@/modules/billing/routes/entities/checkout-session.entity';
import { CheckoutSessionResult } from '@/modules/billing/routes/entities/checkout-session-result.entity';
import { PaymentLink } from '@/modules/billing/routes/entities/payment-link.entity';
import { Plan } from '@/modules/billing/routes/entities/plan.entity';
import { Subscription } from '@/modules/billing/routes/entities/subscription.entity';
import {
  SubscriptionUpdatePreview,
  UpdateSubscriptionResult,
} from '@/modules/billing/routes/entities/subscription-update.entity';
import {
  UpdateSubscriptionDto,
  UpdateSubscriptionSchema,
} from '@/modules/billing/routes/entities/update-subscription.dto.entity';
import { UrlResponse } from '@/modules/billing/routes/entities/url.entity';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ElevationGuard } from '@/routes/common/auth/elevation.guard';
import { OpaqueIdSchema } from '@/validation/entities/schemas/opaque-id.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

const ReturnUrlSchema = z.url();
const opaqueIdPipe = new ValidationPipe(OpaqueIdSchema);
// The second binding of `spaceId`: the UUID itself, which reaches the upstream
// customer URL.
const uuidPipe = new ValidationPipe(UuidSchema);

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
  public async postWebhook(
    @Body(new ValidationPipe(WebhookEventSchema)) payload: WebhookEvent,
  ): Promise<void> {
    await this.billingService.processWebhook(payload);
  }

  @ApiOperation({ summary: 'Get a space subscriptions' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: Subscription, isArray: true })
  @ApiQuery({ name: 'status', required: false })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/subscriptions')
  public async getSubscriptions(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
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
  public async getPlan(
    @Param('planId', opaqueIdPipe) planId: string,
  ): Promise<Plan> {
    return await this.billingService.getPlan(planId);
  }

  @ApiOperation({ summary: 'Get the billing portal session URL for a space' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: UrlResponse })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/session-url')
  public async getSessionUrl(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
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
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: PaymentLink, isArray: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/payment-links')
  public async getSpacePaymentLinks(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<PaymentLink>> {
    return await this.billingService.getSpacePaymentLinks({
      spaceId,
      spaceUuid,
      authPayload,
    });
  }

  @ApiOperation({ summary: 'Create a checkout session for a payment link' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'paymentLinkId',
    type: 'string',
    description: 'Payment link identifier',
  })
  @ApiOkResponse({ type: CheckoutSessionResult })
  @ApiQuery({ name: 'returnUrl', required: true })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/payment-links/:paymentLinkId/checkout-url')
  public async getCheckoutUrl(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId') spaceUuid: Space['uuid'],
    @Param('paymentLinkId', opaqueIdPipe) paymentLinkId: string,
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

  @ApiOperation({
    summary: 'Preview what moving a subscription to another plan would cost',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'subscriptionId',
    type: 'string',
    description: 'Subscription identifier',
  })
  @ApiQuery({
    name: 'planId',
    required: true,
    description: 'The price id of the plan to preview',
  })
  @ApiOkResponse({ type: SubscriptionUpdatePreview })
  @ApiForbiddenResponse({
    description: 'Not a member, or a plan this workspace is not offered',
  })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @ApiConflictResponse({ description: 'Already on this plan' })
  @ApiUnprocessableEntityResponse({
    description: 'Malformed subscriptionId or planId',
  })
  @UseGuards(AuthGuard)
  @Get('/spaces/:spaceId/subscriptions/:subscriptionId/preview-update')
  public async previewSubscriptionUpdate(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId', uuidPipe) spaceUuid: Space['uuid'],
    @Param('subscriptionId', opaqueIdPipe) subscriptionId: string,
    @Query('planId', opaqueIdPipe) planId: string,
    @Auth() authPayload: AuthPayload,
  ): Promise<SubscriptionUpdatePreview> {
    return await this.billingService.previewSubscriptionUpdate({
      spaceId,
      spaceUuid,
      subscriptionId,
      planId,
      authPayload,
    });
  }

  @ApiOperation({ summary: 'Move a subscription onto another plan' })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'subscriptionId',
    type: 'string',
    description: 'Subscription identifier',
  })
  @ApiBody({ type: UpdateSubscriptionDto })
  @ApiOkResponse({ type: UpdateSubscriptionResult })
  @ApiForbiddenResponse({
    description: 'Not a member, or a plan this workspace is not offered',
  })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @ApiConflictResponse({
    description:
      'Already on this plan, the subscription is not updatable, or several offered links sell the plan and none was named',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The named payment link does not offer this plan',
  })
  @ApiBadGatewayResponse({
    description: 'The billing service reported the plan change as unsuccessful',
  })
  @UseGuards(AuthGuard, ElevationGuard)
  @Patch('/spaces/:spaceId/subscriptions/:subscriptionId')
  public async updateSubscription(
    @Param('spaceId', SpaceIdPipe) spaceId: Space['id'],
    @Param('spaceId', uuidPipe) spaceUuid: Space['uuid'],
    @Param('subscriptionId', opaqueIdPipe) subscriptionId: string,
    @Body(new ValidationPipe(UpdateSubscriptionSchema))
    body: UpdateSubscriptionDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<UpdateSubscriptionResult> {
    return await this.billingService.updateSubscription({
      spaceId,
      spaceUuid,
      subscriptionId,
      planId: body.planId,
      paymentLinkId: body.paymentLinkId,
      authPayload,
    });
  }

  @ApiOperation({ summary: 'Get a checkout session by id' })
  @ApiOkResponse({ type: CheckoutSession })
  @UseGuards(AuthGuard)
  @Get('/sessions/:sessionId')
  public async getCheckoutSession(
    @Param('sessionId', opaqueIdPipe) sessionId: string,
  ): Promise<CheckoutSession> {
    return await this.billingService.getCheckoutSession(sessionId);
  }
}
