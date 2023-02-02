import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from './entities/register-device.dto.entity';
import { NotificationsService } from './notifications.service';

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
}
