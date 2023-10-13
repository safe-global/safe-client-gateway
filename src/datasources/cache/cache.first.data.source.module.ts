import { Module } from '@nestjs/common';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  providers: [CacheFirstDataSource, HttpErrorFactory],
  exports: [CacheFirstDataSource],
})
export class CacheFirstDataSourceModule {}
