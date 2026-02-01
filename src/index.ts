export { init } from "./core/index.js";
export {
  getStack,
  formatElementInfo,
  isInstrumentationActive,
  DEFAULT_THEME,
} from "./core/index.js";
export { generateSnippet } from "./utils/generate-snippet.js";
// design-system.tsx removed for Shopify build
export {
  captureElementScreenshot,
  copyImageToClipboard,
  combineBounds,
} from "./utils/capture-screenshot.js";
export type { ElementBounds } from "./utils/capture-screenshot.js";
export { isScreenshotSupported } from "./utils/is-screenshot-supported.js";
export type {
  Options,
  ShopifyGrabAPI,
  SourceInfo,
  Theme,
  ShopifyGrabState,
  ToolbarState,
  OverlayBounds,
  GrabbedBox,
  DragRect,
  Rect,
  DeepPartial,
  ElementLabelVariant,
  PromptModeContext,
  CrosshairContext,
  ElementLabelContext,
  AgentContext,
  AgentSession,
  AgentProvider,
  AgentSessionStorage,
  AgentOptions,
  AgentCompleteResult,
  SettableOptions,
  ActivationMode,
  ContextMenuAction,
  ActionContext,
  Plugin,
  PluginConfig,
  PluginHooks,
} from "./types.js";

import { init } from "./core/index.js";
import type { ShopifyGrabAPI } from "./types.js";

declare global {
  interface Window {
    __SHOPIFY_GRAB__?: ShopifyGrabAPI;
  }
}

let globalApi: ShopifyGrabAPI | null = null;

export const getGlobalApi = (): ShopifyGrabAPI | null => {
  if (typeof window === "undefined") return globalApi;
  return window.__SHOPIFY_GRAB__ ?? globalApi ?? null;
};

export const setGlobalApi = (api: ShopifyGrabAPI | null): void => {
  globalApi = api;
  if (typeof window !== "undefined") {
    if (api) {
      window.__SHOPIFY_GRAB__ = api;
    } else {
      delete window.__SHOPIFY_GRAB__;
    }
  }
};

if (typeof window !== "undefined") {
  if (window.__SHOPIFY_GRAB__) {
    globalApi = window.__SHOPIFY_GRAB__;
  } else {
    globalApi = init();
    window.__SHOPIFY_GRAB__ = globalApi;
  }
  window.dispatchEvent(
    new CustomEvent("shopify-grab:init", { detail: globalApi }),
  );
}
