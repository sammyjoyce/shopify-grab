/**
 * Shopify Liquid Profiler
 *
 * Provides bippy-like source introspection for Shopify themes by fetching
 * Liquid profiling data from Shopify's servers (same API as Theme Inspector).
 *
 * Usage:
 *   1. Call profiler.signIn() to authenticate with Shopify
 *   2. Call profiler.profile() to fetch profiling data for current page
 *   3. Call profiler.getSourceForElement(element) to get source context
 *
 * The profiler caches profile data per URL and auto-refreshes on navigation.
 */

import type {
  PageProfile,
  ProfilerStatus,
  ProfilerToken,
  LiquidSourceLocation,
} from "./types.js";
import { authenticate, hasValidToken, signOut as authSignOut, getSubjectTokenFromCache } from "./auth.js";
import { fetchProfileData } from "./fetcher.js";
import { getSourceForSection, buildOwnerStack, getLocationsForFile } from "./parser.js";

export type { PageProfile, ProfilerStatus, ProfilerToken, LiquidSourceLocation };
export type { SectionSourceMap, SpeedscopeFrame } from "./types.js";

// Profile cache: URL -> PageProfile
const profileCache = new Map<string, PageProfile>();

// Max cache age: 5 minutes
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

// Status listeners
type StatusListener = (status: ProfilerStatus) => void;
const statusListeners = new Set<StatusListener>();
let currentStatus: ProfilerStatus = { state: "idle" };

const setStatus = (status: ProfilerStatus): void => {
  currentStatus = status;
  for (const listener of statusListeners) {
    try { listener(status); } catch {}
  }
};

/**
 * Check if the profiler is authenticated.
 */
export const isAuthenticated = (): boolean => hasValidToken();

/**
 * Check if the profiler has profile data for the current page.
 */
export const hasProfile = (): boolean => {
  if (typeof window === "undefined") return false;
  const cached = getCachedProfile(window.location.href);
  return cached !== null;
};

/**
 * Get the current profiler status.
 */
export const getStatus = (): ProfilerStatus => currentStatus;

/**
 * Subscribe to profiler status changes.
 * Returns an unsubscribe function.
 */
export const onStatusChange = (listener: StatusListener): (() => void) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

/**
 * Sign in to Shopify for profiling access.
 * Opens a popup for OAuth authentication.
 */
export const signIn = async (): Promise<void> => {
  setStatus({ state: "authenticating" });
  try {
    const token = await authenticate();
    setStatus({ state: "authenticated", token });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ state: "error", message: `Auth failed: ${message}` });
    throw error;
  }
};

/**
 * Sign out and clear cached tokens.
 */
export const signOut = (): void => {
  authSignOut();
  profileCache.clear();
  setStatus({ state: "idle" });
};

/**
 * Fetch profiling data for the current page.
 * Caches the result for subsequent lookups.
 */
export const profile = async (url?: string): Promise<PageProfile> => {
  const targetUrl = url ?? window.location.href;

  // Check cache
  const cached = getCachedProfile(targetUrl);
  if (cached) {
    setStatus({ state: "ready", profile: cached });
    return cached;
  }

  // Ensure authenticated
  let token = getSubjectTokenFromCache();
  if (!token) {
    await signIn();
    token = getSubjectTokenFromCache();
    if (!token) throw new Error("Authentication failed");
  }

  setStatus({ state: "fetching" });

  try {
    const pageProfile = await fetchProfileData(targetUrl, token);
    profileCache.set(targetUrl, pageProfile);
    setStatus({ state: "ready", profile: pageProfile });
    return pageProfile;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ state: "error", message });
    throw error;
  }
};

/**
 * Get cached profile for a URL if still fresh.
 */
const getCachedProfile = (url: string): PageProfile | null => {
  const cached = profileCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_MAX_AGE_MS) {
    profileCache.delete(url);
    return null;
  }
  return cached;
};

/**
 * Clear the profile cache for all URLs or a specific URL.
 */
export const clearCache = (url?: string): void => {
  if (url) {
    profileCache.delete(url);
  } else {
    profileCache.clear();
  }
};

// ---- Element-level source resolution ----

/**
 * Get source context for a DOM element using profiling data.
 *
 * This is the primary integration point with shopify-grab's context system.
 * Returns a stack of LiquidSourceLocations from the profiling data,
 * matched by correlating the element's section/block context with the profile.
 */
export const getSourceForElement = (
  element: Element,
): LiquidSourceLocation[] | null => {
  if (typeof window === "undefined") return null;

  const pageProfile = getCachedProfile(window.location.href);
  if (!pageProfile) return null;

  // Find section context from DOM
  const sectionType = findSectionTypeForElement(element);
  if (!sectionType) return null;

  // Get the owner stack (layout -> template -> section)
  const stack = buildOwnerStack(pageProfile, sectionType);
  if (stack.length === 0) return null;

  // Try to find more specific snippet/block context
  const snippetContext = findSnippetContextForElement(element, pageProfile);
  if (snippetContext) {
    stack.push(snippetContext);
  }

  return stack;
};

/**
 * Get the best single source location for an element.
 * Returns the most specific file + line info available.
 */
export const getBestSourceForElement = (
  element: Element,
): LiquidSourceLocation | null => {
  const stack = getSourceForElement(element);
  if (!stack || stack.length === 0) return null;
  // Return the most specific (last) location
  return stack[stack.length - 1];
};

/**
 * Get the render time for the section containing this element.
 */
export const getRenderTimeForElement = (
  element: Element,
): number | null => {
  if (typeof window === "undefined") return null;

  const pageProfile = getCachedProfile(window.location.href);
  if (!pageProfile) return null;

  const sectionType = findSectionTypeForElement(element);
  if (!sectionType) return null;

  const section = pageProfile.sections.get(sectionType);
  return section?.totalRenderTimeMs ?? null;
};

// ---- DOM traversal helpers ----

/**
 * Find the section type for a DOM element by walking up the tree.
 */
const findSectionTypeForElement = (element: Element): string | null => {
  let current: Element | null = element;

  while (current) {
    // Check data-shopify-editor-section
    const editorSection = current.getAttribute("data-shopify-editor-section");
    if (editorSection) {
      try {
        const data = JSON.parse(editorSection);
        if (data.type) return data.type;
      } catch {}
    }

    // Check data-section-type
    const sectionType = current.getAttribute("data-section-type");
    if (sectionType) return sectionType;

    // Infer from section ID
    if (current.classList?.contains("shopify-section") || current.id?.startsWith("shopify-section-")) {
      const sectionId = current.getAttribute("data-section-id") ?? current.id;
      if (sectionId) {
        const type = inferSectionTypeFromId(sectionId);
        if (type) return type;
      }
    }

    current = current.parentElement;
  }

  return null;
};

/**
 * Try to find a snippet-level source location for an element.
 * Uses class name heuristics to match snippet files.
 */
const findSnippetContextForElement = (
  element: Element,
  pageProfile: PageProfile,
): LiquidSourceLocation | null => {
  // Check for data-snippet attribute
  let current: Element | null = element;
  while (current) {
    const snippet = current.getAttribute("data-snippet");
    if (snippet) {
      const locations = getLocationsForFile(pageProfile, `snippets/${snippet}`);
      if (locations.length > 0) {
        return locations.reduce((best, loc) =>
          (loc.line ?? Infinity) < (best.line ?? Infinity) ? loc : best,
        );
      }
    }
    if (
      current.hasAttribute("data-shopify-editor-section") ||
      current.classList?.contains("shopify-section")
    ) {
      break;
    }
    current = current.parentElement;
  }

  // Heuristic: try matching element's class names to snippet files in the profile
  const classes = Array.from(element.classList ?? []);
  for (const className of classes) {
    // BEM convention: "product-card__title" -> try "snippets/product-card.liquid"
    const baseName = className.split("__")[0].split("--")[0];
    if (baseName.length > 2) {
      const locations = getLocationsForFile(pageProfile, `snippets/${baseName}`);
      if (locations.length > 0) {
        return locations.reduce((best, loc) =>
          (loc.line ?? Infinity) < (best.line ?? Infinity) ? loc : best,
        );
      }
    }
  }

  return null;
};

/**
 * Infer section type from a section ID.
 * "shopify-section-template--12345__header" -> "header"
 * "shopify-section-header" -> "header"
 */
const inferSectionTypeFromId = (sectionId: string): string | null => {
  const cleaned = sectionId.replace(/^shopify-section-/, "");
  const match = cleaned.match(/__(.+?)(?:-\d+)?$/);
  if (match) return match[1];
  if (!cleaned.includes("--")) return cleaned;
  return null;
};

/**
 * Detect if the current page is a Shopify store.
 */
export const isShopifyStore = (): boolean => {
  if (typeof document === "undefined") return false;
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    if (script.textContent && /Shopify\.shop\s*=/.test(script.textContent)) {
      return true;
    }
  }
  return false;
};
