import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Users bounded context.
 *
 * Exposes `UsersService` — never the repository — so consumers depend on the
 * domain API rather than on the persistence strategy.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

export { User };
export type { CreateUserInput, UpdateProfileInput } from './types';
