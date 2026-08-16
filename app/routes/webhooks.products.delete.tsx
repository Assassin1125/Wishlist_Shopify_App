import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { toProductGid } from "../lib/product-snapshot.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const productId = toProductGid(String(payload.id));

  await db.productSnapshot.updateMany({
    where: { shopId: shop, productId },
    data: { available: false },
  });

  return new Response();
};
