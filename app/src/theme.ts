// Axis — the Abdeen Labs design system, ported for React Native.
// Source of truth: abdeen-brand/BRAND.md (v3.5). The app ships dark mode,
// which is Axis's canonical mode: the page is pitch-950 with chalk and
// graphite ink, and lacquer handles identity and action.

export const palette = {
  // Pitch — the dark field
  pitch960: '#000000',
  pitch950: '#06080D',
  pitch900: '#0C1017',
  pitch850: '#131822',
  pitch800: '#1A212C',
  pitch700: '#212936',
  pitch600: '#293344',
  pitch500: '#323E50',
  // Graphite — structure and dim text
  graphite600: '#576274',
  graphite500: '#748092',
  graphite400: '#8E97A8',
  graphite300: '#A9B2C0',
  // Chalk — text, never a surface
  chalk100: '#FFFFFF',
  chalk300: '#E0E5EE',
  // Lacquer — identity red
  lacquer400: '#E13B3B',
  lacquer500: '#CE2020',
  lacquer600: '#A31818',
  // State
  jade400: '#16B37D',
  amber400: '#E2A81E',
};

// Role tokens — components consume these, never a ramp step.
export const colors = {
  // Surfaces
  bg: palette.pitch950, // surface-page
  surface: palette.pitch900, // surface-sunken — wells, inputs, console fields
  card: palette.pitch850, // surface-card — the default plate
  band: palette.pitch800, // surface-band — strips, chips, number bubbles
  cardElevated: palette.pitch700, // surface-raised — the loudest surface
  border: palette.pitch600, // hairline
  borderStrong: palette.pitch500, // hairline-strong
  // Ink
  text: palette.chalk100, // ink-primary
  textSoft: palette.chalk300, // ink-secondary
  dim: palette.graphite400, // ink-dim — the floor on cards and bands
  faint: palette.graphite500, // ink-faint — page surface only
  // Signals
  accent: palette.lacquer500, // signal-identity — primary actions, active rules
  link: palette.lacquer400, // signal-link — links, destructive labels
  press: palette.lacquer600, // signal-press — primary-button press
  success: palette.jade400, // signal-verified
  warning: palette.amber400, // signal-warning
  danger: palette.lacquer400, // destructive labels share signal-link
  white: '#FFFFFF',
  black: '#000000',
};

// Radius is concentric: each step 4px tighter than the frame around it.
// A control is always one step tighter than the plate it sits on. round is
// reserved for switch tracks, avatars, and dots — chips are controls.
export const radii = {
  control: 6, // buttons, inputs, fields, chips
  plate: 10, // plates, cards, wells, bands
  shell: 14, // shells, modals, rails
  round: 999, // dots and avatars only
};

// Type — Geist Mono for chrome, data, and labels; Geist for prose;
// Schibsted Grotesk for uppercase display at 24px or larger.
export const fonts = {
  text: 'Geist-Regular',
  textMedium: 'Geist-Medium',
  textSemiBold: 'Geist-SemiBold',
  mono: 'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
  monoSemiBold: 'GeistMono-SemiBold',
  display: 'SchibstedGrotesk-Bold',
  displayHeavy: 'SchibstedGrotesk-ExtraBold',
};

// Micro-labels are uppercase mono at 0.11em tracking.
export const tracking = {
  micro: 1.2, // 0.11em at 11px
  display: -0.055, // multiply by font size
};
