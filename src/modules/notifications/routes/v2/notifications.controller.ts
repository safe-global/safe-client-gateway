import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { UpsertSubscriptionsDto } from '@/modules/notifications/routes/v2/entities/upsert-subscriptions.dto.entity';
import { UpsertSubscriptionsDtoSchema } from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import { NotificationsServiceV2 } from '@/modules/notifications/routes/v2/notifications.service';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
  ApiOkResponse,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UUID } from 'crypto';
import { OptionalAuthGuard } from '@/modules/auth/routes/guards/optional-auth.guard';
import { NotificationTypeResponseDto } from '@/modules/notifications/routes/v2/entities/notification-type-response.dto.entity';
import { DeleteAllSubscriptionsDtoSchema } from '@/modules/notifications/domain/v2/entities/delete-all-subscriptions.dto.entity';
import { DeleteAllSubscriptionsDto } from '@/modules/notifications/routes/v2/entities/delete-all-subscriptions.dto.entity';
import type { Address } from 'viem';

@ApiTags('notifications')
@Controller({ path: '', version: '2' })
export class NotificationsControllerV2 {
  constructor(private readonly notificationsService: NotificationsServiceV2) {}

  @ApiOperation({
    summary: 'Register device for notifications',
    description:
      'Registers or updates a device to receive push notifications for Safe events. Creates subscriptions for specified Safes and notification types.',
  })
  @ApiBody({
    type: UpsertSubscriptionsDto,
    description:
      'Device and subscription data including device token, Safe addresses, and notification preferences',
  })
  @ApiCreatedResponse({
    description: 'Device registered successfully with returned device UUID',
    schema: {
      type: 'object',
      properties: {
        deviceUuid: {
          type: 'string',
          format: 'uuid',
          description: 'Generated UUID for the registered device',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid device data or subscription configuration',
  })
  @Post('register/notifications')
  @UseGuards(OptionalAuthGuard)
  upsertSubscriptions(
    @Body(new ValidationPipe(UpsertSubscriptionsDtoSchema))
    upsertSubscriptionsDto: UpsertSubscriptionsDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<{ deviceUuid: UUID }> {
    return this.notificationsService.upsertSubscriptions({
      authPayload,
      upsertSubscriptionsDto,
    });
  }

  @ApiOperation({
    summary: 'Get Safe subscription',
    description:
      'Retrieves the notification types that a device is subscribed to for a specific Safe.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'deviceUuid',
    type: 'string',
    description: 'Device UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: [NotificationTypeResponseDto],
    description:
      'List of notification types the device is subscribed to for this Safe',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiNotFoundResponse({
    description: 'Device, Safe, or subscription not found',
  })
  @Get('chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress')
  @UseGuards(AuthGuard)
  getSafeSubscription(
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<NotificationTypeResponseDto>> {
    return this.notificationsService.getSafeSubscription({
      authPayload,
      deviceUuid,
      chainId,
      safeAddress,
    });
  }

  @ApiOperation({
    summary: 'Delete Safe subscription',
    description:
      'Removes all notification subscriptions for a specific Safe on a device.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'deviceUuid',
    type: 'string',
    description: 'Device UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiNoContentResponse({
    description: 'Safe subscription deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Device, Safe, or subscription not found',
  })
  @Delete(
    'chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress',
  )
  deleteSubscription(
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<void> {
    return this.notificationsService.deleteSubscription({
      deviceUuid,
      chainId,
      safeAddress,
    });
  }

  @ApiOperation({
    summary: 'Delete all subscriptions of a device',
    description:
      'Delete all subscriptions of a Safe on a device. This will delete all subscriptions of a Safe on a device for all chains passed in the request body.',
  })
  @ApiNotFoundResponse({
    description: 'No subscription was found',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The request body is invalid',
  })
  @Delete('notifications/subscriptions')
  public async deleteAllSubscriptions(
    @Body(new ValidationPipe(DeleteAllSubscriptionsDtoSchema))
    deleteAllSubscriptionsDto: DeleteAllSubscriptionsDto,
  ): Promise<void> {
    return this.notificationsService.deleteAllSubscriptions(
      deleteAllSubscriptionsDto,
    );
  }

  @ApiOperation({
    summary: 'Delete device',
    description:
      'Removes a device and all its notification subscriptions from the system.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID (kept for backward compatibility)',
    example: '1',
  })
  @ApiParam({
    name: 'deviceUuid',
    type: 'string',
    description: 'Device UUID to delete',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiNoContentResponse({
    description: 'Device deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Device not found',
  })
  @Delete('chains/:chainId/notifications/devices/:deviceUuid')
  deleteDevice(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) _chainId: string,
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
  ): Promise<void> {
    return this.notificationsService.deleteDevice(deviceUuid);
  }
}
