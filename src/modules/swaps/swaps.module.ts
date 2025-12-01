import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { SwapsApiFactory } from '@/modules/swaps/datasources/swaps-api.factory';
import {
  ISwapsRepository,
  SwapsRepository,
} from '@/modules/swaps/domain/swaps.repository';

@Module({
  providers: [
    { provide: ISwapsApiFactory, useClass: SwapsApiFactory },
    HttpErrorFactory,
    { provide: ISwapsRepository, useClass: SwapsRepository },
  ],
  exports: [ISwapsApiFactory, ISwapsRepository],
})
export class SwapsModule {}
