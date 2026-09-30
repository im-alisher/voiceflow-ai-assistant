import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CONFIG_NAMESPACE, type DatabaseConfig } from '../../config';

/**
 * TypeORM connection factory.
 *
 * Deliberate choices:
 *  - `synchronize` and `migrationsRun` are hard-coded off. The schema is owned
 *    by reviewed, hand-written migrations; an ORM that can alter the schema on
 *    boot is an ORM that can lose data in production.
 *  - `autoLoadEntities` keeps the entity registry with the feature module that
 *    owns it, so adding a table never requires editing a central list.
 *  - `prepareDatabase` is left to the operator; the app assumes the database
 *    and its schema already exist.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const database = config.getOrThrow<DatabaseConfig>(CONFIG_NAMESPACE.DATABASE);

  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    schema: database.schema,
    ssl: database.ssl ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    migrations: [],
    logging: database.logging,
    // A container that starts before PostgreSQL is ready should wait rather
    // than crash-loop. Tests set this to 0 to fail fast.
    retryAttempts: database.retryAttempts,
    retryDelay: 3000,
    extra: {
      max: database.poolSize,
      // Fail fast instead of hanging when PostgreSQL is unreachable.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
      application_name: 'voiceflow-api',
    },
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
  ],
})
export class DatabaseModule {}
