import {
  PREVIEW_ATTR_VALUE_MAX_LENGTH,
  PREVIEW_MAX_ATTRS,
  PREVIEW_PRIORITY_ATTRS,
} from "../constants.js";

// Shopify editor data attributes
const SECTION_ATTR = "data-shopify-editor-section";
const BLOCK_ATTR = "data-shopify-editor-block";
const SECTION_ID_ATTR = "data-section-id";
const SECTION_TYPE_ATTR = "data-section-type";

interface ShopifyEditorSectionData {
  type?: string;
  id?: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
  blocks?: Record<string, { type?: string; settings?: Record<string, unknown> }>;
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

const inferSectionTypeFromId = (sectionId: string): string | null => {
  // Shopify section IDs follow patterns like:
  // "template--12345__header" -> type is "header"
  // "header" -> type is "header"
  // "shopify-section-template--12345__featured-collection" -> type is "featured-collection"
  const cleaned = sectionId.replace(/^shopify-section-/, "");
  const match = cleaned.match(/__(.+?)(?:-\d+)?$/);
  if (match) return match[1];

  // If no __ pattern, the id itself might be the type
  if (!cleaned.includes("--")) return cleaned;
  return null;
};

const findNearestSection = (element: Element): Element | null => {
  // Walk up looking for section markers
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
    // Stop at section boundary
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

  // Find nearest block
  const blockEl = findNearestBlock(element);
  if (blockEl) {
    const blockData = parseEditorAttribute<ShopifyEditorBlockData>(blockEl, BLOCK_ATTR);
    if (blockData) {
      ctx.blockType = blockData.type ?? null;
      ctx.blockId = blockData.id ?? null;
    }
    // Also check the id attribute
    if (!ctx.blockId && blockEl.id?.startsWith("shopify-block-")) {
      ctx.blockId = blockEl.id.replace("shopify-block-", "");
    }
  }

  // Find nearest section
  const sectionEl = findNearestSection(element);
  if (sectionEl) {
    const sectionData = parseEditorAttribute<ShopifyEditorSectionData>(sectionEl, SECTION_ATTR);
    if (sectionData) {
      ctx.sectionType = sectionData.type ?? null;
      ctx.sectionId = sectionData.id ?? null;
    }

    // Fallback: check data-section-id and data-section-type
    if (!ctx.sectionId) {
      ctx.sectionId = sectionEl.getAttribute(SECTION_ID_ATTR);
    }
    if (!ctx.sectionType) {
      ctx.sectionType = sectionEl.getAttribute(SECTION_TYPE_ATTR);
    }

    // Fallback: infer type from section element's id
    if (!ctx.sectionType && sectionEl.id) {
      const cleanId = sectionEl.id.replace(/^shopify-section-/, "");
      ctx.sectionType = inferSectionTypeFromId(cleanId);
    }
    if (!ctx.sectionType && ctx.sectionId) {
      ctx.sectionType = inferSectionTypeFromId(ctx.sectionId);
    }

    // Derive file paths
    if (ctx.sectionType) {
      ctx.sectionFile = `sections/${ctx.sectionType}.liquid`;
    }
  }

  // Check for snippet patterns (common data attributes)
  const snippetEl = findNearestSnippet(element);
  if (snippetEl) {
    ctx.snippetName = snippetEl;
  }

  return ctx;
};

const findNearestSnippet = (element: Element): string | null => {
  // Some themes mark snippets with data-snippet or similar conventions
  let current: Element | null = element;
  while (current) {
    const snippet = current.getAttribute("data-snippet");
    if (snippet) return snippet;

    // Check for data-shopify-type="snippet" pattern
    const shopifyType = current.getAttribute("data-shopify-type");
    if (shopifyType === "snippet") {
      return current.getAttribute("data-shopify-name") ?? null;
    }

    // Stop at section boundary
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

// StackFrame-like interface for compatibility
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
  // No fiber stack for Shopify. Return empty for interface compat.
  return [];
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
  const ctx = getShopifyContext(element);
  const html = getHTMLPreview(element);

  const contextLines: string[] = [];

  if (ctx.sectionFile) {
    contextLines.push(`\n  in section "${ctx.sectionType}" (${ctx.sectionFile})`);
  }

  if (ctx.blockType) {
    const blockRef = ctx.blockId ? ` [${ctx.blockId}]` : "";
    contextLines.push(`\n  in block "${ctx.blockType}"${blockRef}`);
  }

  if (ctx.snippetName) {
    contextLines.push(`\n  in snippet "${ctx.snippetName}" (snippets/${ctx.snippetName}.liquid)`);
  }

  if (ctx.sectionId && !ctx.sectionFile) {
    contextLines.push(`\n  in section [${ctx.sectionId}]`);
  }

  if (contextLines.length > 0) {
    const { maxLines = 3 } = options;
    return `${html}${contextLines.slice(0, maxLines).join("")}`;
  }

  return getFallbackContext(element);
};

const getFallbackContext = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();

  if (!(element instanceof HTMLElement)) {
    const attrsHint = formatPriorityAttrs(element, {
      truncate: false,
      maxAttrs: PREVIEW_PRIORITY_ATTRS.length,
    });
    return `<${tagName}${attrsHint} />`;
  }

  const text = element.innerText?.trim() ?? element.textContent?.trim() ?? "";

  let attrsText = "";
  for (const { name, value } of element.attributes) {
    attrsText += ` ${name}="${value}"`;
  }

  const truncatedText = text.length > 100 ? `${text.slice(0, 100)}...` : text;

  if (truncatedText.length > 0) {
    return `<${tagName}${attrsText}>\n  ${truncatedText}\n</${tagName}>`;
  }
  return `<${tagName}${attrsText} />`;
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

const getHTMLPreview = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  if (!(element instanceof HTMLElement)) {
    const attrsHint = formatPriorityAttrs(element);
    return `<${tagName}${attrsHint} />`;
  }
  const text = element.innerText?.trim() ?? element.textContent?.trim() ?? "";

  let attrsText = "";
  for (const { name, value } of element.attributes) {
    // Skip verbose Shopify editor attributes from preview
    if (name === SECTION_ATTR || name === BLOCK_ATTR) continue;
    attrsText += ` ${name}="${truncateAttrValue(value)}"`;
  }

  const topElements: Array<Element> = [];
  const bottomElements: Array<Element> = [];
  let foundFirstText = false;

  const childNodes = Array.from(element.childNodes);
  for (const node of childNodes) {
    if (node.nodeType === Node.COMMENT_NODE) continue;

    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent && node.textContent.trim().length > 0) {
        foundFirstText = true;
      }
    } else if (node instanceof Element) {
      if (!foundFirstText) {
        topElements.push(node);
      } else {
        bottomElements.push(node);
      }
    }
  }

  const formatElements = (elements: Array<Element>): string => {
    if (elements.length === 0) return "";
    if (elements.length <= 2) {
      return elements
        .map((el) => `<${el.tagName.toLowerCase()} ...>`)
        .join("\n  ");
    }
    return `(${elements.length} elements)`;
  };

  let content = "";
  const topElementsStr = formatElements(topElements);
  if (topElementsStr) content += `\n  ${topElementsStr}`;
  if (text.length > 0) {
    const truncatedText = text.length > 100 ? `${text.slice(0, 100)}...` : text;
    content += `\n  ${truncatedText}`;
  }
  const bottomElementsStr = formatElements(bottomElements);
  if (bottomElementsStr) content += `\n  ${bottomElementsStr}`;

  if (content.length > 0) {
    return `<${tagName}${attrsText}>${content}\n</${tagName}>`;
  }
  return `<${tagName}${attrsText} />`;
};
