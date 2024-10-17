import { Module } from '@nestjs/common';

/**
 * The {@link TestPostgresDatabaseModule} should be used whenever you want to
 * override the values provided by the {@link PostgresDatabase}.
 *
 * This will create a TestModule which uses the implementation of PostgresDatabase but
 * overrides the real DB_INSTANCE with a null value.
 *
 */
@Module({
  providers: [{ provide: 'DB_INSTANCE', useFactory: (): null => null }],
  exports: [],
  imports: [],
})
export class TestPostgresDatabaseModule {}
