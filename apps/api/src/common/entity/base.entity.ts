import {
  BeforeInsert,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Shared identity + auditing columns.
 *
 * Every table uses a v4 UUID primary key generated in the application, not the
 * database: it keeps ids stable across environments and lets a client create a
 * row offline and submit it later without a round trip.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  protected touchCreatedAt(): void {
    this.createdAt ??= new Date();
  }
}
