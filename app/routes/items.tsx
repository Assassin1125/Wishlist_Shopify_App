import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getIdentity } from "../lib/identity.server";
import { getOrCreateProductSnapshot, toVariantGid } from "../lib/product-snapshot.server";
import { logWishlistEvent } from "../lib/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ error: "Shop not found" }, { status: 401 });
  }

  const { customerId, guestToken } = getIdentity(request);

  const items = await db.wishlistItem.findMany({
    where: {
      shopId: session.shop,
      ...(customerId ? { customerId } : { guestToken }),
    },
    orderBy: { addedAt: "desc" },
  });

  const snapshots = await db.productSnapshot.findMany({
    where: {
      shopId: session.shop,
      variantId: { in: items.map((item) => item.variantId) },
    },
  });
  const snapshotByVariant = new Map(snapshots.map((s) => [s.variantId, s]));

  return Response.json({
    items: items.map((item) => ({
      ...item,
      snapshot: snapshotByVariant.get(item.variantId) ?? null,
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) {
    return Response.json({ error: "Shop not found" }, { status: 401 });
  }

  const { customerId, guestToken } = getIdentity(request);

  if (request.method === "POST") {
    const body = await request.json();
    const productId = String(body.productId ?? "");
    const variantId = String(body.variantId ?? "");
    if (!productId || !variantId) {
      return Response.json(
        { error: "productId and variantId are required" },
        { status: 400 },
      );
    }

    const snapshot = await getOrCreateProductSnapshot(
      admin,
      session.shop,
      productId,
      variantId,
    );

    const item = customerId
      ? await db.wishlistItem.upsert({
          where: {
            shopId_customerId_variantId: {
              shopId: session.shop,
              customerId,
              variantId: snapshot.variantId,
            },
          },
          update: {},
          create: {
            shopId: session.shop,
            customerId,
            productId: snapshot.productId,
            variantId: snapshot.variantId,
          },
        })
      : await db.wishlistItem.upsert({
          where: {
            shopId_guestToken_variantId: {
              shopId: session.shop,
              guestToken: guestToken!,
              variantId: snapshot.variantId,
            },
          },
          update: {},
          create: {
            shopId: session.shop,
            guestToken,
            productId: snapshot.productId,
            variantId: snapshot.variantId,
          },
        });

    await logWishlistEvent(
      session.shop,
      { customerId, guestToken },
      snapshot.productId,
      snapshot.variantId,
      "ADDED",
    );

    return Response.json({ item, snapshot });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const variantIdParam = url.searchParams.get("variant_id");
    if (!variantIdParam) {
      return Response.json({ error: "variant_id is required" }, { status: 400 });
    }
    const variantId = toVariantGid(variantIdParam);
    const reason = url.searchParams.get("reason");

    const existing = await db.wishlistItem.findFirst({
      where: {
        shopId: session.shop,
        variantId,
        ...(customerId ? { customerId } : { guestToken }),
      },
    });

    await db.wishlistItem.deleteMany({
      where: {
        shopId: session.shop,
        variantId,
        ...(customerId ? { customerId } : { guestToken }),
      },
    });

    if (existing) {
      await logWishlistEvent(
        session.shop,
        { customerId, guestToken },
        existing.productId,
        existing.variantId,
        reason === "moved_to_cart" ? "MOVED_TO_CART" : "REMOVED",
      );
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
