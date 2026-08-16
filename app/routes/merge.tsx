import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ error: "Shop not found" }, { status: 401 });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");
  if (!customerId) {
    return Response.json(
      { error: "Customer must be logged in to merge a wishlist" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const guestToken = String(body.guestToken ?? "");
  if (!guestToken) {
    return Response.json({ error: "guestToken is required" }, { status: 400 });
  }

  const guestItems = await db.wishlistItem.findMany({
    where: { shopId: session.shop, guestToken },
  });

  for (const item of guestItems) {
    await db.wishlistItem.upsert({
      where: {
        shopId_customerId_variantId: {
          shopId: session.shop,
          customerId,
          variantId: item.variantId,
        },
      },
      update: {},
      create: {
        shopId: session.shop,
        customerId,
        productId: item.productId,
        variantId: item.variantId,
      },
    });
  }

  await db.wishlistItem.deleteMany({
    where: { shopId: session.shop, guestToken },
  });

  return Response.json({ merged: guestItems.length });
};
