import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4Withdrawals1716000000000 implements MigrationInterface {
  name = 'Phase4Withdrawals1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "withdrawal_status" AS ENUM ('PENDING_PIN', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "withdrawal_channel" AS ENUM ('AIRTEL_MONEY', 'MOOV_MONEY')`,
    );

    await queryRunner.query(`
      CREATE TABLE "withdrawals" (
        "id"                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"                  uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "wallet_id"                uuid NOT NULL REFERENCES "wallets"("id") ON DELETE RESTRICT,
        "transaction_id"           uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
        "amount"                   bigint NOT NULL CHECK ("amount" > 0),
        "fee"                      bigint NOT NULL DEFAULT 0 CHECK ("fee" >= 0),
        "currency"                 varchar(3) NOT NULL DEFAULT 'XAF',
        "channel"                  "withdrawal_channel" NOT NULL,
        "recipient_phone"          varchar(20) NOT NULL,
        "recipient_name"           varchar(200),
        "status"                   "withdrawal_status" NOT NULL DEFAULT 'PENDING_PIN',
        "cinetpay_transaction_id"  varchar(100),
        "pin_expires_at"           timestamptz,
        "completed_at"             timestamptz,
        "failed_at"                timestamptz,
        "failure_reason"           text,
        "retry_count"              int NOT NULL DEFAULT 0,
        "created_at"               timestamptz NOT NULL DEFAULT now(),
        "updated_at"               timestamptz NOT NULL DEFAULT now(),
        "deleted_at"               timestamptz,
        "version"                  int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_withdrawals_user_created" ON "withdrawals" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(`CREATE INDEX "idx_withdrawals_status" ON "withdrawals" ("status")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_withdrawals_cinetpay" ON "withdrawals" ("cinetpay_transaction_id") WHERE "cinetpay_transaction_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TRIGGER trg_withdrawals_updated BEFORE UPDATE ON "withdrawals"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_withdrawals_updated ON "withdrawals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "withdrawals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "withdrawal_channel"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "withdrawal_status"`);
  }
}
