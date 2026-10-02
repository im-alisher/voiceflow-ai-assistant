-- ============================================================================
-- Voiceflow — PostgreSQL schema
-- ============================================================================
--
-- This file is the authoritative schema. It is hand-written and applied by
-- hand on purpose: `synchronize` and `migrationsRun` are hard-off in the API
-- (`apps/api/src/modules/database/database.module.ts`), so an ORM that could
-- alter the schema on boot is an ORM that could lose data in production.
--
-- Every column, default, and index below is derived from the TypeORM entities.
-- If you change an entity, change this file in the same commit — nothing
-- reconciles them automatically.
--
-- Apply it either way:
--
--   psql "postgresql://user:pass@host/db?sslmode=require" -f database/schema.sql
--
-- ...or paste the contents into the Neon SQL editor.
--
-- Safe to re-run: every statement is guarded with IF NOT EXISTS.
-- ============================================================================

-- TypeORM's `@PrimaryGeneratedColumn('uuid')` defaults to `uuid_generate_v4()`,
-- which needs this extension. Neon has it available.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
-- `preferences` is jsonb and deliberately untyped: the shape is owned by the
-- shared Zod schema, and merging defaults in application code (see
-- `userPreferencesTransformer`) beats migrating a column every time a
-- preference is added.
CREATE TABLE IF NOT EXISTS users (
    id             uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    created_at     timestamp with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp with time zone NOT NULL DEFAULT now(),
    email          character varying(254)  NOT NULL,
    password_hash  character varying(120)  NOT NULL,
    display_name   character varying(64)   NOT NULL,
    avatar_url     character varying(2048),
    role           character varying(16)   NOT NULL DEFAULT 'user',
    email_verified boolean                  NOT NULL DEFAULT false,
    is_active      boolean                  NOT NULL DEFAULT true,
    last_login_at  timestamp with time zone,
    preferences    jsonb                    NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT "PK_users" PRIMARY KEY (id)
);

-- Email uniqueness is enforced here, not in the application, so two concurrent
-- registrations for the same address cannot both succeed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);


-- ----------------------------------------------------------------------------
-- refresh_sessions
-- ----------------------------------------------------------------------------
-- One row per logged-in device. Only the SHA-256 digest of the refresh token is
-- stored, so a database leak yields nothing replayable.
CREATE TABLE IF NOT EXISTS refresh_sessions (
    id           uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    created_at   timestamp with time zone NOT NULL DEFAULT now(),
    updated_at   timestamp with time zone NOT NULL DEFAULT now(),
    user_id      uuid                     NOT NULL,
    token_hash   character varying(128)  NOT NULL,
    user_agent   character varying(512),
    ip_address   character varying(64),
    expires_at   timestamp with time zone NOT NULL,
    revoked_at   timestamp with time zone,
    rotated_at   timestamp with time zone,
    last_used_at timestamp with time zone,
    role         character varying(16)   NOT NULL DEFAULT 'user',

    CONSTRAINT "PK_refresh_sessions" PRIMARY KEY (id),
    CONSTRAINT "FK_refresh_sessions_user" FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user
    ON refresh_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expires
    ON refresh_sessions (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_sessions_token_hash
    ON refresh_sessions (token_hash);


-- ----------------------------------------------------------------------------
-- password_reset_tokens
-- ----------------------------------------------------------------------------
-- Single-use reset grants. The raw token is never stored — only its SHA-256
-- digest, exactly as with refresh tokens.
--
-- The foreign key is an addition beyond the entity mapping (which declares only
-- the `user_id` column). It is defence in depth: a token must not outlive the
-- account it grants access to.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id            uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    created_at    timestamp with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp with time zone NOT NULL DEFAULT now(),
    user_id       uuid                     NOT NULL,
    token_hash    character varying(64)   NOT NULL,
    expires_at    timestamp with time zone NOT NULL,
    used_at       timestamp with time zone,
    revoked_at    timestamp with time zone,
    email         character varying(254)  NOT NULL,
    requested_ip  character varying(64),
    requested_role character varying(16),

    CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY (id),
    CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires
    ON password_reset_tokens (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_tokens_hash
    ON password_reset_tokens (token_hash);


-- ----------------------------------------------------------------------------
-- conversations
-- ----------------------------------------------------------------------------
-- `id` has no database default on purpose: the application generates it with
-- `crypto.randomUUID()` (see `ConversationsService.create`), which is what lets
-- a row be created without a round trip.
--
-- The denormalised `message_count` / `last_message_preview` / `last_message_at`
-- columns let the sidebar render from one ordered query.
CREATE TABLE IF NOT EXISTS conversations (
    id                   uuid                     NOT NULL,
    user_id              uuid                     NOT NULL,
    title                character varying(120)  NOT NULL,
    status               character varying(16)   NOT NULL DEFAULT 'active',
    model                character varying(120)  NOT NULL,
    provider_id          character varying(60)   NOT NULL,
    system_prompt        character varying(4000),
    message_count        integer                  NOT NULL DEFAULT 0,
    last_message_preview character varying(200),
    last_message_at      timestamp with time zone,
    is_pinned            boolean                  NOT NULL DEFAULT false,
    created_at           timestamp with time zone NOT NULL DEFAULT now(),
    updated_at           timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT "PK_conversations" PRIMARY KEY (id),
    CONSTRAINT "FK_conversations_user" FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

-- Serves the default listing: one user's threads, newest first, by status.
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
    ON conversations (user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created
    ON conversations (user_id, created_at);


-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
-- `sequence` is a per-conversation counter rather than a timestamp: two rows
-- sharing a millisecond would make cursor pagination unstable.
CREATE TABLE IF NOT EXISTS messages (
    id               uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    created_at       timestamp with time zone NOT NULL DEFAULT now(),
    updated_at       timestamp with time zone NOT NULL DEFAULT now(),
    conversation_id  uuid                     NOT NULL,
    role             character varying(16)   NOT NULL,
    content          text                     NOT NULL,
    input_mode       character varying(16)   NOT NULL DEFAULT 'text',
    sequence         integer                  NOT NULL,
    client_message_id character varying(120),
    confidence       double precision,
    token_count      integer                  NOT NULL DEFAULT 0,
    model            character varying(120),
    provider_id      character varying(60),
    latency_ms       integer,

    CONSTRAINT "PK_messages" PRIMARY KEY (id),
    CONSTRAINT "FK_messages_conversation" FOREIGN KEY (conversation_id)
        REFERENCES conversations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence
    ON messages (conversation_id, sequence);

-- Idempotency guarantee for retried sends. PostgreSQL treats NULLs as distinct,
-- so only messages that actually carry a client id are deduplicated — the many
-- rows with NULL here are expected, not a constraint failure.
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_conversation_client_id
    ON messages (conversation_id, client_message_id);