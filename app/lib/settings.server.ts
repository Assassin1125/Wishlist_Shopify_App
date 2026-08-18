import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export interface WishlistSettings {
  iconStyle: "heart" | "star" | "bookmark" | "custom";
  customIconUrl: string | null;
  presentationMode: "drawer" | "page";
  triggerEnabled: boolean;
  triggerPosition: "bottom-right" | "bottom-left";
  headerIconEnabled: boolean;
  headerIconPosition: "left" | "right";
}

export const DEFAULT_SETTINGS: WishlistSettings = {
  iconStyle: "heart",
  customIconUrl: null,
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
    customIconUrl: map.get("custom_icon_url") || DEFAULT_SETTINGS.customIconUrl,
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
    settings.customIconUrl
      ? { key: "custom_icon_url", type: "single_line_text_field", value: settings.customIconUrl }
      : null,
    { key: "presentation_mode", type: "single_line_text_field", value: settings.presentationMode },
    { key: "trigger_enabled", type: "boolean", value: String(settings.triggerEnabled) },
    { key: "trigger_position", type: "single_line_text_field", value: settings.triggerPosition },
    { key: "header_icon_enabled", type: "boolean", value: String(settings.headerIconEnabled) },
    { key: "header_icon_position", type: "single_line_text_field", value: settings.headerIconPosition },
  ]
    .filter(Boolean)
    .map((field) => ({ ...field, namespace: "$app", ownerId }));

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

export async function deleteCustomIconMetafield(admin: AdminApiContext) {
  const shopResponse = await admin.graphql(`#graphql
    query WishlistSettingsShopIdForDelete {
      shop {
        id
      }
    }`);
  const { data: shopData } = await shopResponse.json();
  const ownerId = shopData.shop.id;

  const response = await admin.graphql(
    `#graphql
    mutation WishlistCustomIconDelete($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { metafields: [{ ownerId, namespace: "$app", key: "custom_icon_url" }] } },
  );
  const { data } = await response.json();
  const userErrors = data?.metafieldsDelete?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join("; "));
  }
}

export async function uploadCustomIcon(admin: AdminApiContext, file: File): Promise<string> {
  const stagedResponse = await admin.graphql(
    `#graphql
    mutation WishlistIconStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: [
          {
            resource: "FILE",
            filename: file.name || "wishlist-icon",
            mimeType: file.type || "image/png",
            httpMethod: "POST",
          },
        ],
      },
    },
  );
  const stagedData = (await stagedResponse.json()).data.stagedUploadsCreate;
  if (stagedData.userErrors.length > 0) {
    throw new Error(stagedData.userErrors.map((e: { message: string }) => e.message).join("; "));
  }
  const target = stagedData.stagedTargets[0];

  const uploadForm = new FormData();
  for (const parameter of target.parameters as Array<{ name: string; value: string }>) {
    uploadForm.append(parameter.name, parameter.value);
  }
  uploadForm.append("file", file);

  const uploadResponse = await fetch(target.url, { method: "POST", body: uploadForm });
  if (!uploadResponse.ok) {
    throw new Error(`Icon upload failed with status ${uploadResponse.status}`);
  }

  const createResponse = await admin.graphql(
    `#graphql
    mutation WishlistIconFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          ... on MediaImage {
            image {
              url
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        files: [{ alt: "Wishlist icon", contentType: "IMAGE", originalSource: target.resourceUrl }],
      },
    },
  );
  const createData = (await createResponse.json()).data.fileCreate;
  if (createData.userErrors.length > 0) {
    throw new Error(createData.userErrors.map((e: { message: string }) => e.message).join("; "));
  }
  const createdFile = createData.files[0];

  let imageUrl: string | null = createdFile.image?.url ?? null;
  for (let attempt = 0; attempt < 5 && !imageUrl; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const pollResponse = await admin.graphql(
      `#graphql
      query WishlistIconFilePoll($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            image {
              url
            }
          }
        }
      }`,
      { variables: { id: createdFile.id } },
    );
    const pollData = (await pollResponse.json()).data.node;
    imageUrl = pollData?.image?.url ?? null;
  }

  if (!imageUrl) {
    throw new Error("Icon uploaded but is still processing - try again in a moment.");
  }

  return imageUrl;
}
