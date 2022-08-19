import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AxiosNetworkService } from './axios.network.service';
import { NetworkService } from './network.service.interface';

/**
 * A {@link Global} Module which provides HTTP support via {@link NetworkService}
 * Feature Modules don't need to import this module directly in order to inject
 * the {@link NetworkService}.
 *
 * This module should be included in the "root" application module
 */
@Global()
@Module({
  imports: [HttpModule],
  providers: [{ provide: NetworkService, useClass: AxiosNetworkService }],
  exports: [NetworkService],
})
export class NetworkModule {}
