# Shopify Grab

Select context for coding agents directly from your Shopify theme.

Based on [react-grab](https://github.com/aidenybai/react-grab) by Aiden Bai (MIT licensed), adapted for Shopify Liquid themes instead of React apps.

## How it works

Point at any element on your Shopify store and press **Cmd+C** (Mac) or **Ctrl+C** (Windows/Linux) to copy the element's HTML, section type, block type, and file path context to your clipboard, ready to paste into your coding agent (Cursor, Claude Code, Copilot, etc.).

Example output:

```
<div class="product-card" data-section-id="template--123__featured-collection">
  Product Title
  $29.99
</div>
  in section "featured-collection" (sections/featured-collection.liquid)
  in block "product" [block-abc123]
```

## Install

### Script tag (recommended for Shopify themes)

Add this to your `theme.liquid` layout file inside `<head>`:

```liquid
{% if request.design_mode or settings.enable_dev_tools %}
  <script src="https://unpkg.com/@andsam/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
{% endif %}
```

### Snippet approach

Create a snippet `snippets/shopify-grab.liquid`:

```liquid
{% if request.design_mode %}
  <script src="https://unpkg.com/@andsam/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
{% endif %}
```

Then render it in your layout: `{% render 'shopify-grab' %}`

### Theme App Extension

If you're building a Shopify app, include the script in your theme app extension's block:

```liquid
<script src="https://unpkg.com/@andsam/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
```

## Usage

Once installed, hover over any UI element and press:

- **Cmd+C** on Mac
- **Ctrl+C** on Windows/Linux

This copies the element's context to your clipboard, including:

- **HTML preview** of the element with key attributes
- **Section type** and file path (e.g., `sections/header.liquid`)
- **Block type** if inside a section block
- **Snippet name** if using data-snippet attributes

## What gets detected

Shopify Grab detects theme structure from:

- `data-shopify-editor-section` attributes (JSON with section type, settings, blocks)
- `data-shopify-editor-block` attributes (JSON with block type)
- `data-section-id` and `data-section-type` attributes
- `.shopify-section` class and `#shopify-section-*` IDs
- `.shopify-block` class and `#shopify-block-*` IDs
- `data-snippet` custom attributes (for snippet identification)

These attributes are automatically present in the Shopify Theme Editor and on storefront preview pages.

## Liquid Profiler (Advanced)

Shopify Grab includes a built-in Liquid profiler that taps into the same profiling API used by Shopify's Theme Inspector Chrome extension. When enabled, it provides **file paths, line numbers, and render times** for every Liquid template, giving you bippy-level source introspection for Shopify themes.

### How it works

1. Authenticates with Shopify Identity (same OAuth flow as Theme Inspector)
2. Fetches Speedscope-format profiling data from Shopify's servers
3. Parses the profiling frames to build a source map
4. Maps DOM elements to their Liquid source files via section/block correlation

### Quick start

```javascript
const sg = window.__SHOPIFY_GRAB__;

// Sign in with your Shopify partner/staff account (opens popup)
await sg.profilerSignIn();

// Fetch profiling data for the current page
await sg.profilerProfile();

// Now hover + Cmd/Ctrl+C includes file:line info!
// Example output with profiler enabled:
//
// <div class="product-card">
//   Premium Widget
//   $29.99
// </div>
//   in featured-collection (at sections/featured-collection.liquid:42) (15.2ms)
//   in product-card (at snippets/product-card.liquid:3) (4.1ms)
//   render: 19.3ms
```

### Profiler API

```javascript
const sg = window.__SHOPIFY_GRAB__;

// Authentication
await sg.profilerSignIn();      // Sign in (opens OAuth popup)
sg.profilerSignOut();            // Sign out and clear tokens
sg.profilerIsAuthenticated();    // Check if signed in

// Profiling
const profile = await sg.profilerProfile();  // Fetch profile for current page
sg.profilerHasProfile();                     // Check if profile data loaded
sg.profilerClearCache();                     // Clear cached profiles

// Element source resolution
sg.getSourceForElement(element);       // Full source stack (layout -> template -> section -> snippet)
sg.getBestSourceForElement(element);   // Most specific source location
sg.getRenderTimeForElement(element);   // Section render time in ms

// Status monitoring
sg.profilerGetStatus();  // { state: "idle" | "authenticating" | "authenticated" | "fetching" | "ready" | "error" }
sg.profilerOnStatusChange((status) => console.log(status));
```

### Requirements

- A Shopify partner or staff account with access to the store
- The store must be accessible (live or via `shopify theme dev`)
- Profiling is read-only and does not affect store performance

### Without the profiler

Shopify Grab works without authentication, using DOM-based detection (data attributes, section IDs, class patterns). The profiler just adds richer source context.

## Features

- Same overlay UI as react-grab (crosshair, selection highlight, floating label)
- **Liquid profiler** for file:line source context (like bippy for React)
- Shopify green color scheme
- Canvas-based overlay for smooth 60fps animations
- Shadow DOM isolation (doesn't conflict with theme styles)
- Drag to select multiple elements
- Right-click context menu with Copy, Copy HTML, Copy Screenshot
- Cursor IDE Lexical editor clipboard format support
- Plugin system for customization
- Render time display per section

## API

```javascript
// Access the global API
const api = window.__SHOPIFY_GRAB__;

// Programmatic control
api.activate();
api.deactivate();
api.toggle();
api.isActive();

// Copy an element's context
api.copyElement(document.querySelector('.product-card'));

// Get display name for an element
api.getDisplayName(element); // "featured-collection" or "header/menu"

// Get source info (uses profiler when available)
const source = await api.getSource(element);
// { filePath: "sections/header.liquid", lineNumber: 42, componentName: "header" }
```

## License

MIT. Based on react-grab by Aiden Bai.
