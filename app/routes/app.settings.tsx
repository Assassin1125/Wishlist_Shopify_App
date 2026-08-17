import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { getWishlistSettings, saveWishlistSettings } from "../lib/settings.server";
import type { WishlistSettings } from "../lib/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const settings = await getWishlistSettings(admin);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const settings: WishlistSettings = {
    iconStyle: (formData.get("iconStyle") as WishlistSettings["iconStyle"]) || "heart",
    presentationMode: (formData.get("presentationMode") as WishlistSettings["presentationMode"]) || "drawer",
    triggerEnabled: formData.get("triggerEnabled") === "true",
    triggerPosition: (formData.get("triggerPosition") as WishlistSettings["triggerPosition"]) || "bottom-right",
    headerIconEnabled: formData.get("headerIconEnabled") === "true",
    headerIconPosition: (formData.get("headerIconPosition") as WishlistSettings["headerIconPosition"]) || "right",
  };

  await saveWishlistSettings(admin, settings);
  return { ok: true };
};

export default function Settings() {
  const { settings: initial } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState<WishlistSettings>(initial);
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Settings saved");
    }
  }, [fetcher.data, shopify]);

  function update<K extends keyof WishlistSettings>(key: K, value: WishlistSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    fetcher.submit(
      {
        iconStyle: settings.iconStyle,
        presentationMode: settings.presentationMode,
        triggerEnabled: String(settings.triggerEnabled),
        triggerPosition: settings.triggerPosition,
        headerIconEnabled: String(settings.headerIconEnabled),
        headerIconPosition: settings.headerIconPosition,
      },
      { method: "POST" },
    );
  }

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" onClick={handleSave} {...(saving ? { loading: true } : {})}>
        Save
      </s-button>

      <s-section heading="Wishlist icon">
        <s-paragraph>
          Choose the icon shoppers click to save an item. Used on product
          cards, the product page, and the header icon if it&apos;s turned on
          below.
        </s-paragraph>
        <s-select
          name="iconStyle"
          label="Icon style"
          value={settings.iconStyle}
          onChange={(event: Event) =>
            update("iconStyle", (event.target as HTMLSelectElement).value as WishlistSettings["iconStyle"])
          }
        >
          <s-option value="heart">Heart</s-option>
          <s-option value="star">Star</s-option>
          <s-option value="bookmark">Bookmark</s-option>
        </s-select>
      </s-section>

      <s-section heading="How the wishlist opens">
        <s-paragraph>
          Show saved items in a slide-out drawer, or send shoppers to a
          dedicated wishlist page instead.
        </s-paragraph>
        <s-select
          name="presentationMode"
          label="Presentation"
          value={settings.presentationMode}
          onChange={(event: Event) =>
            update(
              "presentationMode",
              (event.target as HTMLSelectElement).value as WishlistSettings["presentationMode"],
            )
          }
        >
          <s-option value="drawer">Slide-out drawer</s-option>
          <s-option value="page">Dedicated page</s-option>
        </s-select>
      </s-section>

      <s-section heading="Floating wishlist button">
        <s-paragraph>
          A floating button shoppers can click from anywhere on the storefront
          to open their wishlist.
        </s-paragraph>
        <s-switch
          name="triggerEnabled"
          label="Show floating button"
          checked={settings.triggerEnabled}
          onChange={(event: Event) => update("triggerEnabled", (event.target as HTMLInputElement).checked)}
        />
        <s-select
          name="triggerPosition"
          label="Position"
          value={settings.triggerPosition}
          disabled={!settings.triggerEnabled}
          onChange={(event: Event) =>
            update("triggerPosition", (event.target as HTMLSelectElement).value as WishlistSettings["triggerPosition"])
          }
        >
          <s-option value="bottom-right">Bottom right</s-option>
          <s-option value="bottom-left">Bottom left</s-option>
        </s-select>
      </s-section>

      <s-section heading="Header icon">
        <s-paragraph>
          Adds a wishlist icon directly into your theme&apos;s header, next to
          the cart and account icons, with a live item count badge.
        </s-paragraph>
        <s-switch
          name="headerIconEnabled"
          label="Show header icon"
          checked={settings.headerIconEnabled}
          onChange={(event: Event) => update("headerIconEnabled", (event.target as HTMLInputElement).checked)}
        />
        <s-select
          name="headerIconPosition"
          label="Position relative to the account icon"
          value={settings.headerIconPosition}
          disabled={!settings.headerIconEnabled}
          onChange={(event: Event) =>
            update(
              "headerIconPosition",
              (event.target as HTMLSelectElement).value as WishlistSettings["headerIconPosition"],
            )
          }
        >
          <s-option value="left">Left of account icon</s-option>
          <s-option value="right">Right of account icon</s-option>
        </s-select>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
