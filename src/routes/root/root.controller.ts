import { Controller, Get, Res } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getIndex(@Res() res): void {
    return res.redirect('/index.html');
  }
}
