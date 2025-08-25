-- CreateTable
CREATE TABLE "random_seed_info" (
    "id" SERIAL NOT NULL,
    "random_seed" VARCHAR(78) NOT NULL,
    "block_number" BIGINT,
    "transaction_hash" VARCHAR(66),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mappings_generated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "random_seed_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_info" (
    "token_id" INTEGER NOT NULL,
    "metadata_id" INTEGER,
    "user_address" VARCHAR(42),
    "box_type_id" SMALLINT NOT NULL,
    "origin_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_info_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "origin_metadata_info" (
    "origin_id" INTEGER NOT NULL,
    "box_type_id" SMALLINT NOT NULL,
    "metadata" JSONB NOT NULL,
    "is_assigned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "origin_metadata_info_pkey" PRIMARY KEY ("origin_id")
);

-- CreateTable
CREATE TABLE "unreveal_metadata_info" (
    "box_type_id" SMALLINT NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unreveal_metadata_info_pkey" PRIMARY KEY ("box_type_id")
);

-- CreateTable
CREATE TABLE "phase2_holders" (
    "id" SERIAL NOT NULL,
    "user_address" VARCHAR(42) NOT NULL,
    "box_type_id" SMALLINT NOT NULL,
    "signature" VARCHAR(300) NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase2_holders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "random_seed_info_random_seed_key" ON "random_seed_info"("random_seed");
