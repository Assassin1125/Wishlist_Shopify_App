import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { upsertProductSnapshot, toProductGid } from "../lib/product-snapshot.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload } = await authenticate.webhook(request);
  if (!admin) return new Response();

  const productId = toProductGid(String(payload.id));

  const snapshots = await db.productSnapshot.findMany({
    where: { shopId: shop, productId },
  });

  for (const snapshot of snapshots) {
    await upsertProductSnapshot(admin, shop, productId, snapshot.variantId);
  }

  return new Response();
};
