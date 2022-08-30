import { Module } from '@nestjs/common';
import { CacheFirstDataSource } from './cache.first.data.source';
import { HttpErrorFactory } from '../errors/http-error-factory';

@Module({
  providers: [CacheFirstDataSource, HttpErrorFactory],
  exports: [CacheFirstDataSource],
})
export class CacheFirstDataSourceModule {}
