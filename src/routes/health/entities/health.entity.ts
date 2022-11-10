import { ApiProperty } from '@nestjs/swagger';

export enum HealthStatus {
  OK = 'OK',
  KO = 'KO',
}

export class Health {
  @ApiProperty({ enum: Object.values(HealthStatus) })
  status: HealthStatus;
}
