import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@ApiExcludeController()
export class RootController {
  @Get()
  getIndex(@Res() res): void {
    return res.redirect('/index.html');
  }
}
