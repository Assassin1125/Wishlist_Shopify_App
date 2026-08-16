import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  await db.wishlistItem.deleteMany({ where: { shopId: shop } });
  await db.wishlistEvent.deleteMany({ where: { shopId: shop } });
  await db.productSnapshot.deleteMany({ where: { shopId: shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
