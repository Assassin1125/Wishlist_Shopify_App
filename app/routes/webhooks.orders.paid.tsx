import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { toProductGid, toVariantGid } from "../lib/product-snapshot.server";
import { logWishlistEvent } from "../lib/analytics.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const customerId = payload.customer?.id != null ? String(payload.customer.id) : null;
  if (!customerId) {
    return new Response();
  }

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];

  for (const lineItem of lineItems) {
    if (lineItem.variant_id == null) continue;
    const variantId = toVariantGid(String(lineItem.variant_id));
    const productId = toProductGid(String(lineItem.product_id));

    const wasWishlisted = await db.wishlistEvent.findFirst({
      where: { shopId: shop, type: "ADDED", customerId, variantId },
    });
    if (!wasWishlisted) continue;

    const alreadyLogged = await db.wishlistEvent.findFirst({
      where: { shopId: shop, type: "PURCHASED", customerId, variantId },
    });
    if (alreadyLogged) continue;

    await logWishlistEvent(shop, { customerId, guestToken: null }, productId, variantId, "PURCHASED");
  }

  return new Response();
};
