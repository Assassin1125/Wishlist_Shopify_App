import db from "../db.server";
import type { WishlistEventType } from "@prisma/client";
import type { WishlistIdentity } from "./identity.server";

export function logWishlistEvent(
  shopId: string,
  identity: WishlistIdentity,
  productId: string,
  variantId: string,
  type: WishlistEventType,
) {
  return db.wishlistEvent.create({
    data: {
      shopId,
      customerId: identity.customerId,
      guestToken: identity.guestToken,
      productId,
      variantId,
      type,
    },
  });
}

export async function getTotalAdds(shopId: string, since?: Date) {
  return db.wishlistEvent.count({
    where: {
      shopId,
      type: "ADDED",
      ...(since ? { createdAt: { gte: since } } : {}),
    },
  });
}

export async function getMostWishlistedProducts(shopId: string, limit = 10) {
  const grouped = await db.wishlistItem.groupBy({
    by: ["productId"],
    where: { shopId },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });

  const snapshots = await db.productSnapshot.findMany({
    where: { shopId, productId: { in: grouped.map((g) => g.productId) } },
  });
  const snapshotByProduct = new Map(snapshots.map((s) => [s.productId, s]));

  return grouped.map((g) => ({
    productId: g.productId,
    count: g._count._all,
    title: snapshotByProduct.get(g.productId)?.title ?? g.productId,
  }));
}

export async function getConversionRates(shopId: string) {
  const [addedPairs, cartPairs, purchasedPairs] = await Promise.all([
    db.wishlistEvent.findMany({
      where: { shopId, type: "ADDED", customerId: { not: null } },
      distinct: ["customerId", "variantId"],
      select: { customerId: true, variantId: true },
    }),
    db.wishlistEvent.findMany({
      where: { shopId, type: "MOVED_TO_CART", customerId: { not: null } },
      distinct: ["customerId", "variantId"],
      select: { customerId: true, variantId: true },
    }),
    db.wishlistEvent.findMany({
      where: { shopId, type: "PURCHASED", customerId: { not: null } },
      distinct: ["customerId", "variantId"],
      select: { customerId: true, variantId: true },
    }),
  ]);

  const pairKey = (p: { customerId: string | null; variantId: string }) =>
    `${p.customerId}:${p.variantId}`;
  const addedKeys = new Set(addedPairs.map(pairKey));
  const cartHits = cartPairs.filter((p) => addedKeys.has(pairKey(p))).length;
  const purchaseHits = purchasedPairs.filter((p) => addedKeys.has(pairKey(p))).length;

  const addedCount = addedPairs.length;
  return {
    wishlistToCartRate: addedCount === 0 ? 0 : cartHits / addedCount,
    wishlistToPurchaseRate: addedCount === 0 ? 0 : purchaseHits / addedCount,
  };
}

export async function getDailyTrend(shopId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await db.wishlistEvent.findMany({
    where: { shopId, type: "ADDED", createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    trend.push({ date: day, count: counts.get(day) ?? 0 });
  }
  return trend;
}
