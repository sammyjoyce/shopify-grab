// Speedscope file format types
// https://www.speedscope.app/file-format-schema.json

export interface SpeedscopeFrame {
  name: string;
  file?: string;
  line?: number;
  col?: number;
}

export interface SpeedscopeEvent {
  type: "O" | "C"; // Open or Close
  frame: number; // Index into frames array
  at: number; // Timestamp value
}

export interface SpeedscopeProfile {
  type: "evented" | "sampled";
  name?: string;
  unit: string;
  startValue: number;
  endValue: number;
  events: SpeedscopeEvent[];
  frames?: SpeedscopeFrame[];
}

export interface SpeedscopeFile {
  $schema?: string;
  version?: string;
  shared?: {
    frames: SpeedscopeFrame[];
  };
  profiles: SpeedscopeProfile[];
  name?: string;
}

// Parsed Liquid source location
export interface LiquidSourceLocation {
  file: string; // e.g., "sections/header.liquid"
  line: number | null;
  col: number | null;
  renderTimeMs: number;
  children: LiquidSourceLocation[];
}

// Maps a section/block to its source locations
export interface SectionSourceMap {
  sectionType: string;
  file: string;
  locations: LiquidSourceLocation[];
  totalRenderTimeMs: number;
}

// The full profiling result for a page
export interface PageProfile {
  url: string;
  fetchedAt: number;
  totalRenderTimeMs: number;
  sections: Map<string, SectionSourceMap>;
  allLocations: LiquidSourceLocation[];
  frames: SpeedscopeFrame[];
}

// Auth token
export interface ProfilerToken {
  accessToken: string;
  expiresAt: number;
}

// Profiler status
export type ProfilerStatus =
  | { state: "idle" }
  | { state: "authenticating" }
  | { state: "authenticated"; token: ProfilerToken }
  | { state: "fetching" }
  | { state: "ready"; profile: PageProfile }
  | { state: "error"; message: string };
