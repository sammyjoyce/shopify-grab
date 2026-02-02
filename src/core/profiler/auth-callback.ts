/**
 * Auth callback handler.
 *
 * When the OAuth popup redirects to /__shopify-grab-auth-callback,
 * the popup's URL will contain the auth code. The parent window
 * polls the popup's URL via the launchPopupAuth function in auth.ts.
 *
 * For stores where we control the page (e.g., during shopify theme dev),
 * we can also intercept navigation to serve a simple callback page.
 *
 * This module provides a service worker / fetch event handler approach,
 * but in practice the popup URL polling in auth.ts handles most cases.
 *
 * For cases where cross-origin restrictions prevent URL reading,
 * this module installs a message-based fallback.
 */

/**
 * Install the auth callback message listener.
 * Should be called during initialization.
 *
 * This listens for postMessage from the OAuth popup window,
 * which some OAuth flows use as a fallback.
 */
export const installAuthCallbackListener = (): (() => void) => {
  const handler = (event: MessageEvent) => {
    if (
      event.data &&
      typeof event.data === "object" &&
      event.data.type === "shopify-grab-auth-callback"
    ) {
      // The auth code is handled by the popup URL polling in auth.ts
      // This is a fallback for edge cases
      window.dispatchEvent(
        new CustomEvent("shopify-grab:auth-code", {
          detail: {
            code: event.data.code,
            error: event.data.error,
          },
        }),
      );
    }
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
};
