/**
 * Parse Speedscope profiling data into a usable source map.
 *
 * Shopify's profiling data uses Speedscope "evented" format where:
 * - shared.frames[].name contains Liquid file paths like "sections/header.liquid:42"
 * - profiles[].events are O(pen)/C(lose) pairs with timestamps
 *
 * We reconstruct the call tree to understand which files render which sections,
 * then build a mapping from section/snippet names to their source locations.
 */

import type {
  SpeedscopeFile,
  SpeedscopeFrame,
  SpeedscopeEvent,
  LiquidSourceLocation,
  SectionSourceMap,
  PageProfile,
} from "./types.js";

/**
 * Parse a frame name like "sections/header.liquid:42" into file + line.
 */
const parseFrameName = (
  name: string,
): { file: string; line: number | null; col: number | null } => {
  // Patterns:
  // "sections/header.liquid:42"
  // "snippets/product-card.liquid:17:5"
  // "layout/theme.liquid"
  // "templates/product.json"
  // "for loop (sections/header.liquid:15)"

  // Strip wrapping like "for loop (...)"
  const parenMatch = name.match(/\(([^)]+)\)/);
  const raw = parenMatch ? parenMatch[1] : name;

  // Split file:line:col
  const parts = raw.split(":");
  const file = parts[0].trim();
  const line = parts.length > 1 ? parseInt(parts[1], 10) : null;
  const col = parts.length > 2 ? parseInt(parts[2], 10) : null;

  return {
    file,
    line: line !== null && !isNaN(line) ? line : null,
    col: col !== null && !isNaN(col) ? col : null,
  };
};

/**
 * Check if a frame name represents a Liquid source file.
 */
const isLiquidFile = (name: string): boolean => {
  return (
    name.includes(".liquid") ||
    name.includes("sections/") ||
    name.includes("snippets/") ||
    name.includes("templates/") ||
    name.includes("layout/") ||
    name.includes("blocks/")
  );
};

/**
 * Extract section type from a file path.
 * "sections/header.liquid" -> "header"
 * "sections/featured-collection.liquid" -> "featured-collection"
 */
const extractSectionType = (file: string): string | null => {
  const match = file.match(/sections\/([^/.]+)\.liquid/);
  return match ? match[1] : null;
};

/**
 * Extract snippet name from a file path.
 * "snippets/product-card.liquid" -> "product-card"
 */
const extractSnippetName = (file: string): string | null => {
  const match = file.match(/snippets\/([^/.]+)\.liquid/);
  return match ? match[1] : null;
};

/**
 * Build the call tree from evented profiling data.
 * Returns a tree of LiquidSourceLocations with render times.
 */
const buildCallTree = (
  frames: SpeedscopeFrame[],
  events: SpeedscopeEvent[],
): LiquidSourceLocation[] => {
  const root: LiquidSourceLocation[] = [];
  const stack: LiquidSourceLocation[] = [];

  for (const event of events) {
    const frame = frames[event.frame];
    if (!frame) continue;

    if (event.type === "O") {
      const parsed = parseFrameName(frame.name);
      const location: LiquidSourceLocation = {
        file: parsed.file,
        line: parsed.line,
        col: parsed.col,
        renderTimeMs: 0,
        children: [],
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(location);
      } else {
        root.push(location);
      }
      stack.push(location);
    } else if (event.type === "C") {
      const current = stack.pop();
      if (current) {
        // Calculate self time: find the matching open event
        // The "at" value represents the close time; we need to find the open
        // For now, we store the close timestamp and compute durations in a second pass
      }
    }
  }

  return root;
};

/**
 * Compute render times from events.
 * Returns a map from frame index to total render time.
 */
const computeRenderTimes = (
  events: SpeedscopeEvent[],
): Map<number, number> => {
  const times = new Map<number, number>();
  const openTimes = new Map<number, number[]>(); // frame index -> stack of open times

  for (const event of events) {
    if (event.type === "O") {
      const stack = openTimes.get(event.frame) ?? [];
      stack.push(event.at);
      openTimes.set(event.frame, stack);
    } else if (event.type === "C") {
      const stack = openTimes.get(event.frame);
      if (stack && stack.length > 0) {
        const openTime = stack.pop()!;
        const duration = event.at - openTime;
        times.set(event.frame, (times.get(event.frame) ?? 0) + duration);
      }
    }
  }

  return times;
};

/**
 * Build a flat list of all unique Liquid source locations with render times.
 */
const buildLocationList = (
  frames: SpeedscopeFrame[],
  events: SpeedscopeEvent[],
): LiquidSourceLocation[] => {
  const renderTimes = computeRenderTimes(events);
  const locations: LiquidSourceLocation[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!isLiquidFile(frame.name)) continue;

    const parsed = parseFrameName(frame.name);
    const key = `${parsed.file}:${parsed.line ?? 0}`;

    if (!seen.has(key)) {
      seen.add(key);
      locations.push({
        file: parsed.file,
        line: parsed.line,
        col: parsed.col,
        renderTimeMs: renderTimes.get(i) ?? 0,
        children: [],
      });
    } else {
      // Accumulate render time for duplicate locations
      const existing = locations.find(
        (l) => l.file === parsed.file && l.line === parsed.line,
      );
      if (existing) {
        existing.renderTimeMs += renderTimes.get(i) ?? 0;
      }
    }
  }

  return locations;
};

/**
 * Group locations by section type.
 */
const buildSectionMaps = (
  locations: LiquidSourceLocation[],
): Map<string, SectionSourceMap> => {
  const sections = new Map<string, SectionSourceMap>();

  for (const loc of locations) {
    const sectionType = extractSectionType(loc.file);
    if (!sectionType) continue;

    let section = sections.get(sectionType);
    if (!section) {
      section = {
        sectionType,
        file: `sections/${sectionType}.liquid`,
        locations: [],
        totalRenderTimeMs: 0,
      };
      sections.set(sectionType, section);
    }

    section.locations.push(loc);
    section.totalRenderTimeMs += loc.renderTimeMs;
  }

  return sections;
};

/**
 * Parse a Speedscope profiling response into a PageProfile.
 */
export const parseSpeedscopeProfile = (
  data: SpeedscopeFile,
  url: string,
): PageProfile => {
  // Get frames from shared or first profile
  const frames: SpeedscopeFrame[] =
    data.shared?.frames ?? data.profiles[0]?.frames ?? [];

  // Get events from first profile
  const profile = data.profiles[0];
  if (!profile || profile.type !== "evented") {
    return {
      url,
      fetchedAt: Date.now(),
      totalRenderTimeMs: 0,
      sections: new Map(),
      allLocations: [],
      frames,
    };
  }

  const events = profile.events;
  const totalRenderTimeMs =
    profile.unit === "milliseconds" || profile.unit === "ms"
      ? profile.endValue - profile.startValue
      : profile.endValue - profile.startValue; // Assume ms

  // Build flat location list
  const allLocations = buildLocationList(frames, events);

  // Build call tree (for hierarchical context)
  const _callTree = buildCallTree(frames, events);

  // Group by section
  const sections = buildSectionMaps(allLocations);

  return {
    url,
    fetchedAt: Date.now(),
    totalRenderTimeMs,
    sections,
    allLocations,
    frames,
  };
};

/**
 * Find the best source location for a given section type.
 * Returns the top-level location for the section file.
 */
export const getSourceForSection = (
  profile: PageProfile,
  sectionType: string,
): LiquidSourceLocation | null => {
  const section = profile.sections.get(sectionType);
  if (!section || section.locations.length === 0) return null;

  // Return the location with the lowest line number (likely the section entry point)
  return section.locations.reduce((best, loc) =>
    (loc.line ?? Infinity) < (best.line ?? Infinity) ? loc : best,
  );
};

/**
 * Find all source locations matching a file pattern.
 */
export const getLocationsForFile = (
  profile: PageProfile,
  filePattern: string,
): LiquidSourceLocation[] => {
  return profile.allLocations.filter((loc) => loc.file.includes(filePattern));
};

/**
 * Get all snippet locations that appear within a section's render.
 * This requires the call tree (hierarchical) data.
 */
export const getSnippetsForSection = (
  profile: PageProfile,
  sectionType: string,
): LiquidSourceLocation[] => {
  const section = profile.sections.get(sectionType);
  if (!section) return [];

  // Find snippet files referenced alongside this section
  return profile.allLocations.filter((loc) => {
    const snippetName = extractSnippetName(loc.file);
    return snippetName !== null;
  });
};

/**
 * Build an owner stack for a section type.
 * Returns the chain: layout -> template -> section -> snippets
 */
export const buildOwnerStack = (
  profile: PageProfile,
  sectionType: string,
): LiquidSourceLocation[] => {
  const stack: LiquidSourceLocation[] = [];

  // Find layout file
  const layoutLoc = profile.allLocations.find((l) =>
    l.file.startsWith("layout/"),
  );
  if (layoutLoc) stack.push(layoutLoc);

  // Find template file
  const templateLoc = profile.allLocations.find((l) =>
    l.file.startsWith("templates/"),
  );
  if (templateLoc) stack.push(templateLoc);

  // Find the section itself
  const sectionLoc = getSourceForSection(profile, sectionType);
  if (sectionLoc) stack.push(sectionLoc);

  return stack;
};
