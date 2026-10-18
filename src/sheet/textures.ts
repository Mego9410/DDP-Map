// Menu background textures as tiny inline SVG patterns, tinted from the
// theme's own colours. Inline so they work offline and cost no requests.

import type { TextureId, ThemeTokens } from '../shared/types';

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

export function textureImage(id: TextureId, t: ThemeTokens): string {
  const r = t.rule;
  const a = t.accent;
  switch (id) {
    case 'starfield':
      return svg(120, 120, `<g fill='${t.ink}'><circle cx='8' cy='12' r='1' opacity='.7'/><circle cx='52' cy='30' r='.7' opacity='.5'/><circle cx='96' cy='8' r='1.2' opacity='.8'/><circle cx='30' cy='70' r='.6' opacity='.4'/><circle cx='80' cy='60' r='1' opacity='.6'/><circle cx='110' cy='96' r='.8' opacity='.5'/><circle cx='18' cy='108' r='1.1' opacity='.7'/><circle cx='64' cy='100' r='.6' opacity='.4'/></g><circle cx='88' cy='86' r='2' fill='${a}' opacity='.35'/>`);
    case 'paper':
      return svg(80, 80, `<g fill='${r}' opacity='.35'><circle cx='10' cy='14' r='.8'/><circle cx='44' cy='8' r='.6'/><circle cx='70' cy='30' r='.9'/><circle cx='22' cy='52' r='.7'/><circle cx='58' cy='66' r='.8'/><circle cx='6' cy='74' r='.5'/></g>`);
    case 'parchment':
      return svg(160, 160, `<rect width='160' height='160' fill='${r}' opacity='.10'/><path d='M0 40 Q40 30 80 44 T160 38' stroke='${r}' stroke-width='.8' fill='none' opacity='.35'/><path d='M0 120 Q50 110 90 124 T160 116' stroke='${r}' stroke-width='.6' fill='none' opacity='.3'/>`);
    case 'chalk':
      return svg(140, 140, `<g stroke='${t.ink}' stroke-width='.6' opacity='.08' fill='none'><path d='M4 20 L40 18'/><path d='M60 70 L120 66'/><path d='M10 110 L70 114'/><path d='M90 30 L130 34'/></g>`);
    case 'wood':
      return svg(200, 40, `<g stroke='${r}' fill='none' opacity='.45'><path d='M0 8 Q50 4 100 9 T200 7' stroke-width='.8'/><path d='M0 22 Q60 18 120 24 T200 20' stroke-width='.6'/><path d='M0 34 Q40 31 90 35 T200 33' stroke-width='.7'/></g>`);
    case 'waves':
      return svg(60, 24, `<path d='M0 12 Q15 2 30 12 T60 12' stroke='${r}' stroke-width='1.2' fill='none' opacity='.5'/>`);
    case 'stripes':
      return svg(28, 28, `<path d='M0 0h14v28H0z' fill='${r}' opacity='.16'/>`);
    case 'pinstripe':
      return svg(16, 16, `<path d='M8 0v16' stroke='${r}' stroke-width='1' opacity='.55'/>`);
    case 'grid':
      return svg(32, 32, `<path d='M32 0H0v32' stroke='${r}' stroke-width='.8' fill='none' opacity='.5'/>`);
    case 'lattice':
      return svg(40, 40, `<g stroke='${r}' stroke-width='1.2' fill='none' opacity='.45'><path d='M0 20h40M20 0v40'/><rect x='10' y='10' width='20' height='20'/></g>`);
    case 'tile':
      return svg(40, 40, `<g fill='none' stroke='${r}' opacity='.5'><rect x='.5' y='.5' width='39' height='39'/><path d='M20 4 36 20 20 36 4 20z'/></g>`);
    case 'zellige':
      return svg(48, 48, `<g fill='none' stroke='${a}' stroke-width='1' opacity='.35'><path d='M24 2 30 18 46 24 30 30 24 46 18 30 2 24 18 18z'/></g><circle cx='24' cy='24' r='3' fill='${r}' opacity='.6'/>`);
    case 'plaid':
      return svg(48, 48, `<rect x='0' y='18' width='48' height='12' fill='${a}' opacity='.10'/><rect x='18' y='0' width='12' height='48' fill='${a}' opacity='.10'/><path d='M0 6h48M0 42h48M6 0v48M42 0v48' stroke='${r}' stroke-width='.8' opacity='.5'/>`);
    case 'gingham':
      return svg(24, 24, `<rect width='12' height='24' fill='${a}' opacity='.08'/><rect width='24' height='12' fill='${a}' opacity='.08'/>`);
    case 'deco':
      return svg(60, 30, `<g fill='none' stroke='${a}' stroke-width='.9' opacity='.35'><path d='M0 30a30 30 0 0 1 60 0'/><path d='M10 30a20 20 0 0 1 40 0'/><path d='M20 30a10 10 0 0 1 20 0'/></g>`);
    case 'rust':
      return svg(90, 90, `<g fill='${a}' opacity='.10'><circle cx='14' cy='20' r='9'/><circle cx='70' cy='14' r='6'/><circle cx='50' cy='64' r='11'/><circle cx='10' cy='76' r='5'/></g><g stroke='${r}' opacity='.6'><path d='M0 45h90'/></g><g fill='${r}' opacity='.8'><circle cx='6' cy='45' r='1.5'/><circle cx='84' cy='45' r='1.5'/></g>`);
    case 'bioglow':
      return svg(120, 120, `<g fill='${a}'><circle cx='18' cy='22' r='2' opacity='.45'/><circle cx='84' cy='36' r='1.4' opacity='.35'/><circle cx='50' cy='88' r='2.4' opacity='.4'/><circle cx='104' cy='100' r='1.2' opacity='.3'/></g><g fill='#b388ff'><circle cx='66' cy='12' r='1.2' opacity='.35'/><circle cx='24' cy='70' r='1.6' opacity='.35'/></g>`);
    case 'leaves':
      return svg(70, 70, `<g fill='${a}' opacity='.10'><path d='M14 10c10 0 16 8 16 18-10 0-16-8-16-18z'/><path d='M50 42c10 0 16 8 16 18-10 0-16-8-16-18z'/></g>`);
    case 'dots':
      return svg(20, 20, `<circle cx='10' cy='10' r='1.6' fill='${r}' opacity='.55'/>`);
    case 'seigaiha':
      return svg(40, 20, `<g fill='none' stroke='${r}' opacity='.6'><path d='M0 20a20 20 0 0 1 40 0'/><path d='M8 20a12 12 0 0 1 24 0'/><path d='M-20 20a20 20 0 0 1 40 0M20 20a20 20 0 0 1 40 0'/></g>`);
    case 'papel':
      return svg(60, 26, `<path d='M0 0h60v14l-5 6-5-6-5 6-5-6-5 6-5-6-5 6-5-6-5 6-5-6-5 6-5-6z' fill='${a}' opacity='.18'/><g fill='${t.bg}' opacity='.6'><circle cx='15' cy='6' r='2'/><circle cx='45' cy='6' r='2'/><path d='M28 3h4v6h-4z'/></g>`);
    case 'none':
    default:
      return 'none';
  }
}

export function themeStyle(t: ThemeTokens): React.CSSProperties {
  return {
    '--m-bg': t.bg,
    '--m-ink': t.ink,
    '--m-muted': t.muted,
    '--m-accent': t.accent,
    '--m-rule': t.rule,
    '--m-display': t.displayFont,
    '--m-body': t.bodyFont,
    '--m-texture': textureImage(t.texture, t),
  } as React.CSSProperties;
}
