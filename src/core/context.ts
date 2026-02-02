import {
  PREVIEW_ATTR_VALUE_MAX_LENGTH,
  PREVIEW_MAX_ATTRS,
  PREVIEW_PRIORITY_ATTRS,
} from "../constants.js";
import {
  getSourceForElement,
  getBestSourceForElement,
  getRenderTimeForElement,
  hasProfile as profilerHasProfile,
} from "./profiler/index.js";

// Shopify editor data attributes
const SECTION_ATTR = "data-shopify-editor-section";
const BLOCK_ATTR = "data-shopify-editor-block";
const SECTION_ID_ATTR = "data-section-id";
const SECTION_TYPE_ATTR = "data-section-type";

// Attributes that are noise in context output
const SKIP_ATTRS = new Set([
  SECTION_ATTR,
  BLOCK_ATTR,
  "data-shopify-editor-section",
  "data-shopify-editor-block",
]);

interface ShopifyEditorSectionData {
  type?: string;
  id?: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
  blocks?: Record<
    string,
    { type?: string; settings?: Record<string, unknown> }
  >;
  block_order?: string[];
}

interface ShopifyEditorBlockData {
  type?: string;
  id?: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
}

interface ShopifyContext {
  sectionType: string | null;
  sectionId: string | null;
  blockType: string | null;
  blockId: string | null;
  sectionFile: string | null;
  blockFile: string | null;
  snippetName: string | null;
}

const parseEditorAttribute = <T>(element: Element, attr: string): T | null => {
  const raw = element.getAttribute(attr);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Strip Shopify's random hash suffixes from section type names.
 * "full_screen_section_Gh8Vpf" -> "full_screen_section"
 * "header" -> "header"
 * "featured-collection" -> "featured-collection"
 *
 * Shopify appends _[A-Za-z0-9]{6} when sections are created via the editor.
 */
const stripSectionHash = (type: string): string =>
  type.replace(/_[A-Za-z0-9]{5,8}$/, "");

const inferSectionTypeFromId = (sectionId: string): string | null => {
  // Shopify section IDs follow patterns like:
  // "template--12345__header" -> type is "header"
  // "header" -> type is "header"
  // "shopify-section-template--12345__featured-collection" -> type is "featured-collection"
  const cleaned = sectionId.replace(/^shopify-section-/, "");
  const match = cleaned.match(/__(.+?)(?:-\d+)?$/);
  if (match) return stripSectionHash(match[1]);

  // If no __ pattern, the id itself might be the type
  if (!cleaned.includes("--")) return stripSectionHash(cleaned);
  return null;
};

const findNearestSection = (element: Element): Element | null => {
  let current: Element | null = element;
  while (current) {
    if (
      current.hasAttribute(SECTION_ATTR) ||
      current.hasAttribute(SECTION_ID_ATTR) ||
      current.classList?.contains("shopify-section")
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const findNearestBlock = (element: Element): Element | null => {
  let current: Element | null = element;
  while (current) {
    if (
      current.hasAttribute(BLOCK_ATTR) ||
      current.classList?.contains("shopify-block") ||
      current.id?.startsWith("shopify-block-")
    ) {
      return current;
    }
    if (
      current.hasAttribute(SECTION_ATTR) ||
      current.hasAttribute(SECTION_ID_ATTR) ||
      current.classList?.contains("shopify-section")
    ) {
      break;
    }
    current = current.parentElement;
  }
  return null;
};

const getShopifyContext = (element: Element): ShopifyContext => {
  const ctx: ShopifyContext = {
    sectionType: null,
    sectionId: null,
    blockType: null,
    blockId: null,
    sectionFile: null,
    blockFile: null,
    snippetName: null,
  };

  const blockEl = findNearestBlock(element);
  if (blockEl) {
    const blockData = parseEditorAttribute<ShopifyEditorBlockData>(
      blockEl,
      BLOCK_ATTR,
    );
    if (blockData) {
      ctx.blockType = blockData.type ? stripSectionHash(blockData.type) : null;
      ctx.blockId = blockData.id ?? null;
    }
    if (!ctx.blockId && blockEl.id?.startsWith("shopify-block-")) {
      ctx.blockId = blockEl.id.replace("shopify-block-", "");
    }
  }

  const sectionEl = findNearestSection(element);
  if (sectionEl) {
    const sectionData = parseEditorAttribute<ShopifyEditorSectionData>(
      sectionEl,
      SECTION_ATTR,
    );
    if (sectionData) {
      ctx.sectionType = sectionData.type
        ? stripSectionHash(sectionData.type)
        : null;
      ctx.sectionId = sectionData.id ?? null;
    }

    if (!ctx.sectionId) {
      ctx.sectionId = sectionEl.getAttribute(SECTION_ID_ATTR);
    }
    if (!ctx.sectionType) {
      ctx.sectionType = sectionEl.getAttribute(SECTION_TYPE_ATTR);
    }

    if (!ctx.sectionType && sectionEl.id) {
      const cleanId = sectionEl.id.replace(/^shopify-section-/, "");
      ctx.sectionType = inferSectionTypeFromId(cleanId);
    }
    if (!ctx.sectionType && ctx.sectionId) {
      ctx.sectionType = inferSectionTypeFromId(ctx.sectionId);
    }

    if (ctx.sectionType) {
      ctx.sectionFile = `sections/${ctx.sectionType}.liquid`;
    }
  }

  const snippetEl = findNearestSnippet(element);
  if (snippetEl) {
    ctx.snippetName = snippetEl;
  }

  return ctx;
};

const findNearestSnippet = (element: Element): string | null => {
  let current: Element | null = element;
  while (current) {
    const snippet = current.getAttribute("data-snippet");
    if (snippet) return snippet;

    const shopifyType = current.getAttribute("data-shopify-type");
    if (shopifyType === "snippet") {
      return current.getAttribute("data-shopify-name") ?? null;
    }

    if (
      current.hasAttribute(SECTION_ATTR) ||
      current.classList?.contains("shopify-section")
    ) {
      break;
    }
    current = current.parentElement;
  }
  return null;
};

export const getComponentDisplayName = (element: Element): string | null => {
  if (profilerHasProfile()) {
    const best = getBestSourceForElement(element);
    if (best) {
      const name = extractComponentName(best.file);
      if (name) return name;
    }
  }

  const ctx = getShopifyContext(element);

  if (ctx.blockType && ctx.sectionType) {
    return `${ctx.sectionType}/${ctx.blockType}`;
  }
  if (ctx.sectionType) {
    return ctx.sectionType;
  }
  if (ctx.snippetName) {
    return ctx.snippetName;
  }
  return null;
};

export const getNearestComponentName = async (
  element: Element,
): Promise<string | null> => {
  return getComponentDisplayName(element);
};

interface ShopifyStackFrame {
  functionName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  isServer: boolean;
}

export const getStack = async (
  element: Element,
): Promise<ShopifyStackFrame[]> => {
  if (profilerHasProfile()) {
    const sources = getSourceForElement(element);
    if (sources && sources.length > 0) {
      return sources.map((loc) => ({
        functionName: extractComponentName(loc.file),
        fileName: loc.file,
        lineNumber: loc.line,
        columnNumber: loc.col,
        isServer: true,
      }));
    }
  }
  return [];
};

/**
 * Extract a human-readable component name from a Liquid file path.
 * "sections/header.liquid" -> "header"
 * "snippets/product-card.liquid" -> "product-card"
 */
const extractComponentName = (file: string): string | null => {
  const match = file.match(
    /(?:sections|snippets|layout|templates|blocks)\/([^/.]+)/,
  );
  return match ? match[1] : null;
};

export const checkIsSourceComponentName = (name: string): boolean => {
  return name.length > 0;
};

interface GetElementContextOptions {
  maxLines?: number;
}

export const getElementContext = async (
  element: Element,
  options: GetElementContextOptions = {},
): Promise<string> => {
  const { maxLines = 3 } = options;
  const html = getHTMLPreview(element);

  // If profiler data is available, use it for rich source context
  if (profilerHasProfile()) {
    const sources = getSourceForElement(element);
    if (sources && sources.length > 0) {
      const contextLines: string[] = [];

      for (const loc of sources.slice(0, maxLines)) {
        const name = extractComponentName(loc.file);
        const lineRef = loc.line
          ? `:${loc.line}${loc.col ? `:${loc.col}` : ""}`
          : "";
        const timeRef =
          loc.renderTimeMs > 0
            ? ` (${loc.renderTimeMs.toFixed(1)}ms)`
            : "";

        if (name) {
          contextLines.push(
            `in ${name} at ${loc.file}${lineRef}${timeRef}`,
          );
        } else {
          contextLines.push(`at ${loc.file}${lineRef}${timeRef}`);
        }
      }

      const renderTime = getRenderTimeForElement(element);
      if (renderTime !== null && renderTime > 0) {
        contextLines.push(`render: ${renderTime.toFixed(1)}ms`);
      }

      return `${html}\n${contextLines.join("\n")}`;
    }
  }

  // Fallback: DOM-based detection
  const ctx = getShopifyContext(element);
  const contextLines: string[] = [];

  if (ctx.sectionType) {
    contextLines.push(`in ${ctx.sectionType} at ${ctx.sectionFile}`);
  }

  if (ctx.blockType) {
    contextLines.push(`in block "${ctx.blockType}"`);
  }

  if (ctx.snippetName) {
    contextLines.push(
      `in ${ctx.snippetName} at snippets/${ctx.snippetName}.liquid`,
    );
  }

  if (contextLines.length > 0) {
    return `${html}\n${contextLines.slice(0, maxLines).join("\n")}`;
  }

  return html;
};

const truncateAttrValue = (value: string): string =>
  value.length > PREVIEW_ATTR_VALUE_MAX_LENGTH
    ? `${value.slice(0, PREVIEW_ATTR_VALUE_MAX_LENGTH)}...`
    : value;

interface FormatPriorityAttrsOptions {
  truncate?: boolean;
  maxAttrs?: number;
}

const formatPriorityAttrs = (
  element: Element,
  options: FormatPriorityAttrsOptions = {},
): string => {
  const { truncate = true, maxAttrs = PREVIEW_MAX_ATTRS } = options;
  const priorityAttrs: string[] = [];

  for (const name of PREVIEW_PRIORITY_ATTRS) {
    if (priorityAttrs.length >= maxAttrs) break;
    const value = element.getAttribute(name);
    if (value) {
      const formattedValue = truncate ? truncateAttrValue(value) : value;
      priorityAttrs.push(`${name}="${formattedValue}"`);
    }
  }

  return priorityAttrs.length > 0 ? ` ${priorityAttrs.join(" ")}` : "";
};

/**
 * Get only the direct (shallow) text content of an element,
 * ignoring text from child elements. This avoids dumping all
 * descendant marketing copy for container elements.
 */
const getShallowText = (element: Element): string => {
  const parts: string[] = [];
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(" ");
};

/**
 * Get meaningful text for an element. Prefers shallow text for containers
 * (elements with child elements). Falls back to innerText for leaf elements.
 * Caps output at maxLen characters.
 */
const getElementText = (element: Element, maxLen = 80): string => {
  if (!(element instanceof HTMLElement)) return "";

  // For elements with children, only get direct text to avoid noise
  const hasChildElements = element.querySelector(":scope > *") !== null;
  const raw = hasChildElements
    ? getShallowText(element)
    : (element.innerText?.trim() ?? "");

  if (!raw) return "";
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}...` : raw;
};

/**
 * Format key attributes for an element. Keeps class names intact,
 * skips Shopify editor JSON blobs, and respects the priority list.
 */
const formatAttrs = (element: Element): string => {
  const parts: string[] = [];

  // Always include class if present (full value, no truncation for classes)
  const cls = element.getAttribute("class");
  if (cls) {
    const trimmed = cls.trim().replace(/\s+/g, " ");
    parts.push(`class="${trimmed}"`);
  }

  // Add other priority attrs
  for (const name of PREVIEW_PRIORITY_ATTRS) {
    if (name === "class") continue;
    if (parts.length >= PREVIEW_MAX_ATTRS + 1) break;
    const value = element.getAttribute(name);
    if (value) {
      parts.push(`${name}="${truncateAttrValue(value)}"`);
    }
  }

  // Include href for links (very useful for agents)
  if (
    !parts.some((p) => p.startsWith("href=")) &&
    element.hasAttribute("href")
  ) {
    const href = element.getAttribute("href") ?? "";
    parts.push(`href="${truncateAttrValue(href)}"`);
  }

  // Include src for images/scripts
  if (
    !parts.some((p) => p.startsWith("src=")) &&
    element.hasAttribute("src")
  ) {
    const src = element.getAttribute("src") ?? "";
    parts.push(`src="${truncateAttrValue(src)}"`);
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

/**
 * Generate a clean HTML preview that is useful for coding agents.
 *
 * Goals:
 * - Full class names (never truncated - agents need these for selectors)
 * - Shallow text only (no deep innerText dumps for containers)
 * - Skip Shopify editor JSON attributes
 * - Compact single-element output matching react-grab style
 */
const getHTMLPreview = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();

  if (!(element instanceof HTMLElement)) {
    const attrsHint = formatPriorityAttrs(element, {
      truncate: false,
      maxAttrs: PREVIEW_PRIORITY_ATTRS.length,
    });
    return `<${tagName}${attrsHint} />`;
  }

  const attrs = formatAttrs(element);
  const text = getElementText(element);

  if (text) {
    return `<${tagName}${attrs}>\n  ${text}\n</${tagName}>`;
  }

  // For empty/container elements, show a self-closing tag
  return `<${tagName}${attrs} />`;
};
