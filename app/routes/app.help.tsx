import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Help() {
  return (
    <s-page heading="Help">
      <s-section heading="1. Turn on the wishlist">
        <s-paragraph>
          Go to <strong>Online Store → Themes → Customize</strong>, open{" "}
          <strong>App embeds</strong> (the icon in the bottom-left of the
          editor), and turn on <strong>Wishlist</strong>. This one switch
          loads everything - the floating wishlist button, the header icon
          (if enabled below), and the wishlist drawer or page.
        </s-paragraph>
      </s-section>

      <s-section heading="2. Add the heart button to products">
        <s-paragraph>
          On a product page, collection page, or product card section in the
          theme editor, choose <strong>Add block → Apps → Wishlist button</strong>.
          This is the heart shoppers click to save a specific size/color to
          their wishlist.
        </s-paragraph>
      </s-section>

      <s-section heading="3. Configure it from Settings">
        <s-paragraph>
          Use the <strong>Settings</strong> page to choose the icon style,
          whether the wishlist opens as a drawer or a full page, and whether
          the floating button and/or header icon are shown (and on which
          side). These apply instantly - no need to touch the theme editor
          again after step 1.
        </s-paragraph>
      </s-section>

      <s-section heading="4. Optional: use your own Page for the dedicated wishlist view">
        <s-paragraph>
          If you set Presentation to &ldquo;Dedicated page&rdquo; in Settings,
          you can use a normal Shopify page instead of the app&apos;s
          built-in one - useful if you want full control over its URL,
          title, or SEO. Go to{" "}
          <strong>Online Store → Pages → Add page</strong>, save it, then open{" "}
          <strong>Online Store → Themes → Customize</strong>, switch to that
          page, and add the <strong>Wishlist page</strong> block to it. Copy
          the page&apos;s URL (e.g. <code>/pages/wishlist</code>) into the{" "}
          <strong>Wishlist page URL</strong> field on the Settings page. If
          you leave that field blank, the wishlist trigger still opens a
          built-in page automatically - this step is only for merchants who
          want their own.
        </s-paragraph>
      </s-section>

      <s-section heading="5. Check the Dashboard">
        <s-paragraph>
          The <strong>Dashboard</strong> shows total wishlist adds,
          wishlist→cart and wishlist→purchase conversion rates, a 30-day
          trend, and your most-wishlisted products - with a CSV export for
          merchandising.
        </s-paragraph>
      </s-section>

      <s-section heading="Good to know">
        <s-unordered-list>
          <s-list-item>
            Guests can wishlist without an account - it merges into their
            wishlist automatically the next time they&apos;re logged in.
          </s-list-item>
          <s-list-item>
            Conversion rates only count logged-in customer activity, since an
            anonymous guest session can&apos;t be linked back to an order.
          </s-list-item>
          <s-list-item>
            Prices, images, and stock status shown in the wishlist stay in
            sync automatically when a product changes.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
