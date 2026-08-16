-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestToken" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_shopId_customerId_idx" ON "WishlistItem"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "WishlistItem_shopId_productId_idx" ON "WishlistItem"("shopId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_shopId_customerId_variantId_key" ON "WishlistItem"("shopId", "customerId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_shopId_guestToken_variantId_key" ON "WishlistItem"("shopId", "guestToken", "variantId");

-- CreateIndex
CREATE INDEX "ProductSnapshot_shopId_productId_idx" ON "ProductSnapshot"("shopId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSnapshot_shopId_productId_variantId_key" ON "ProductSnapshot"("shopId", "productId", "variantId");
