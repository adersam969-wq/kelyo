import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1714000000000 implements MigrationInterface {
  name = 'InitialSchema1714000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions (already created by init-db.sql but idempotent)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('USER', 'MERCHANT', 'ADMIN')`);
    await queryRunner.query(`CREATE TYPE "kyc_tier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2')`);
    await queryRunner.query(
      `CREATE TYPE "kyc_status" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_status" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ledger_account" AS ENUM ('USER_WALLET', 'CINETPAY_CLEARING', 'KELYO_FEES', 'KELYO_REVENUE', 'EXTERNAL_AIRTEL', 'EXTERNAL_MOOV', 'EXTERNAL_CARD', 'SUSPENSE')`,
    );
    await queryRunner.query(`CREATE TYPE "ledger_direction" AS ENUM ('DEBIT', 'CREDIT')`);
    await queryRunner.query(
      `CREATE TYPE "transaction_type" AS ENUM ('TOPUP', 'WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_IN', 'PAYMENT', 'COLLECTION', 'FEE', 'REVERSAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_channel" AS ENUM ('AIRTEL_MONEY', 'MOOV_MONEY', 'CARD_VISA', 'CARD_MASTERCARD', 'KELYO_WALLET')`,
    );
    await queryRunner.query(
      `CREATE TYPE "otp_purpose" AS ENUM ('SIGNUP', 'LOGIN', 'PHONE_CHANGE', 'PIN_RESET', 'TRANSACTION_CONFIRM')`,
    );
    await queryRunner.query(
      `CREATE TYPE "kyc_doc_type" AS ENUM ('ID_CARD_FRONT', 'ID_CARD_BACK', 'PASSPORT', 'SELFIE', 'PROOF_OF_ADDRESS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "kyc_doc_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
    );

    // ─── Users ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phone"                varchar(20) NOT NULL UNIQUE,
        "email"                varchar(255),
        "pin_hash"             varchar(255),
        "first_name"           varchar(100),
        "last_name"            varchar(100),
        "role"                 "user_role" NOT NULL DEFAULT 'USER',
        "kyc_tier"             "kyc_tier" NOT NULL DEFAULT 'TIER_0',
        "kyc_status"           "kyc_status" NOT NULL DEFAULT 'NOT_SUBMITTED',
        "is_phone_verified"    boolean NOT NULL DEFAULT false,
        "is_active"            boolean NOT NULL DEFAULT true,
        "country_code"         varchar(2) NOT NULL DEFAULT 'GA',
        "last_login_at"        timestamptz,
        "failed_pin_attempts"  int NOT NULL DEFAULT 0,
        "pin_locked_until"     timestamptz,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "deleted_at"           timestamptz,
        "version"              int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );

    // ─── Merchant profiles ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "merchant_profiles" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"          uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "business_name"    varchar(200) NOT NULL,
        "business_type"    varchar(100) NOT NULL,
        "rccm_number"      varchar(100),
        "logo_url"         text,
        "city"             varchar(100),
        "is_verified"      boolean NOT NULL DEFAULT false,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz,
        "version"          int NOT NULL DEFAULT 1
      )
    `);

    // ─── Wallets ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"            uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE RESTRICT,
        "currency"           varchar(3) NOT NULL DEFAULT 'XAF',
        "balance"            bigint NOT NULL DEFAULT 0 CHECK ("balance" >= 0),
        "available_balance"  bigint NOT NULL DEFAULT 0 CHECK ("available_balance" >= 0),
        "status"             "wallet_status" NOT NULL DEFAULT 'ACTIVE',
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "version"            int NOT NULL DEFAULT 1,
        CONSTRAINT "chk_wallet_available_le_balance" CHECK ("available_balance" <= "balance")
      )
    `);

    // ─── Transactions ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "wallet_id"                uuid NOT NULL REFERENCES "wallets"("id") ON DELETE RESTRICT,
        "type"                     "transaction_type" NOT NULL,
        "status"                   "transaction_status" NOT NULL DEFAULT 'PENDING',
        "amount"                   bigint NOT NULL CHECK ("amount" > 0),
        "fee"                      bigint NOT NULL DEFAULT 0 CHECK ("fee" >= 0),
        "currency"                 varchar(3) NOT NULL DEFAULT 'XAF',
        "channel"                  "payment_channel",
        "counterparty_name"        varchar(200),
        "counterparty_phone"       varchar(20),
        "counterparty_wallet_id"   uuid,
        "description"              text,
        "external_ref"             varchar(100),
        "metadata"                 jsonb NOT NULL DEFAULT '{}',
        "completed_at"             timestamptz,
        "failed_at"                timestamptz,
        "failure_reason"           text,
        "created_at"               timestamptz NOT NULL DEFAULT now(),
        "updated_at"               timestamptz NOT NULL DEFAULT now(),
        "deleted_at"               timestamptz,
        "version"                  int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tx_wallet_created" ON "transactions" ("wallet_id", "created_at" DESC)`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tx_status" ON "transactions" ("status")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_tx_external_ref" ON "transactions" ("external_ref") WHERE "external_ref" IS NOT NULL`,
    );

    // ─── Ledger entries (append-only) ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "transaction_id"   uuid NOT NULL REFERENCES "transactions"("id") ON DELETE RESTRICT,
        "account"          "ledger_account" NOT NULL,
        "direction"        "ledger_direction" NOT NULL,
        "wallet_id"        uuid REFERENCES "wallets"("id") ON DELETE RESTRICT,
        "amount"           bigint NOT NULL CHECK ("amount" > 0),
        "currency"         varchar(3) NOT NULL DEFAULT 'XAF',
        "memo"             text,
        "created_at"       timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ledger_tx" ON "ledger_entries" ("transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ledger_wallet_created" ON "ledger_entries" ("wallet_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ledger_account_created" ON "ledger_entries" ("account", "created_at" DESC)`,
    );

    // ─── OTP codes ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "otp_codes" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phone"            varchar(20) NOT NULL,
        "purpose"          "otp_purpose" NOT NULL,
        "code_hash"        varchar(255) NOT NULL,
        "expires_at"       timestamptz NOT NULL,
        "attempts"         int NOT NULL DEFAULT 0,
        "used_at"          timestamptz,
        "invalidated_at"   timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz,
        "version"          int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_otp_phone_purpose_created" ON "otp_codes" ("phone", "purpose", "created_at" DESC)`,
    );

    // ─── Refresh tokens ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "family_id"        uuid NOT NULL,
        "token_hash"       varchar(255) NOT NULL UNIQUE,
        "expires_at"       timestamptz NOT NULL,
        "used_at"          timestamptz,
        "revoked_at"       timestamptz,
        "replaced_by_id"   uuid,
        "user_agent"       text,
        "ip_address"       varchar(45),
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz,
        "version"          int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_user_family" ON "refresh_tokens" ("user_id", "family_id")`,
    );

    // ─── KYC documents ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "kyc_documents" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"            uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "doc_type"           "kyc_doc_type" NOT NULL,
        "storage_key"        text NOT NULL,
        "mime_type"          varchar(100) NOT NULL,
        "size_bytes"         int NOT NULL,
        "status"             "kyc_doc_status" NOT NULL DEFAULT 'PENDING',
        "reviewed_by"        uuid,
        "reviewed_at"        timestamptz,
        "rejection_reason"   text,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "version"            int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_kyc_user_doc_type" ON "kyc_documents" ("user_id", "doc_type")`,
    );

    // ─── Idempotency keys ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "key"             varchar(128) NOT NULL,
        "user_id"         uuid NOT NULL,
        "request_hash"    varchar(64) NOT NULL,
        "response_body"   text NOT NULL,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("key", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_idem_created" ON "idempotency_keys" ("created_at")`,
    );

    // ─── Audit logs (append-only) ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"         uuid,
        "actor_id"        uuid,
        "action"          varchar(100) NOT NULL,
        "resource_type"   varchar(100),
        "resource_id"     varchar(100),
        "before"          jsonb NOT NULL DEFAULT '{}',
        "after"           jsonb NOT NULL DEFAULT '{}',
        "ip_address"      varchar(45),
        "user_agent"      text,
        "created_at"      timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_user_created" ON "audit_logs" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_action_created" ON "audit_logs" ("action", "created_at" DESC)`,
    );

    // ─── Trigger: forbid UPDATE/DELETE on append-only tables ─────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION forbid_modification()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Modification of % is forbidden (append-only table)', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON "ledger_entries"
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON "ledger_entries"
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    `);

    // ─── updated_at auto-update trigger ──────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    for (const table of [
      'users',
      'merchant_profiles',
      'wallets',
      'transactions',
      'otp_codes',
      'refresh_tokens',
      'kyc_documents',
    ]) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_updated BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    for (const table of [
      'users',
      'merchant_profiles',
      'wallets',
      'transactions',
      'otp_codes',
      'refresh_tokens',
      'kyc_documents',
    ]) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${table}_updated ON "${table}"`);
    }
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ledger_no_update ON "ledger_entries"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ledger_no_delete ON "ledger_entries"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_no_update ON "audit_logs"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_no_delete ON "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS forbid_modification()`);

    // Drop tables in dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop enums
    for (const t of [
      'kyc_doc_status',
      'kyc_doc_type',
      'otp_purpose',
      'payment_channel',
      'transaction_status',
      'transaction_type',
      'ledger_direction',
      'ledger_account',
      'wallet_status',
      'kyc_status',
      'kyc_tier',
      'user_role',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${t}"`);
    }
  }
}
