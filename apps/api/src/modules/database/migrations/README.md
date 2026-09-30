# Migrations

Hand-written TypeORM migrations live here and are applied **manually** by the
operator.

Deliberately not automated in this repository:

- `synchronize: false` and `migrationsRun: false` are hard-coded in
  `src/modules/database/database.module.ts`
- no migration files are generated
- no migration command is run at any phase

The expected production workflow is:

```bash
# 1. author the migration by hand in this directory
# 2. review it with the team
# 3. apply it against a staging database
# 4. apply it against production during a maintenance window
```

This directory is intentionally empty.
