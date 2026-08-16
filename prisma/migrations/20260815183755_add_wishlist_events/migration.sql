-- CreateEnum
CREATE TYPE "WishlistEventType" AS ENUM ('ADDED', 'REMOVED', 'MOVED_TO_CART', 'PURCHASED');

-- CreateTable
CREATE TABLE "WishlistEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestToken" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" "WishlistEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistEvent_shopId_createdAt_idx" ON "WishlistEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistEvent_shopId_type_customerId_variantId_idx" ON "WishlistEvent"("shopId", "type", "customerId", "variantId");

-- CreateIndex
CREATE INDEX "WishlistEvent_shopId_productId_idx" ON "WishlistEvent"("shopId", "productId");
