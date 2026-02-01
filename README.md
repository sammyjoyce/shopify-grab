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
  <script src="https://unpkg.com/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
{% endif %}
```

### Snippet approach

Create a snippet `snippets/shopify-grab.liquid`:

```liquid
{% if request.design_mode %}
  <script src="https://unpkg.com/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
{% endif %}
```

Then render it in your layout: `{% render 'shopify-grab' %}`

### Theme App Extension

If you're building a Shopify app, include the script in your theme app extension's block:

```liquid
<script src="https://unpkg.com/shopify-grab/dist/index.global.js" crossorigin="anonymous"></script>
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

## Features

- Same overlay UI as react-grab (crosshair, selection highlight, floating label)
- Shopify green color scheme
- Canvas-based overlay for smooth 60fps animations
- Shadow DOM isolation (doesn't conflict with theme styles)
- Drag to select multiple elements
- Right-click context menu with Copy, Copy HTML, Copy Screenshot
- Cursor IDE Lexical editor clipboard format support
- Plugin system for customization

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
```

## License

MIT. Based on react-grab by Aiden Bai.
