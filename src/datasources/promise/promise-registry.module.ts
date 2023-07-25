import { Module } from '@nestjs/common';
import { PromiseRegistry } from './promise-registry';

function registryFactory(): Record<string, Promise<unknown>> {
  return {};
}

@Module({
  providers: [
    { provide: 'Registry', useFactory: registryFactory },
    PromiseRegistry,
  ],
  exports: [PromiseRegistry],
})
export class PromiseRegistryModule {}
