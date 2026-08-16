import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const customerId = payload.customer?.id != null ? String(payload.customer.id) : null;
  if (!customerId) {
    return new Response();
  }

  await db.wishlistItem.deleteMany({ where: { shopId: shop, customerId } });
  await db.wishlistEvent.deleteMany({ where: { shopId: shop, customerId } });

  return new Response();
};
