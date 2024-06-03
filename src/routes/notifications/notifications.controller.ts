import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from '@/routes/notifications/entities/register-device.dto.entity';
import { NotificationsService } from '@/routes/notifications/notifications.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('notifications')
@Controller({ path: '', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOkResponse()
  @Post('register/notifications')
  @HttpCode(200)
  async registerDevice(
    @Body() registerDeviceDto: RegisterDeviceDto,
  ): Promise<void> {
    return this.notificationsService.registerDevice(registerDeviceDto);
  }

  @Delete('chains/:chainId/notifications/devices/:uuid')
  async unregisterDevice(
    @Param('chainId') chainId: string,
    @Param('uuid') uuid: string,
  ): Promise<void> {
    return this.notificationsService.unregisterDevice({ chainId, uuid });
  }

  @Delete('chains/:chainId/notifications/devices/:uuid/safes/:safeAddress')
  async unregisterSafe(
    @Param('chainId') chainId: string,
    @Param('uuid') uuid: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<void> {
    return this.notificationsService.unregisterSafe({
      chainId,
      uuid,
      safeAddress,
    });
  }
}
