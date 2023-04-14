import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IConfigurationService } from '../../../config/configuration.service.interface';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.configurationService.getOrThrow('auth.token');
    return request.headers['authorization'] === `Basic ${token}`;
  }
}
