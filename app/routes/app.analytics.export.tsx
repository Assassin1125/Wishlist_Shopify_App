import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getMostWishlistedProducts } from "../lib/analytics.server";

function toCsvValue(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const topProducts = await getMostWishlistedProducts(session.shop, 250);

  const rows = [
    ["Product", "Product ID", "Wishlist count"],
    ...topProducts.map((p) => [p.title, p.productId, p.count]),
  ];
  const csv = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="wishlisted-products.csv"',
    },
  });
};
