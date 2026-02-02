/**
 * Fetch Liquid profiling data from Shopify's servers.
 *
 * Uses the same mechanism as the Theme Inspector Chrome extension:
 * GET the current page URL with Accept: application/vnd.speedscope+json
 * and an OAuth Bearer token.
 */

import type { SpeedscopeFile, PageProfile, ProfilerToken } from "./types.js";
import { parseSpeedscopeProfile } from "./parser.js";

/**
 * Fetch profiling data for a given URL.
 * Requires a valid subject access token from the auth module.
 */
export const fetchProfileData = async (
  url: string,
  token: ProfilerToken,
): Promise<PageProfile> => {
  const cleanUrl = normalizeUrl(url);

  const res = await fetch(cleanUrl, {
    headers: {
      Accept: "application/vnd.speedscope+json",
      Authorization: `Bearer ${token.accessToken}`,
    },
    // Avoid caching profiling data
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Authentication expired. Please sign in again.");
    }
    if (res.status === 404) {
      throw new Error("Page not profilable. Make sure you have access to this store.");
    }
    throw new Error(`Failed to fetch profiling data: ${res.status} ${res.statusText}`);
  }

  const data: SpeedscopeFile = await res.json();
  return parseSpeedscopeProfile(data, cleanUrl);
};

/**
 * Normalize a URL for profiling requests.
 * Strips fragments, preserves query params.
 */
const normalizeUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
};
