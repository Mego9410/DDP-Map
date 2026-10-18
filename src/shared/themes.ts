import type { Layout, PriceStyle, TextureId, Theme, ThemeTokens } from './types.js';

// Font families are self-hosted via @fontsource (see src/fonts.ts) so they work offline.
export const FONTS = {
  orbitron: "'Orbitron', system-ui, sans-serif",
  space: "'Space Grotesk', system-ui, sans-serif",
  rye: "'Rye', Georgia, serif",
  pirata: "'Pirata One', Georgia, serif",
  fell: "'IM Fell English', Georgia, serif",
  cinzel: "'Cinzel', Georgia, serif",
  lobster: "'Lobster', Georgia, cursive",
  lora: "'Lora', Georgia, serif",
  bungee: "'Bungee', system-ui, sans-serif",
  chakra: "'Chakra Petch', system-ui, sans-serif",
  hand: "'Patrick Hand', 'Comic Sans MS', cursive",
  inter: "'Inter', system-ui, sans-serif",
} as const;

type F = keyof typeof FONTS;

function t(
  id: string,
  label: string,
  c: { bg: string; ink: string; muted: string; accent: string; rule: string },
  display: F,
  body: F,
  texture: TextureId,
  layout: Layout,
  priceStyle: PriceStyle = 'dots',
): Theme {
  const tokens: ThemeTokens = {
    ...c,
    displayFont: FONTS[display],
    bodyFont: FONTS[body],
    texture,
    layout,
    priceStyle,
  };
  return { id, label, tokens };
}

export const THEMES: Theme[] = [
  // Magic Kingdom
  t('vintage-diner', 'Main Street diner', { bg: '#fbf3e4', ink: '#2a1a12', muted: '#6b4f3a', accent: '#b3261e', rule: '#d9b98a' }, 'lobster', 'lora', 'stripes', 'card'),
  t('ballpark', 'Ballpark', { bg: '#0f3b22', ink: '#fbf7ea', muted: '#c9dccd', accent: '#f2c14e', rule: '#2f6b45' }, 'bungee', 'inter', 'pinstripe', 'board'),
  t('coffeehouse', 'Coffeehouse', { bg: '#1e3932', ink: '#f2f0eb', muted: '#bcd3c8', accent: '#d4e9e2', rule: '#2f5a4e' }, 'lora', 'inter', 'dots', 'board', 'plain'),
  t('pirate-tavern', 'Pirate tavern', { bg: '#2a1a10', ink: '#f6e6c8', muted: '#d1b991', accent: '#e0a43a', rule: '#5c3b22' }, 'pirata', 'lora', 'wood', 'board'),
  t('wanted-poster', 'Wanted poster', { bg: '#f3e2bf', ink: '#3b2412', muted: '#6e4d31', accent: '#9c3d1b', rule: '#c9a46c' }, 'rye', 'lora', 'paper', 'card'),
  t('bayou', 'Bayou outpost', { bg: '#20352b', ink: '#f3ead2', muted: '#c5d1b8', accent: '#d9a441', rule: '#3d5a49' }, 'rye', 'lora', 'wood', 'board'),
  t('colonial-tavern', 'Colonial tavern', { bg: '#f5efe1', ink: '#1f2a44', muted: '#4b5675', accent: '#8b1e2b', rule: '#c8bfa6' }, 'fell', 'lora', 'paper', 'card'),
  t('nautical', 'Nautical', { bg: '#0f2a44', ink: '#f4efe4', muted: '#c2cfdc', accent: '#e0a43a', rule: '#2c4a6b' }, 'cinzel', 'lora', 'waves', 'board'),
  t('harvest', 'Sleepy Hollow harvest', { bg: '#2b1b12', ink: '#f6e7cf', muted: '#d6bfa0', accent: '#e07b24', rule: '#5b3b26' }, 'fell', 'lora', 'leaves', 'board'),
  t('storybook', 'Storybook', { bg: '#fbf4e2', ink: '#2d1b3d', muted: '#5d4a6b', accent: '#6b3fa0', rule: '#d8c6a4' }, 'cinzel', 'fell', 'parchment', 'scroll'),
  t('swiss-village', 'Alpine village', { bg: '#fdf8ef', ink: '#2a1e14', muted: '#5f4c3b', accent: '#2f6b3a', rule: '#d6c3a0' }, 'cinzel', 'lora', 'gingham', 'scroll'),
  t('hunting-lodge', 'Hunting lodge', { bg: '#3a2414', ink: '#f7e9cf', muted: '#d7c09c', accent: '#d4a24c', rule: '#6a4528' }, 'cinzel', 'lora', 'wood', 'board'),
  t('retro-space', 'Retro space', { bg: '#0b1030', ink: '#e8f0ff', muted: '#a9b6e0', accent: '#ff5ad1', rule: '#3a4bb8' }, 'orbitron', 'space', 'starfield', 'neon'),
  t('launch-pad', 'Launch pad', { bg: '#101a3a', ink: '#eef6ff', muted: '#a8bde6', accent: '#7cf0ff', rule: '#33479a' }, 'orbitron', 'space', 'grid', 'neon'),

  // EPCOT
  t('future-modern', 'World Celebration', { bg: '#f4f7fb', ink: '#102033', muted: '#465a72', accent: '#0a6cc2', rule: '#cbd7e6' }, 'space', 'inter', 'grid', 'card', 'plain'),
  t('sunshine', 'Sunshine Seasons', { bg: '#fff8e6', ink: '#2a2410', muted: '#5f5532', accent: '#c25e00', rule: '#efd9a3' }, 'space', 'inter', 'leaves', 'card', 'plain'),
  t('mexico', 'Mexico', { bg: '#1c1238', ink: '#fdf1e0', muted: '#d7c8e6', accent: '#ff7a4d', rule: '#3f2c6e' }, 'bungee', 'lora', 'papel', 'board'),
  t('norway', 'Norway', { bg: '#f7f3ee', ink: '#1d2b4a', muted: '#4a5776', accent: '#b22234', rule: '#d2c8bb' }, 'cinzel', 'lora', 'plaid', 'card'),
  t('china', 'China', { bg: '#7a0f14', ink: '#fff3d6', muted: '#f1cfa8', accent: '#f2c14e', rule: '#a3363b' }, 'cinzel', 'lora', 'lattice', 'board'),
  t('outpost', 'Outpost', { bg: '#f4e3c3', ink: '#3a1f0f', muted: '#6a4a33', accent: '#a8471f', rule: '#d1b080' }, 'bungee', 'lora', 'dots', 'card'),
  t('germany', 'Germany', { bg: '#fdf6e3', ink: '#1f1a14', muted: '#53483b', accent: '#b10e26', rule: '#dccba3' }, 'fell', 'lora', 'gingham', 'card'),
  t('italy', 'Italy', { bg: '#fffaf2', ink: '#1f2d1f', muted: '#4e5c4e', accent: '#b10e26', rule: '#d9cfbd' }, 'cinzel', 'lora', 'tile', 'card'),
  t('smokehouse', 'Smokehouse', { bg: '#1d1714', ink: '#f6ead8', muted: '#cdbca5', accent: '#e8742a', rule: '#4a3a30' }, 'rye', 'inter', 'wood', 'board'),
  t('japan', 'Japan', { bg: '#f8f4ec', ink: '#1c1c1c', muted: '#4f4a43', accent: '#bc002d', rule: '#ddd2c0' }, 'lora', 'inter', 'seigaiha', 'card', 'plain'),
  t('morocco', 'Morocco', { bg: '#123b5a', ink: '#fdf3e1', muted: '#c9d6e0', accent: '#e3a33b', rule: '#2b5b80' }, 'cinzel', 'lora', 'zellige', 'board'),
  t('france', 'France', { bg: '#fbf6ef', ink: '#1d2340', muted: '#4b5170', accent: '#a3172c', rule: '#ddd0bd' }, 'lobster', 'lora', 'stripes', 'card'),
  t('uk', 'United Kingdom', { bg: '#12233f', ink: '#f6f1e7', muted: '#c4ccd9', accent: '#e8a33a', rule: '#2e4468' }, 'cinzel', 'lora', 'plaid', 'board'),
  t('canada', 'Canada', { bg: '#fff7f3', ink: '#2a1612', muted: '#5f4740', accent: '#c8102e', rule: '#e6cfc6' }, 'bungee', 'inter', 'plaid', 'card'),

  // Hollywood Studios
  t('art-deco', 'Art deco', { bg: '#121212', ink: '#f3e6c4', muted: '#cbbf9f', accent: '#d4af37', rule: '#3a3424' }, 'cinzel', 'lora', 'deco', 'board'),
  t('sunset-strip', 'Sunset Boulevard', { bg: '#2a1033', ink: '#fff0e0', muted: '#e1c7d6', accent: '#ffb347', rule: '#55305f' }, 'lobster', 'inter', 'deco', 'neon'),
  t('dockside', 'Dockside diner', { bg: '#eaf6fb', ink: '#0d2b3e', muted: '#3e5a6b', accent: '#c0392b', rule: '#b9d9e6' }, 'lobster', 'inter', 'waves', 'card'),
  t('studio-commissary', 'Studio commissary', { bg: '#f6f6f2', ink: '#1a1a1a', muted: '#4d4d4d', accent: '#c0392b', rule: '#d4d4cc' }, 'bungee', 'inter', 'grid', 'card', 'plain'),
  t('spaceport', 'Spaceport', { bg: '#1a1714', ink: '#efe6d6', muted: '#c4b8a3', accent: '#e8742a', rule: '#4a3f33' }, 'chakra', 'space', 'rust', 'neon'),
  t('toy-box', 'Toy box', { bg: '#fff4c2', ink: '#1a2a6c', muted: '#3f4f8a', accent: '#d62839', rule: '#ecd57a' }, 'bungee', 'hand', 'gingham', 'card', 'tag'),
  t('backlot', 'Backlot', { bg: '#2b2e33', ink: '#f1f1ee', muted: '#c6c8ca', accent: '#f2c14e', rule: '#4a4e55' }, 'bungee', 'inter', 'rust', 'board'),

  // Animal Kingdom
  t('discovery-island', 'Discovery Island', { bg: '#f1e6cf', ink: '#2a2416', muted: '#5b513b', accent: '#2f6b3a', rule: '#cdbb92' }, 'cinzel', 'lora', 'leaves', 'card'),
  t('africa-market', 'Harambe market', { bg: '#f4e3c3', ink: '#3a1f0f', muted: '#6a4a33', accent: '#a8471f', rule: '#d1b080' }, 'bungee', 'lora', 'dots', 'card'),
  t('asia-market', 'Anandapur', { bg: '#f7efe0', ink: '#2b1a10', muted: '#5f4836', accent: '#9e4f12', rule: '#dccaa8' }, 'cinzel', 'lora', 'papel', 'scroll'),
  t('bioluminescent', 'Pandora', { bg: '#071a2b', ink: '#e3fbff', muted: '#9fd0dc', accent: '#3ef0d0', rule: '#1d4560' }, 'chakra', 'space', 'bioglow', 'neon'),

  // Disney Springs
  t('springs-modern', 'Disney Springs', { bg: '#ffffff', ink: '#1d1d1f', muted: '#4f5057', accent: '#0a7c86', rule: '#dfe3e6' }, 'space', 'inter', 'none', 'card', 'plain'),
  t('royal-sandwich', 'Royal deli', { bg: '#7d1520', ink: '#fff6e6', muted: '#efcfb7', accent: '#f2c14e', rule: '#a3404a' }, 'cinzel', 'inter', 'stripes', 'board'),
  t('bold-orange', 'Bold orange', { bg: '#1b1b1b', ink: '#fff7ef', muted: '#d6cdc4', accent: '#ff8a1f', rule: '#3d3d3d' }, 'bungee', 'inter', 'dots', 'board', 'tag'),
  t('chalkboard', 'Chalkboard', { bg: '#222a26', ink: '#f2f2ea', muted: '#c8ccc4', accent: '#f6c66b', rule: '#4b5650' }, 'hand', 'hand', 'chalk', 'board'),
  t('patisserie', 'Patisserie', { bg: '#fdf1f4', ink: '#3a1c2a', muted: '#6d4a5b', accent: '#b03a6e', rule: '#efcfda' }, 'lobster', 'lora', 'stripes', 'card'),
  t('gothic', 'Gothic', { bg: '#121014', ink: '#efe9f2', muted: '#bfb4c6', accent: '#c9a54a', rule: '#3a3340' }, 'cinzel', 'fell', 'deco', 'board'),
  t('irish-pub', 'Irish chipper', { bg: '#0f3b2a', ink: '#f4efe0', muted: '#c8d6c8', accent: '#e8b04a', rule: '#2c5e48' }, 'cinzel', 'lora', 'wood', 'board'),
  t('juke-joint', 'Juke joint', { bg: '#0f1d3a', ink: '#f1ecf9', muted: '#c2c6dd', accent: '#ff9f43', rule: '#2c3d6b' }, 'rye', 'inter', 'wood', 'neon'),
  t('donut-pink', 'Donut shop', { bg: '#fff0f5', ink: '#311428', muted: '#6c4760', accent: '#c2185b', rule: '#f2c9da' }, 'bungee', 'inter', 'dots', 'card', 'tag'),
  t('street-food', 'Street food', { bg: '#141414', ink: '#f7f3ea', muted: '#cdc8bd', accent: '#ff4d4d', rule: '#383838' }, 'chakra', 'inter', 'grid', 'neon'),
  t('tapas', 'Tapas bar', { bg: '#fff7ea', ink: '#2b160c', muted: '#6a4a38', accent: '#b8321b', rule: '#e8cfaa' }, 'lora', 'inter', 'tile', 'card'),
  t('burger-ranch', 'Burger ranch', { bg: '#f6ecdc', ink: '#2c1a0e', muted: '#63462f', accent: '#a03b1c', rule: '#d8c09c' }, 'rye', 'inter', 'wood', 'card'),
];

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((th) => [th.id, th]));

/** Default theme per land (keyed by `${park_id}/${area_label}`), then per park. */
const LAND_DEFAULTS: Record<string, string> = {
  'magic-kingdom/Main Street, U.S.A.': 'vintage-diner',
  'magic-kingdom/Adventureland': 'pirate-tavern',
  'magic-kingdom/Frontierland': 'wanted-poster',
  'magic-kingdom/Liberty Square': 'colonial-tavern',
  'magic-kingdom/Fantasyland': 'storybook',
  'magic-kingdom/Tomorrowland': 'retro-space',
  'epcot/World Celebration': 'future-modern',
  'epcot/World Nature (The Land)': 'sunshine',
  'epcot/Mexico': 'mexico',
  'epcot/Norway': 'norway',
  'epcot/China': 'china',
  'epcot/Outpost (between China and Germany)': 'outpost',
  'epcot/Germany': 'germany',
  'epcot/Italy': 'italy',
  'epcot/The American Adventure': 'smokehouse',
  'epcot/Japan': 'japan',
  'epcot/Morocco': 'morocco',
  'epcot/France': 'france',
  'epcot/United Kingdom': 'uk',
  'epcot/Canada': 'canada',
  'hollywood-studios/Hollywood Boulevard': 'art-deco',
  'hollywood-studios/Echo Lake': 'backlot',
  'hollywood-studios/Commissary Lane': 'studio-commissary',
  'hollywood-studios/Sunset Boulevard': 'sunset-strip',
  "hollywood-studios/Star Wars: Galaxy's Edge": 'spaceport',
  'hollywood-studios/Toy Story Land': 'toy-box',
  'animal-kingdom/Discovery Island': 'discovery-island',
  'animal-kingdom/Africa': 'africa-market',
  'animal-kingdom/Asia': 'asia-market',
  'animal-kingdom/Pandora': 'bioluminescent',
};

const PARK_DEFAULTS: Record<string, string> = {
  'magic-kingdom': 'vintage-diner',
  epcot: 'future-modern',
  'hollywood-studios': 'art-deco',
  'animal-kingdom': 'discovery-island',
  'disney-springs': 'springs-modern',
};

/** Hand-picked overrides for the well-known spots. */
const LOCATION_OVERRIDES: Record<string, string> = {
  'casey-s-corner': 'ballpark',
  'main-street-bakery-starbucks': 'coffeehouse',
  'golden-oak-outpost': 'bayou',
  'columbia-harbour-house': 'nautical',
  'sleepy-hollow': 'harvest',
  'pinocchio-village-haus': 'swiss-village',
  'gaston-s-tavern': 'hunting-lodge',
  'the-lunching-pad': 'launch-pad',
  'connections-caf-starbucks': 'coffeehouse',
  'fife-drum-tavern': 'colonial-tavern',
  'the-trolley-car-cafe-starbucks': 'coffeehouse',
  'dockside-diner': 'dockside',
  'creature-comforts-starbucks': 'coffeehouse',
  'flame-tree-barbecue': 'smokehouse',
  'earl-of-sandwich': 'royal-sandwich',
  'chicken-guy': 'bold-orange',
  'blaze-fast-fire-d-pizza': 'bold-orange',
  'd-luxe-burger': 'burger-ranch',
  'the-polite-pig': 'chalkboard',
  'b-b-wolf-s-sausage-co': 'chalkboard',
  'amorette-s-patisserie': 'patisserie',
  'swirls-on-the-water': 'patisserie',
  'gideon-s-bakehouse': 'gothic',
  'six-ravens': 'gothic',
  'cookes-of-dublin': 'irish-pub',
  'the-smokehouse-at-house-of-blues': 'juke-joint',
  'everglazed-donuts-cold-brew': 'donut-pink',
  'morimoto-asia-street-food': 'street-food',
  'yesake': 'street-food',
  'pepe-by-jos-andr-s': 'tapas',
  'pizza-ponte': 'italy',
  'the-daily-poutine': 'canada',
  'eet-by-maneet-chauhan': 'street-food',
  'marketplace-snacks': 'springs-modern',
};

export function defaultThemeId(loc: { id: string; park_id: string; area_label: string }): string {
  return (
    LOCATION_OVERRIDES[loc.id] ??
    LAND_DEFAULTS[`${loc.park_id}/${loc.area_label}`] ??
    PARK_DEFAULTS[loc.park_id] ??
    'springs-modern'
  );
}

// WCAG relative luminance / contrast ratio.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
