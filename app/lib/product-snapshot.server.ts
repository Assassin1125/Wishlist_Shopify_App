import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

function toVariantGid(id: string) {
  return id.startsWith("gid://") ? id : `gid://shopify/ProductVariant/${id}`;
}

function toProductGid(id: string) {
  return id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
}

export async function upsertProductSnapshot(
  admin: AdminApiContext,
  shopId: string,
  productId: string,
  variantId: string,
) {
  const variantGid = toVariantGid(variantId);
  const productGid = toProductGid(productId);

  const response = await admin.graphql(
    `#graphql
    query WishlistProductSnapshot($id: ID!) {
      shop {
        currencyCode
      }
      productVariant(id: $id) {
        id
        availableForSale
        price
        product {
          id
          title
          handle
          featuredImage {
            url
          }
        }
      }
    }`,
    { variables: { id: variantGid } },
  );

  const { data } = await response.json();
  const variant = data?.productVariant;
  if (!variant) {
    throw Response.json({ error: "Product variant not found" }, { status: 404 });
  }

  return db.productSnapshot.upsert({
    where: {
      shopId_productId_variantId: {
        shopId,
        productId: productGid,
        variantId: variantGid,
      },
    },
    update: {
      handle: variant.product.handle,
      title: variant.product.title,
      imageUrl: variant.product.featuredImage?.url ?? null,
      price: variant.price,
      currency: data.shop.currencyCode,
      available: variant.availableForSale,
    },
    create: {
      shopId,
      productId: productGid,
      variantId: variantGid,
      handle: variant.product.handle,
      title: variant.product.title,
      imageUrl: variant.product.featuredImage?.url ?? null,
      price: variant.price,
      currency: data.shop.currencyCode,
      available: variant.availableForSale,
    },
  });
}

export async function getOrCreateProductSnapshot(
  admin: AdminApiContext,
  shopId: string,
  productId: string,
  variantId: string,
) {
  const existing = await db.productSnapshot.findUnique({
    where: {
      shopId_productId_variantId: {
        shopId,
        productId: toProductGid(productId),
        variantId: toVariantGid(variantId),
      },
    },
  });
  if (existing) return existing;

  return upsertProductSnapshot(admin, shopId, productId, variantId);
}

export { toVariantGid, toProductGid };
