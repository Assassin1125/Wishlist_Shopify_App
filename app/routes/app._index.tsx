import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  getTotalAdds,
  getMostWishlistedProducts,
  getConversionRates,
  getDailyTrend,
} from "../lib/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalAdds, topProducts, conversion, trend] = await Promise.all([
    getTotalAdds(shop),
    getMostWishlistedProducts(shop, 10),
    getConversionRates(shop),
    getDailyTrend(shop, 30),
  ]);

  return { totalAdds, topProducts, conversion, trend };
};

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Index() {
  const { totalAdds, topProducts, conversion, trend } = useLoaderData<typeof loader>();
  const maxTrendCount = Math.max(1, ...trend.map((day) => day.count));
  const shopify = useAppBridge();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch("/app/analytics/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed with ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "wishlisted-products.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[wishlist] CSV export failed", error);
      shopify.toast.show("Export failed - please try again", { isError: true });
    } finally {
      setExporting(false);
    }
  }

  return (
    <s-page heading="Wishlist analytics">
      <s-button slot="primary-action" onClick={handleExport} {...(exporting ? { loading: true } : {})}>
        Export CSV
      </s-button>

      <s-section heading="Overview">
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          <s-grid-item borderWidth="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Total wishlist adds</s-text>
              <s-heading>{totalAdds}</s-heading>
            </s-stack>
          </s-grid-item>
          <s-grid-item borderWidth="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Wishlist → cart conversion</s-text>
              <s-heading>{formatPercent(conversion.wishlistToCartRate)}</s-heading>
            </s-stack>
          </s-grid-item>
          <s-grid-item borderWidth="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="neutral">Wishlist → purchase conversion</s-text>
              <s-heading>{formatPercent(conversion.wishlistToPurchaseRate)}</s-heading>
            </s-stack>
          </s-grid-item>
        </s-grid>
        <s-paragraph>
          Conversion rates only cover logged-in customer activity - an anonymous
          guest wishlist add can&apos;t be linked back to an order until the shopper
          signs in and it merges onto their account.
        </s-paragraph>
      </s-section>

      <s-section heading="Wishlist adds, last 30 days">
        <div style={{ display: "flex", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "120px",
              fontSize: "11px",
              color: "#666",
              textAlign: "right",
              paddingBottom: "1px",
            }}
          >
            <span>{maxTrendCount}</span>
            <span>{Math.round(maxTrendCount / 2)}</span>
            <span>0</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                height: "120px",
                overflowX: "auto",
                borderLeft: "1px solid #e5e5e5",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              {trend.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count}`}
                  style={{
                    flex: "1 0 6px",
                    minWidth: "6px",
                    height: `${Math.max(2, (day.count / maxTrendCount) * 100)}%`,
                    background: "#1a1a1a",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#666",
                marginTop: "4px",
              }}
            >
              <span>{formatShortDate(trend[0].date)}</span>
              <span>{formatShortDate(trend[Math.floor(trend.length / 2)].date)}</span>
              <span>{formatShortDate(trend[trend.length - 1].date)}</span>
            </div>
          </div>
        </div>
      </s-section>

      <s-section heading="Most wishlisted products">
        <s-paragraph>
          Shoppers currently wishlisting each product right now - not
          lifetime adds, so it goes down when someone removes an item or
          moves it to their cart. &ldquo;Total wishlist adds&rdquo; above counts
          every add ever made, including repeats.
        </s-paragraph>
        {topProducts.length === 0 ? (
          <s-paragraph>No wishlist activity yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>Currently wishlisted by</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {topProducts.map((product) => (
                <s-table-row key={product.productId}>
                  <s-table-cell>{product.title}</s-table-cell>
                  <s-table-cell>{product.count}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
