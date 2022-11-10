import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('health')
@Controller({ path: 'health' })
export class HealthController {
  @ApiOkResponse({ type: String })
  @Get()
  getHealth(@Res() res: Response): void {
    res.setHeader('Content-Type', 'application/json');
    res.end('""');
  }
}
