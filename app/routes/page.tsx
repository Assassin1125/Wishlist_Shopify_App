import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

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
      {
        "moveToCart": {{ 'wishlist.drawer.move_to_cart' | t | json }},
        "remove": {{ 'wishlist.drawer.remove' | t | json }},
        "inStock": {{ 'wishlist.drawer.in_stock' | t | json }},
        "outOfStock": {{ 'wishlist.drawer.out_of_stock' | t | json }},
        "loading": {{ 'wishlist.drawer.loading' | t | json }},
        "addedToast": {{ 'wishlist.toast.added' | t | json }},
        "removedToast": {{ 'wishlist.toast.removed' | t | json }},
        "movedToCartToast": {{ 'wishlist.toast.moved_to_cart' | t | json }},
        "errorToast": {{ 'wishlist.toast.error' | t | json }}
      }
    </script>

    <div class="wishlist-page">
      <h1 class="wishlist-page__title">{{ 'wishlist.drawer.title' | t }}</h1>
      <div class="wishlist-page__empty" data-wishlist-empty>
        <p>{{ 'wishlist.drawer.empty' | t }}</p>
      </div>
      <ul class="wishlist-page__list wishlist-drawer__list" data-wishlist-list hidden></ul>
    </div>

    {{ 'wishlist.css' | asset_url | stylesheet_tag }}
    <script src="{{ 'wishlist.js' | asset_url }}" defer></script>
  `);
};
