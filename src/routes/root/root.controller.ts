import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@ApiExcludeController()
export class RootController {
  @Get()
  @Redirect('/api', 302)
  redirectApi(): void {
    // This method is intentionally left blank because @Redirect() handles the response
  }
}
