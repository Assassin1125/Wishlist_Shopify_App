import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const TRANSLATIONS = {
  moveToCart: "Move to cart",
  remove: "Remove",
  inStock: "In stock",
  outOfStock: "Out of stock",
  loading: "Adding…",
  addedToast: "Added to wishlist",
  removedToast: "Removed from wishlist",
  movedToCartToast: "Added to cart",
  errorToast: "Something went wrong - please try again",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, liquid } = await authenticate.public.appProxy(request);
  if (!session) {
    return new Response("Not found", { status: 404 });
  }

  return liquid(`
    <script type="application/json" id="wishlist-context">
      {
        "shopDomain": {{ shop.permanent_domain | json }},
        "customerId": {{ customer.id | json }},
        "presentationMode": "page"
      }
    </script>
    <script type="application/json" id="wishlist-i18n">
      ${JSON.stringify(TRANSLATIONS)}
    </script>

    <div class="wishlist-page">
      <h1 class="wishlist-page__title">My Wishlist</h1>
      <div class="wishlist-page__empty" data-wishlist-empty>
        <p>Your wishlist is empty.</p>
      </div>
      <ul class="wishlist-page__list wishlist-drawer__list" data-wishlist-list hidden></ul>
    </div>
  `);
};
