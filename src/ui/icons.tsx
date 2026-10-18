// Inline stroke icons (no icon font, no emoji): they inherit currentColor and work offline.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// Park glyphs: generic shapes, no Disney marks.
export const ParkIcon: Record<string, (p: P) => JSX.Element> = {
  'magic-kingdom': (p) => (
    <Svg {...p}>
      <path d="M4 21V11l2-2 2 2V7l2-3 2 3V6l2-3 2 3v5l2-2 2 2v10z" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
    </Svg>
  ),
  epcot: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="11" r="7" />
      <path d="M5.5 8.5h13M5 12h14M6.5 15.5h11M12 4l-4 7 4 7 4-7z" />
      <path d="M9 21h6" />
    </Svg>
  ),
  'hollywood-studios': (p) => (
    <Svg {...p}>
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
      <path d="M3.5 9l2-5 15 3-1 2M8 4.6l1.6 3.4M13 5.6l1.6 3.4" />
    </Svg>
  ),
  'animal-kingdom': (p) => (
    <Svg {...p}>
      <path d="M12 21v-8" />
      <path d="M12 13c-4 0-7-2.5-7-6 3 0 5 1 7 3 2-2 4-3 7-3 0 3.5-3 6-7 6z" />
      <path d="M8 21h8" />
    </Svg>
  ),
  'disney-springs': (p) => (
    <Svg {...p}>
      <path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17" />
      <path d="M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2-1.5 4.5-1.5S19 21 21 21" />
      <path d="M8 13V7l4-3 4 3v6" />
    </Svg>
  ),
};

export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);
export const Back = (p: P) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const Chevron = (p: P) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const Share = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Svg>
);
export const Star = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </Svg>
);
export const Utensils = (p: P) => (
  <Svg {...p}>
    <path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10" />
  </Svg>
);
export const Directions = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </Svg>
);
export const Drop = (p: P) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M12 2.5C9 7 5.5 11 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 11 15 7 12 2.5z" />
  </svg>
);
export const Check = (p: P) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
);
export const Locate = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const Phone = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const Sparkle = (p: P) => (
  <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
  </svg>
);
export const Pencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Svg>
);
