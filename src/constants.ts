export const VERSION = process.env.VERSION as string;

export const VIEWPORT_MARGIN_PX = 8;
export const OFFSCREEN_POSITION = -1000;

export const SELECTION_LERP_FACTOR = 0.95;

export const FEEDBACK_DURATION_MS = 1500;
export const FADE_DURATION_MS = 100;
export const FADE_COMPLETE_BUFFER_MS = 150;
export const DISMISS_ANIMATION_BUFFER_MS = 50;
export const KEYDOWN_SPAM_TIMEOUT_MS = 200;
export const BLUR_DEACTIVATION_THRESHOLD_MS = 500;
export const INPUT_FOCUS_ACTIVATION_DELAY_MS = 150;
export const INPUT_TEXT_SELECTION_ACTIVATION_DELAY_MS = 300;
export const DEFAULT_KEY_HOLD_DURATION_MS = 75;
export const MIN_HOLD_FOR_ACTIVATION_AFTER_COPY_MS = 200;
export const RECENT_THRESHOLD_MS = 10_000;

export const DRAG_THRESHOLD_PX = 2;

export const ELEMENT_DETECTION_THROTTLE_MS = 32;
export const COMPONENT_NAME_DEBOUNCE_MS = 100;
export const DRAG_PREVIEW_DEBOUNCE_MS = 32;
export const BOUNDS_CACHE_TTL_MS = 16;
export const BOUNDS_RECALC_INTERVAL_MS = 100;

export const AUTO_SCROLL_EDGE_THRESHOLD_PX = 25;
export const AUTO_SCROLL_SPEED_PX = 10;

export const Z_INDEX_LABEL = 2147483647;
export const Z_INDEX_OVERLAY_CANVAS = 2147483645;

export const CROSSHAIR_LERP_FACTOR = 0.3;
export const DRAG_LERP_FACTOR = 0.7;
export const LERP_CONVERGENCE_THRESHOLD_PX = 0.5;
export const FADE_OUT_BUFFER_MS = 100;
export const MIN_DEVICE_PIXEL_RATIO = 2;

const GRAB_GREEN_RGB = "90, 179, 63";
export const OVERLAY_CROSSHAIR_COLOR = `rgba(${GRAB_GREEN_RGB}, 1)`;
export const OVERLAY_BORDER_COLOR_DRAG = `rgba(${GRAB_GREEN_RGB}, 0.4)`;
export const OVERLAY_FILL_COLOR_DRAG = `rgba(${GRAB_GREEN_RGB}, 0.05)`;
export const OVERLAY_BORDER_COLOR_DEFAULT = `rgba(${GRAB_GREEN_RGB}, 0.5)`;
export const OVERLAY_FILL_COLOR_DEFAULT = `rgba(${GRAB_GREEN_RGB}, 0.08)`;
export const FROZEN_GLOW_COLOR = `rgba(${GRAB_GREEN_RGB}, 0.15)`;
export const FROZEN_GLOW_EDGE_PX = 50;

export const ARROW_HEIGHT_PX = 8;
export const ARROW_CENTER_PERCENT = 50;
export const LABEL_GAP_PX = 4;
export const PREVIEW_ATTR_VALUE_MAX_LENGTH = 15;
export const PREVIEW_MAX_ATTRS = 3;
export const PREVIEW_PRIORITY_ATTRS: readonly string[] = [
  "id",
  "class",
  "aria-label",
  "data-testid",
  "role",
  "name",
  "title",
  "viewBox",
  "fill",
  "stroke",
];

export const SCREENSHOT_CAPTURE_DELAY_MS = 50;

export const VIDEO_METADATA_TIMEOUT_MS = 5000;
export const VIDEO_READY_POLL_INTERVAL_MS = 10;
export const VIDEO_READY_TIMEOUT_MS = 2000;

export const MODIFIER_KEYS: readonly string[] = [
  "Meta",
  "Control",
  "Shift",
  "Alt",
];

export const FROZEN_ELEMENT_ATTRIBUTE = "data-shopify-grab-frozen";
export const IGNORE_EVENTS_ATTRIBUTE = "data-shopify-grab-ignore-events";

export const TOOLTIP_DELAY_MS = 400;
export const TOOLTIP_GRACE_PERIOD_MS = 100;

export const TOOLBAR_SNAP_MARGIN_PX = 16;
export const TOOLBAR_FADE_IN_DELAY_MS = 500;
export const TOOLBAR_SNAP_ANIMATION_DURATION_MS = 300;
export const TOOLBAR_DRAG_THRESHOLD_PX = 5;
export const TOOLBAR_VELOCITY_MULTIPLIER_MS = 150;
export const TOOLBAR_COLLAPSED_WIDTH_PX = 14;
export const TOOLBAR_COLLAPSED_HEIGHT_PX = 14;
export const TOOLBAR_COLLAPSE_ANIMATION_DURATION_MS = 150;
export const TOOLBAR_DEFAULT_WIDTH_PX = 78;
export const TOOLBAR_DEFAULT_HEIGHT_PX = 28;
export const TOOLBAR_SHAKE_TOOLTIP_DURATION_MS = 1500;

export const DRAG_SELECTION_COVERAGE_THRESHOLD = 0.75;
export const DRAG_SELECTION_SAMPLE_SPACING_PX = 32;
export const DRAG_SELECTION_MIN_SAMPLES_PER_AXIS = 3;
export const DRAG_SELECTION_MAX_SAMPLES_PER_AXIS = 20;
export const DRAG_SELECTION_MAX_TOTAL_SAMPLE_POINTS = 100;
export const DRAG_SELECTION_EDGE_INSET_PX = 1;

export const MAX_TRANSFORM_ANCESTOR_DEPTH = 6;
export const TRANSFORM_EARLY_BAIL_DEPTH = 3;

export const ELEMENT_POSITION_CACHE_DISTANCE_THRESHOLD_PX = 2;
export const ELEMENT_POSITION_THROTTLE_MS = 16;

export const MOUNT_ROOT_RECHECK_DELAY_MS = 1000;

export const PANEL_STYLES = "bg-white";

// Shopify shopping bag icon
export const LOGO_SVG = `<svg width="294" height="294" viewBox="0 0 294 294" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="294" height="294" rx="60" fill="#5AB33F"/><path d="M197.5 100.5h-12.2c-1.8-21.5-19.8-38.5-41.8-38.5s-40 17-41.8 38.5H89.5c-5.5 0-10 4.5-10 10v107c0 5.5 4.5 10 10 10h108c5.5 0 10-4.5 10-10v-107c0-5.5-4.5-10-10-10zm-54 -26.5c15.7 0 28.7 11.8 30.6 27h-61.2c1.9-15.2 14.9-27 30.6-27zm0 81c-22 0-40-18-40-40h12c0 15.5 12.5 28 28 28s28-12.5 28-28h12c0 22-18 40-40 40z" fill="white"/></svg>`;

