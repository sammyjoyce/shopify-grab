/**
 * Shopify Identity OAuth2 PKCE flow for profiling access.
 *
 * Uses the same Shopify Identity endpoints as the Theme Inspector extension,
 * but runs entirely in-browser via a popup window instead of Chrome extension APIs.
 *
 * Flow:
 * 1. Open popup to accounts.shopify.com authorization endpoint with PKCE
 * 2. User logs in with Shopify account (partner/staff)
 * 3. Popup redirects back with auth code
 * 4. Exchange auth code for client access token
 * 5. Exchange client token for storefront-renderer subject token
 * 6. Use subject token to fetch profiling data
 */

import type { ProfilerToken } from "./types.js";

// Shopify Identity configuration (same as Theme Inspector)
const IDENTITY_DOMAIN = "accounts.shopify.com";
const OPENID_CONFIG_PATH = ".well-known/openid-configuration.json";

// Theme Inspector's OAuth client ID (public, used by the Chrome extension)
const CLIENT_ID = "ff2a91a2-6854-449e-a37d-c03bcd181126";

// Storefront Renderer subject ID for token exchange
const SUBJECT_ID = "ee139b3d-5861-4d45-b387-1bc3ada7811c";

// Scopes needed for profiling
const COLLABORATORS_SCOPE =
  "https://api.shopify.com/auth/partners.collaborator-relationships.readonly";
const DEVTOOLS_SCOPE =
  "https://api.shopify.com/auth/shop.storefront-renderer.devtools";
const AUTH_SCOPE = `openid profile ${DEVTOOLS_SCOPE} ${COLLABORATORS_SCOPE}`;

// Token expiration buffer (1 minute)
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

interface OpenIdConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  introspection_endpoint: string;
  issuer: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  issued_token_type?: string;
  refresh_token?: string;
  id_token?: string;
}

let cachedConfig: OpenIdConfig | null = null;
let cachedClientToken: { accessToken: string; expiresAt: number; refreshToken?: string } | null = null;
let cachedSubjectToken: ProfilerToken | null = null;

const getOpenIdConfig = async (): Promise<OpenIdConfig> => {
  if (cachedConfig) return cachedConfig;
  const url = `https://${IDENTITY_DOMAIN}/${OPENID_CONFIG_PATH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch OpenID config: ${res.status}`);
  cachedConfig = await res.json();
  return cachedConfig!;
};

// Generate PKCE challenge pair
const generatePKCE = async (): Promise<{ verifier: string; challenge: string }> => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64URLEncode(array);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64URLEncode(new Uint8Array(hashBuffer));
  return { verifier, challenge };
};

const base64URLEncode = (buffer: Uint8Array): string => {
  let str = "";
  for (const byte of buffer) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/[=]/g, "");
};

// Storage helpers (localStorage-based, no Chrome extension APIs needed)
const STORAGE_KEY_CLIENT = "shopify-grab:client-token";
const STORAGE_KEY_SUBJECT = "shopify-grab:subject-token";

const saveToken = (key: string, data: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage unavailable
  }
};

const loadToken = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const clearTokens = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY_CLIENT);
    localStorage.removeItem(STORAGE_KEY_SUBJECT);
  } catch {
    // Storage unavailable
  }
  cachedClientToken = null;
  cachedSubjectToken = null;
};

/**
 * Check if we have a valid (non-expired) subject token.
 */
export const hasValidToken = (): boolean => {
  const token = getSubjectTokenFromCache();
  return token !== null && token.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS;
};

/**
 * Get cached subject token if valid.
 */
export const getSubjectTokenFromCache = (): ProfilerToken | null => {
  if (cachedSubjectToken && cachedSubjectToken.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cachedSubjectToken;
  }
  const stored = loadToken<ProfilerToken>(STORAGE_KEY_SUBJECT);
  if (stored && stored.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    cachedSubjectToken = stored;
    return stored;
  }
  return null;
};

/**
 * Full authentication flow. Opens a popup for Shopify login,
 * then exchanges tokens for storefront-renderer access.
 *
 * Returns a ProfilerToken with the subject access token.
 */
export const authenticate = async (): Promise<ProfilerToken> => {
  // Check cached token first
  const existing = getSubjectTokenFromCache();
  if (existing) return existing;

  const config = await getOpenIdConfig();

  // Step 1: Get client access token via PKCE popup flow
  const clientToken = await getClientToken(config);

  // Step 2: Exchange client token for storefront-renderer subject token
  const subjectToken = await exchangeForSubjectToken(config, clientToken.accessToken);

  return subjectToken;
};

/**
 * Get client access token, either from cache/refresh or via popup auth.
 */
const getClientToken = async (
  config: OpenIdConfig,
): Promise<{ accessToken: string; expiresAt: number; refreshToken?: string }> => {
  // Try cached
  if (cachedClientToken && cachedClientToken.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cachedClientToken;
  }

  // Try stored
  const stored = loadToken<typeof cachedClientToken>(STORAGE_KEY_CLIENT);
  if (stored && stored.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    cachedClientToken = stored;
    return stored;
  }

  // Try refresh
  if (stored?.refreshToken) {
    try {
      const refreshed = await refreshClientToken(config, stored.refreshToken);
      return refreshed;
    } catch {
      // Refresh failed, do full auth
    }
  }

  // Full popup auth flow
  const { verifier, challenge } = await generatePKCE();
  const code = await launchPopupAuth(config, challenge);
  const tokenResponse = await exchangeCodeForToken(config, code, verifier);

  const now = Date.now();
  const token = {
    accessToken: tokenResponse.access_token,
    expiresAt: now + tokenResponse.expires_in * 1000,
    refreshToken: tokenResponse.refresh_token,
  };

  cachedClientToken = token;
  saveToken(STORAGE_KEY_CLIENT, token);
  return token;
};

/**
 * Open a popup window to Shopify's authorization endpoint.
 * Returns the authorization code from the redirect.
 */
const launchPopupAuth = (config: OpenIdConfig, codeChallenge: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Use a special redirect URI that posts back to us
    // We'll use a page on the same origin that extracts the code
    const redirectUri = `${window.location.origin}/__shopify-grab-auth-callback`;

    const params = new URLSearchParams([
      ["redirect_uri", redirectUri],
      ["client_id", CLIENT_ID],
      ["code_challenge", codeChallenge],
      ["code_challenge_method", "S256"],
      ["response_type", "code"],
      ["scope", AUTH_SCOPE],
    ]);

    const authUrl = `${config.authorization_endpoint}?${params.toString()}`;

    const width = 500;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "shopify-grab-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );

    if (!popup) {
      reject(new Error("Failed to open auth popup. Check popup blocker settings."));
      return;
    }

    // Poll for redirect
    const pollInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollInterval);
          reject(new Error("Auth popup was closed"));
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl.startsWith(redirectUri)) {
          clearInterval(pollInterval);
          const url = new URL(popupUrl);
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");

          popup.close();

          if (error) {
            reject(new Error(url.searchParams.get("error_description") || error));
          } else if (code) {
            resolve(code);
          } else {
            reject(new Error("No authorization code in redirect"));
          }
        }
      } catch {
        // Cross-origin - popup hasn't redirected yet, keep polling
      }
    }, 200);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      try { popup.close(); } catch {}
      reject(new Error("Auth timed out"));
    }, 5 * 60 * 1000);
  });
};

/**
 * Exchange authorization code for client access token.
 */
const exchangeCodeForToken = async (
  config: OpenIdConfig,
  code: string,
  verifier: string,
): Promise<TokenResponse> => {
  const redirectUri = `${window.location.origin}/__shopify-grab-auth-callback`;

  const params = new URLSearchParams([
    ["redirect_uri", redirectUri],
    ["grant_type", "authorization_code"],
    ["code_verifier", verifier],
    ["client_id", CLIENT_ID],
    ["code", code],
  ]);

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
};

/**
 * Refresh a client access token.
 */
const refreshClientToken = async (
  config: OpenIdConfig,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number; refreshToken?: string }> => {
  const params = new URLSearchParams([
    ["grant_type", "refresh_token"],
    ["refresh_token", refreshToken],
    ["client_id", CLIENT_ID],
  ]);

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const body: TokenResponse = await res.json();
  const now = Date.now();
  const token = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
    refreshToken: body.refresh_token,
  };

  cachedClientToken = token;
  saveToken(STORAGE_KEY_CLIENT, token);
  return token;
};

/**
 * Exchange client token for a storefront-renderer subject token.
 */
const exchangeForSubjectToken = async (
  config: OpenIdConfig,
  clientAccessToken: string,
): Promise<ProfilerToken> => {
  const params = new URLSearchParams([
    ["grant_type", "urn:ietf:params:oauth:grant-type:token-exchange"],
    ["client_id", CLIENT_ID],
    ["audience", SUBJECT_ID],
    ["subject_token", clientAccessToken],
    ["subject_token_type", "urn:ietf:params:oauth:token-type:access_token"],
    ["scope", `${DEVTOOLS_SCOPE} ${COLLABORATORS_SCOPE}`],
  ]);

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Subject token exchange failed: ${res.status} ${text}`);
  }

  const body: TokenResponse = await res.json();
  const now = Date.now();
  const token: ProfilerToken = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  cachedSubjectToken = token;
  saveToken(STORAGE_KEY_SUBJECT, token);
  return token;
};

/**
 * Sign out and clear all cached tokens.
 */
export const signOut = (): void => {
  clearTokens();
};
