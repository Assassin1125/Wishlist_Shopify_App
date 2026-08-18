(function () {
  "use strict";

  if (window.__wishlistWidgetInitialized) return;
  window.__wishlistWidgetInitialized = true;

  var GUEST_COOKIE = "wishlist_guest_token";
  var ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  var TOAST_DURATION_MS = 2400;

  var context = { customerId: null, shopDomain: null, presentationMode: "drawer" };
  var translations = {
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

  var state = { items: new Map() };

  function parseJsonScript(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.error("[wishlist] failed to parse " + id, e);
      return null;
    }
  }

  function readGuestTokenRaw() {
    var match = document.cookie.match(new RegExp("(?:^|; )" + GUEST_COOKIE + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setGuestToken(token) {
    document.cookie =
      GUEST_COOKIE + "=" + encodeURIComponent(token) + "; path=/; max-age=" + ONE_YEAR_SECONDS + "; SameSite=Lax";
  }

  function clearGuestToken() {
    document.cookie = GUEST_COOKIE + "=; path=/; max-age=0";
  }

  function getOrCreateGuestToken() {
    var existing = readGuestTokenRaw();
    if (existing) return existing;
    var token =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : "guest-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    setGuestToken(token);
    return token;
  }

  function toProductGid(id) {
    return String(id).indexOf("gid://") === 0 ? String(id) : "gid://shopify/Product/" + id;
  }

  function toVariantGid(id) {
    return String(id).indexOf("gid://") === 0 ? String(id) : "gid://shopify/ProductVariant/" + id;
  }

  function numericIdFromGid(gid) {
    return String(gid).split("/").pop();
  }

  async function wishlistFetch(path, options) {
    options = options || {};
    var params = new URLSearchParams();
    if (!context.customerId) {
      params.set("guest_token", getOrCreateGuestToken());
    }
    var separator = path.indexOf("?") === -1 ? "?" : "&";
    var url = "/apps/wishlist" + path + separator + params.toString();

    var res = await fetch(url, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      throw new Error("Wishlist request to " + path + " failed with " + res.status);
    }
    return res.json();
  }

  async function maybeMergeGuestWishlist() {
    if (!context.customerId) return;
    var guestToken = readGuestTokenRaw();
    if (!guestToken) return;
    try {
      await wishlistFetch("/merge", { method: "POST", body: { guestToken: guestToken } });
    } catch (e) {
      console.error("[wishlist] merge failed", e);
    } finally {
      clearGuestToken();
    }
  }

  var toastTimeout = null;
  function showToast(message, isError) {
    var toast = document.getElementById("wishlist-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "wishlist-toast";
      toast.className = "wishlist-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("is-error", !!isError);
    toast.classList.remove("is-visible");
    toast.offsetWidth;
    toast.classList.add("is-visible");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, TOAST_DURATION_MS);
  }

  function updateCountBadge() {
    var count = state.items.size;
    document.querySelectorAll("[data-wishlist-count]").forEach(function (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  function resolveVariantId(button) {
    var form = button.closest("form");
    var input = form ? form.querySelector('[name="id"]') : null;
    if (!input || !input.value) {
      input = document.querySelector('form[action*="/cart/add"] [name="id"]');
    }
    return input && input.value ? input.value : button.dataset.variantId;
  }

  function updateButtonState(button) {
    var variantId = toVariantGid(resolveVariantId(button));
    var pressed = state.items.has(variantId);
    var wasPressed = button.classList.contains("is-active");
    button.setAttribute("aria-pressed", String(pressed));
    button.classList.toggle("is-active", pressed);
    var label = pressed ? button.dataset.labelRemove : button.dataset.labelAdd;
    if (label) button.setAttribute("aria-label", label);

    if (pressed && !wasPressed) {
      button.classList.remove("wishlist-button--pop");
      button.offsetWidth;
      button.classList.add("wishlist-button--pop");
    }
  }

  function syncAllButtons() {
    document.querySelectorAll("[data-wishlist-button]").forEach(updateButtonState);
  }

  function renderDrawerFromState() {
    renderDrawerItems(Array.from(state.items.values()).reverse());
  }

  function syncButtonsForVariant(variantGid) {
    document.querySelectorAll('[data-wishlist-button]').forEach(function (button) {
      if (toVariantGid(resolveVariantId(button)) === variantGid) updateButtonState(button);
    });
    updateCountBadge();
    document.dispatchEvent(new CustomEvent("wishlist:changed", { detail: { variantId: variantGid } }));
    renderDrawerFromState();
  }

  async function fetchAndSyncWishlist() {
    var data = await wishlistFetch("/items");
    state.items = new Map(data.items.map(function (item) { return [item.variantId, item]; }));
    syncAllButtons();
    updateCountBadge();
    renderDrawerFromState();
    return data.items;
  }

  async function loadState() {
    try {
      await fetchAndSyncWishlist();
    } catch (e) {
      console.error("[wishlist] failed to load wishlist", e);
    }
  }

  async function toggleWishlist(button) {
    var productGid = toProductGid(button.dataset.productId);
    var variantGid = toVariantGid(resolveVariantId(button));
    var wasActive = state.items.has(variantGid);
    var previous = state.items.get(variantGid);

    if (wasActive) {
      state.items.delete(variantGid);
    } else {
      state.items.set(variantGid, {
        productId: productGid,
        variantId: variantGid,
        addedAt: new Date().toISOString(),
        snapshot: null,
      });
    }
    syncButtonsForVariant(variantGid);
    showToast(wasActive ? translations.removedToast : translations.addedToast);

    try {
      if (wasActive) {
        await wishlistFetch("/items?variant_id=" + encodeURIComponent(numericIdFromGid(variantGid)), {
          method: "DELETE",
        });
      } else {
        var data = await wishlistFetch("/items", {
          method: "POST",
          body: { productId: productGid, variantId: variantGid },
        });
        var entry = state.items.get(variantGid);
        if (entry) entry.snapshot = data.snapshot;
        renderDrawerFromState();
      }
    } catch (e) {
      console.error("[wishlist] toggle failed", e);
      if (wasActive) {
        if (previous) state.items.set(variantGid, previous);
      } else {
        state.items.delete(variantGid);
      }
      syncButtonsForVariant(variantGid);
      showToast(translations.errorToast, true);
    }
  }

  async function removeFromWishlist(variantGid, options) {
    options = options || {};
    var previous = state.items.get(variantGid);
    state.items.delete(variantGid);
    syncButtonsForVariant(variantGid);
    if (!options.silent) showToast(translations.removedToast);

    try {
      var path = "/items?variant_id=" + encodeURIComponent(numericIdFromGid(variantGid));
      if (options.reason) path += "&reason=" + encodeURIComponent(options.reason);
      await wishlistFetch(path, { method: "DELETE" });
    } catch (e) {
      console.error("[wishlist] remove failed", e);
      if (previous) state.items.set(variantGid, previous);
      syncButtonsForVariant(variantGid);
      showToast(translations.errorToast, true);
    }
  }

  async function moveToCart(variantGid) {
    var res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: Number(numericIdFromGid(variantGid)), quantity: 1 }] }),
    });
    if (!res.ok) throw new Error("Add to cart failed with " + res.status);
    await removeFromWishlist(variantGid, { reason: "moved_to_cart", silent: true });
    showToast(translations.movedToCartToast);
    document.dispatchEvent(new CustomEvent("wishlist:added-to-cart", { detail: { variantId: variantGid } }));
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: "currency",
        currency: currency,
      }).format(Number(amount));
    } catch (e) {
      return amount + " " + currency;
    }
  }

  function renderDrawerItems(items) {
    var list = document.querySelector("[data-wishlist-list]");
    var empty = document.querySelector("[data-wishlist-empty]");
    if (!list || !empty) return;

    list.innerHTML = "";
    if (items.length === 0) {
      empty.hidden = false;
      list.hidden = true;
      return;
    }
    empty.hidden = true;
    list.hidden = false;

    items.forEach(function (item) {
      var snapshot = item.snapshot;
      var li = document.createElement("li");
      li.className = "wishlist-drawer__item";
      li.dataset.variantId = item.variantId;

      if (!snapshot) {
        li.innerHTML =
          '<div class="wishlist-drawer__image wishlist-drawer__image--placeholder"></div>' +
          '<div class="wishlist-drawer__details">' +
          '<p class="wishlist-drawer__item-title">' +
          escapeHtml(translations.loading) +
          "</p>" +
          "</div>";
        list.appendChild(li);
        return;
      }

      var outOfStock = snapshot.available === false;
      var productUrl = snapshot.handle
        ? "/products/" + snapshot.handle + "?variant=" + numericIdFromGid(item.variantId)
        : null;

      var imageMarkup =
        '<img class="wishlist-drawer__image" src="' +
        escapeHtml(snapshot.imageUrl) +
        '" alt="' +
        escapeHtml(snapshot.title) +
        '" loading="lazy" width="96" height="96">';
      if (productUrl) {
        imageMarkup =
          '<a class="wishlist-drawer__image-link" href="' + escapeHtml(productUrl) + '">' + imageMarkup + "</a>";
      }

      var titleMarkup = productUrl
        ? '<a class="wishlist-drawer__item-title" href="' +
          escapeHtml(productUrl) +
          '">' +
          escapeHtml(snapshot.title) +
          "</a>"
        : '<span class="wishlist-drawer__item-title">' + escapeHtml(snapshot.title) + "</span>";

      var variantTitleMarkup = "";
      if (Array.isArray(snapshot.selectedOptions) && snapshot.selectedOptions.length > 0) {
        variantTitleMarkup =
          '<p class="wishlist-drawer__item-variant">' +
          snapshot.selectedOptions
            .map(function (option) {
              return escapeHtml(option.name) + ": " + escapeHtml(option.value);
            })
            .join(" · ") +
          "</p>";
      } else if (snapshot.variantTitle) {
        variantTitleMarkup = '<p class="wishlist-drawer__item-variant">' + escapeHtml(snapshot.variantTitle) + "</p>";
      }

      li.innerHTML =
        imageMarkup +
        '<div class="wishlist-drawer__details">' +
        titleMarkup +
        variantTitleMarkup +
        '<p class="wishlist-drawer__item-price">' +
        escapeHtml(formatMoney(snapshot.price, snapshot.currency)) +
        "</p>" +
        '<p class="wishlist-drawer__item-stock' +
        (outOfStock ? " is-out-of-stock" : "") +
        '">' +
        escapeHtml(outOfStock ? translations.outOfStock : translations.inStock) +
        "</p>" +
        '<div class="wishlist-drawer__item-actions">' +
        '<button type="button" class="wishlist-drawer__move-to-cart" data-wishlist-move-to-cart' +
        (outOfStock ? " disabled" : "") +
        ">" +
        escapeHtml(translations.moveToCart) +
        "</button>" +
        '<button type="button" class="wishlist-drawer__remove" data-wishlist-remove>' +
        escapeHtml(translations.remove) +
        "</button>" +
        "</div>" +
        "</div>";
      list.appendChild(li);
    });
  }

  async function refreshDrawer() {
    try {
      await fetchAndSyncWishlist();
    } catch (e) {
      console.error("[wishlist] failed to refresh drawer", e);
    }
  }

  function openDrawer() {
    var drawer = document.getElementById("wishlist-drawer");
    if (!drawer) return;
    drawer.classList.add("is-open");
    document.body.classList.add("wishlist-drawer-open");
    refreshDrawer();
  }

  function closeDrawer() {
    var drawer = document.getElementById("wishlist-drawer");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    document.body.classList.remove("wishlist-drawer-open");
  }

  document.addEventListener("click", function (event) {
    var target = event.target;

    var wishlistButton = target.closest("[data-wishlist-button]");
    if (wishlistButton) {
      toggleWishlist(wishlistButton);
      return;
    }

    if (target.closest("[data-wishlist-drawer-open]")) {
      if (context.presentationMode === "page") {
        window.location.href = "/apps/wishlist/page";
      } else {
        openDrawer();
      }
      return;
    }

    if (target.closest("[data-wishlist-drawer-close]")) {
      closeDrawer();
      return;
    }

    var removeButton = target.closest("[data-wishlist-remove]");
    if (removeButton) {
      var removeItem = removeButton.closest("[data-variant-id]");
      if (removeItem) {
        removeFromWishlist(removeItem.dataset.variantId);
      }
      return;
    }

    var moveButton = target.closest("[data-wishlist-move-to-cart]");
    if (moveButton && !moveButton.disabled) {
      var moveItem = moveButton.closest("[data-variant-id]");
      if (moveItem) {
        moveToCart(moveItem.dataset.variantId).catch(function (e) {
          console.error("[wishlist] move to cart failed", e);
          showToast(translations.errorToast, true);
        });
      }
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeDrawer();
  });

  var lastKnownVariantByButton = new WeakMap();

  setInterval(function () {
    document.querySelectorAll("[data-wishlist-button]").forEach(function (button) {
      var current = resolveVariantId(button);
      if (lastKnownVariantByButton.get(button) !== current) {
        lastKnownVariantByButton.set(button, current);
        updateButtonState(button);
      }
    });
  }, 400);

  function findHeaderAccountLink() {
    var header = document.querySelector("header, [role='banner'], .header, .site-header");
    var scope = header || document;
    var candidates = scope.querySelectorAll(
      "a[href*='/account'], a[href*='/customer_authentication'], a[href*='/challenge']"
    );
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].offsetParent !== null) return candidates[i];
    }
    return candidates[0] || null;
  }

  function placeHeaderIcon() {
    var icon = document.querySelector(".wishlist-header-icon");
    if (!icon) return;
    var anchor = findHeaderAccountLink();
    if (!anchor || !anchor.parentNode) return;

    icon.classList.add("wishlist-header-icon--inline");
    if (icon.classList.contains("wishlist-header-icon--left")) {
      anchor.parentNode.insertBefore(icon, anchor);
    } else {
      anchor.parentNode.insertBefore(icon, anchor.nextSibling);
    }
  }

  async function init() {
    context = parseJsonScript("wishlist-context") || context;
    if (context.customerId != null) context.customerId = String(context.customerId);
    translations = Object.assign({}, translations, parseJsonScript("wishlist-i18n") || {});

    placeHeaderIcon();
    await maybeMergeGuestWishlist();
    await loadState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
