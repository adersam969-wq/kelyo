import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2PaymentTables1715000000000 implements MigrationInterface {
  name = 'Phase2PaymentTables1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "webhook_source" AS ENUM ('CINETPAY')`);
    await queryRunner.query(
      `CREATE TYPE "webhook_event_type" AS ENUM ('PAYMENT_NOTIFICATION', 'TRANSFER_NOTIFICATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "webhook_processing_status" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED_SIGNATURE', 'REJECTED_DUPLICATE', 'ERROR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_link_status" AS ENUM ('ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(`CREATE TYPE "qr_code_type" AS ENUM ('STATIC', 'DYNAMIC')`);
    await queryRunner.query(
      `CREATE TYPE "qr_code_status" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED')`,
    );

    // ─── Webhook events (append-only) ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source"               "webhook_source" NOT NULL,
        "event_type"           "webhook_event_type" NOT NULL,
        "external_event_id"    varchar(200) NOT NULL,
        "signature_provided"   text,
        "signature_valid"      boolean,
        "payload"              jsonb NOT NULL,
        "processing_status"    "webhook_processing_status" NOT NULL DEFAULT 'RECEIVED',
        "processed_at"         timestamptz,
        "error_message"        text,
        "created_at"           timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_webhook_source_event" ON "webhook_events" ("source", "external_event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_status_created" ON "webhook_events" ("processing_status", "created_at" DESC)`,
    );

    // ─── Payment links ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "payment_links" (
        "id"                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "merchant_id"         uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "slug"                varchar(32) NOT NULL UNIQUE,
        "amount"              bigint NOT NULL CHECK ("amount" > 0),
        "currency"            varchar(3) NOT NULL DEFAULT 'XAF',
        "description"         text NOT NULL,
        "status"              "payment_link_status" NOT NULL DEFAULT 'ACTIVE',
        "expires_at"          timestamptz,
        "paid_at"             timestamptz,
        "paid_by_user_id"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "transaction_id"      uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "version"             int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_paylink_merchant_status" ON "payment_links" ("merchant_id", "status")`,
    );

    // ─── QR codes ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "qr_codes" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "merchant_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "type"           "qr_code_type" NOT NULL,
        "amount"         bigint CHECK ("amount" IS NULL OR "amount" > 0),
        "currency"       varchar(3) NOT NULL DEFAULT 'XAF',
        "description"    text,
        "status"         "qr_code_status" NOT NULL DEFAULT 'ACTIVE',
        "payload"        varchar(64) NOT NULL UNIQUE,
        "expires_at"     timestamptz,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        "deleted_at"     timestamptz,
        "version"        int NOT NULL DEFAULT 1,
        CONSTRAINT "chk_qr_dynamic_amount" CHECK (
          ("type" = 'STATIC' AND "amount" IS NULL) OR
          ("type" = 'DYNAMIC' AND "amount" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_qr_merchant_status" ON "qr_codes" ("merchant_id", "status")`,
    );

    // updated_at triggers for new mutable tables
    for (const table of ['payment_links', 'qr_codes']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_updated BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }

    // webhook_events is append-only
    await queryRunner.query(`
      CREATE TRIGGER trg_webhook_no_update BEFORE UPDATE ON "webhook_events"
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    `);
    // NOTE: we don't forbid DELETE on webhook_events because we may purge old ones
    // for storage; but no UPDATE keeps the audit trail intact.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_webhook_no_update ON "webhook_events"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_qr_codes_updated ON "qr_codes"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_payment_links_updated ON "payment_links"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "qr_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);

    for (const t of [
      'qr_code_status',
      'qr_code_type',
      'payment_link_status',
      'webhook_processing_status',
      'webhook_event_type',
      'webhook_source',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${t}"`);
    }
  }
}
