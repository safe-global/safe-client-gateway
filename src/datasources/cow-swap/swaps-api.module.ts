import { Module } from '@nestjs/common';
import { SwapsApiFactory } from '@/datasources/cow-swap/swaps-api.factory';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  providers: [
    { provide: ISwapsApiFactory, useClass: SwapsApiFactory },
    HttpErrorFactory,
  ],
  exports: [ISwapsApiFactory],
})
export class SwapsApiModule {}
