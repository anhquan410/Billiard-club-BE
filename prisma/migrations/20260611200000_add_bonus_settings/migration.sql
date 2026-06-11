-- CreateTable
CREATE TABLE "bonus_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "points_per_vnd" INTEGER NOT NULL DEFAULT 10000,
    "vnd_per_point" INTEGER NOT NULL DEFAULT 1000,
    "max_discount_percent" INTEGER NOT NULL DEFAULT 30,
    "silver_threshold" INTEGER NOT NULL DEFAULT 1000,
    "gold_threshold" INTEGER NOT NULL DEFAULT 2000,
    "platinum_threshold" INTEGER NOT NULL DEFAULT 5000,
    "diamond_threshold" INTEGER NOT NULL DEFAULT 10000,
    "bronze_discount" INTEGER NOT NULL DEFAULT 5,
    "silver_discount" INTEGER NOT NULL DEFAULT 10,
    "gold_discount" INTEGER NOT NULL DEFAULT 15,
    "platinum_discount" INTEGER NOT NULL DEFAULT 20,
    "diamond_discount" INTEGER NOT NULL DEFAULT 25,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "bonus_settings" ("id", "points_per_vnd", "vnd_per_point", "max_discount_percent", "silver_threshold", "gold_threshold", "platinum_threshold", "diamond_threshold", "bronze_discount", "silver_discount", "gold_discount", "platinum_discount", "diamond_discount", "updated_at")
VALUES ('default', 10000, 1000, 30, 1000, 2000, 5000, 10000, 5, 10, 15, 20, 25, CURRENT_TIMESTAMP);
