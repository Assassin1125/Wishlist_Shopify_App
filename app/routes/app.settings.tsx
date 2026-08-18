import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  DEFAULT_SETTINGS,
  deleteCustomIconMetafield,
  getWishlistSettings,
  saveWishlistSettings,
  uploadCustomIcon,
} from "../lib/settings.server";
import type { WishlistSettings } from "../lib/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const settings = await getWishlistSettings(admin);
    return { settings };
  } catch (error) {
    console.error("[wishlist] failed to load settings", error);
    return { settings: DEFAULT_SETTINGS, loadError: true };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "uploadIcon") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return { error: "Choose an image file to upload." };
      }
      const current = await getWishlistSettings(admin);
      const customIconUrl = await uploadCustomIcon(admin, file);
      const settings: WishlistSettings = { ...current, iconStyle: "custom", customIconUrl };
      await saveWishlistSettings(admin, settings);
      return { ok: true, settings };
    }

    if (intent === "removeIcon") {
      const current = await getWishlistSettings(admin);
      const settings: WishlistSettings = {
        ...current,
        iconStyle: current.iconStyle === "custom" ? "heart" : current.iconStyle,
        customIconUrl: null,
      };
      await saveWishlistSettings(admin, settings);
      await deleteCustomIconMetafield(admin);
      return { ok: true, settings };
    }

    const current = await getWishlistSettings(admin);
    const settings: WishlistSettings = {
      ...current,
      iconStyle: (formData.get("iconStyle") as WishlistSettings["iconStyle"]) || "heart",
      presentationMode: (formData.get("presentationMode") as WishlistSettings["presentationMode"]) || "drawer",
      triggerEnabled: formData.get("triggerEnabled") === "true",
      triggerPosition: (formData.get("triggerPosition") as WishlistSettings["triggerPosition"]) || "bottom-right",
      headerIconEnabled: formData.get("headerIconEnabled") === "true",
      headerIconPosition: (formData.get("headerIconPosition") as WishlistSettings["headerIconPosition"]) || "right",
    };

    await saveWishlistSettings(admin, settings);
    return { ok: true, settings };
  } catch (error) {
    console.error("[wishlist] settings action failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong - please try again." };
  }
};

export default function Settings() {
  const { settings: initial, loadError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const iconFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState<WishlistSettings>(initial);
  const [savedSettings, setSavedSettings] = useState<WishlistSettings>(initial);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saving = fetcher.state !== "idle";
  const uploadingIcon = iconFetcher.state !== "idle";
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    if (loadError) {
      shopify.toast.show("Couldn't load your current settings - showing defaults. Refresh and try again.", {
        isError: true,
      });
    }
  }, [loadError, shopify]);

  useEffect(() => {
    if (!fetcher.data) return;
    if ("ok" in fetcher.data && fetcher.data.ok) {
      shopify.toast.show("Settings saved");
      setSavedSettings(fetcher.data.settings);
    }
    if ("error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (!iconFetcher.data) return;
    if ("settings" in iconFetcher.data && iconFetcher.data.settings) {
      setSettings(iconFetcher.data.settings);
      setSavedSettings(iconFetcher.data.settings);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    if ("error" in iconFetcher.data && iconFetcher.data.error) {
      shopify.toast.show(iconFetcher.data.error, { isError: true });
    }
  }, [iconFetcher.data, shopify]);

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

  function handleUploadIcon(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.set("intent", "uploadIcon");
    uploadData.set("file", file);
    iconFetcher.submit(uploadData, { method: "POST", encType: "multipart/form-data" });
  }

  function handleRemoveIcon() {
    iconFetcher.submit({ intent: "removeIcon" }, { method: "POST" });
  }

  return (
    <s-page heading="Settings">
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(saving ? { loading: true } : {})}
        {...(!isDirty ? { disabled: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Wishlist icon">
        <s-paragraph>
          Choose the icon shoppers click to save an item, or upload your own.
          Used on product cards, the product page, and the header icon if
          it&apos;s turned on below.
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
          <s-option value="custom">Custom upload</s-option>
        </s-select>

        {settings.iconStyle === "custom" && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
            {settings.customIconUrl ? (
              <>
                <img
                  src={settings.customIconUrl}
                  alt="Custom wishlist icon"
                  width={32}
                  height={32}
                  style={{ objectFit: "contain" }}
                />
                <s-button onClick={handleRemoveIcon} {...(uploadingIcon ? { loading: true } : {})}>
                  Remove custom icon
                </s-button>
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleUploadIcon}
                  disabled={uploadingIcon}
                />
                {uploadingIcon && <s-text tone="neutral">Uploading…</s-text>}
              </>
            )}
          </div>
        )}
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
          Adds a wishlist icon next to your theme&apos;s account icon, with a
          live item count badge.
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
