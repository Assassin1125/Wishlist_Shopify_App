import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export interface WishlistSettings {
  iconStyle: "heart" | "star" | "bookmark";
  presentationMode: "drawer" | "page";
  triggerEnabled: boolean;
  triggerPosition: "bottom-right" | "bottom-left";
  headerIconEnabled: boolean;
  headerIconPosition: "left" | "right";
}

export const DEFAULT_SETTINGS: WishlistSettings = {
  iconStyle: "heart",
  presentationMode: "drawer",
  triggerEnabled: true,
  triggerPosition: "bottom-right",
  headerIconEnabled: false,
  headerIconPosition: "right",
};

export async function getWishlistSettings(admin: AdminApiContext): Promise<WishlistSettings> {
  const response = await admin.graphql(
    `#graphql
    query WishlistSettings {
      shop {
        metafields(namespace: "$app", first: 10) {
          nodes {
            key
            value
          }
        }
      }
    }`,
  );
  const { data } = await response.json();
  const nodes: Array<{ key: string; value: string }> = data?.shop?.metafields?.nodes ?? [];
  const map = new Map(nodes.map((n) => [n.key, n.value]));

  return {
    iconStyle: (map.get("icon_style") as WishlistSettings["iconStyle"]) ?? DEFAULT_SETTINGS.iconStyle,
    presentationMode:
      (map.get("presentation_mode") as WishlistSettings["presentationMode"]) ?? DEFAULT_SETTINGS.presentationMode,
    triggerEnabled: map.has("trigger_enabled")
      ? map.get("trigger_enabled") === "true"
      : DEFAULT_SETTINGS.triggerEnabled,
    triggerPosition:
      (map.get("trigger_position") as WishlistSettings["triggerPosition"]) ?? DEFAULT_SETTINGS.triggerPosition,
    headerIconEnabled: map.has("header_icon_enabled")
      ? map.get("header_icon_enabled") === "true"
      : DEFAULT_SETTINGS.headerIconEnabled,
    headerIconPosition:
      (map.get("header_icon_position") as WishlistSettings["headerIconPosition"]) ??
      DEFAULT_SETTINGS.headerIconPosition,
  };
}

export async function saveWishlistSettings(admin: AdminApiContext, settings: WishlistSettings) {
  const shopResponse = await admin.graphql(`#graphql
    query WishlistSettingsShopId {
      shop {
        id
      }
    }`);
  const { data: shopData } = await shopResponse.json();
  const ownerId = shopData.shop.id;

  const metafields = [
    { key: "icon_style", type: "single_line_text_field", value: settings.iconStyle },
    { key: "presentation_mode", type: "single_line_text_field", value: settings.presentationMode },
    { key: "trigger_enabled", type: "boolean", value: String(settings.triggerEnabled) },
    { key: "trigger_position", type: "single_line_text_field", value: settings.triggerPosition },
    { key: "header_icon_enabled", type: "boolean", value: String(settings.headerIconEnabled) },
    { key: "header_icon_position", type: "single_line_text_field", value: settings.headerIconPosition },
  ].map((field) => ({ ...field, namespace: "$app", ownerId }));

  const response = await admin.graphql(
    `#graphql
    mutation WishlistSettingsSave($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { metafields } },
  );
  const { data } = await response.json();
  const userErrors = data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join("; "));
  }
}
