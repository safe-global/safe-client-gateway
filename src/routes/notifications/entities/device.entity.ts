import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeviceType {
  Android = 'ANDROID',
  Ios = 'IOS',
  Web = 'WEB',
}

export class Device {
  @ApiPropertyOptional()
  uuid?: string;
  @ApiProperty()
  cloud_messaging_token: string;
  @ApiProperty()
  buildNumber: string;
  @ApiProperty()
  bundle: string;
  @ApiProperty()
  device_type: DeviceType;
  @ApiProperty()
  version: string;
  @ApiPropertyOptional()
  timestamp?: string;
}
