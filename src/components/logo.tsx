import { useId } from "react";

/**
 * The Equal Parts tiki mark: a carved tiki head under palm fronds against a
 * teal-to-coral sunset. The grin's two rows of teeth form an equals sign.
 * Same artwork as src/app/icon.svg (the favicon); keep the two in step, and
 * re-export the PNG icons (see README, "App icons") after changing it.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  // Unique gradient ids, in case the mark appears twice on one page.
  const id = `ep-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bg = `${id}-bg`;
  const wood = `${id}-wood`;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b4f4a" />
          <stop offset="0.55" stopColor="#0e6b63" />
          <stop offset="1" stopColor="#9a3412" />
        </linearGradient>
        <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdebc8" />
          <stop offset="1" stopColor="#f2c07c" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${bg})`}/>
      {/* Setting sun */}
      <circle cx="256" cy="214" r="146" fill="#fb923c" />
      <circle cx="256" cy="214" r="146" fill="none" stroke="#fdba74" strokeWidth="10" opacity="0.6" />
      {/* Palm fronds fanning out of the crown */}
      <g fill="#5eead4">
        <path d="M256 148 C196 70 108 64 46 112 C90 104 132 112 168 132 C136 134 110 148 92 170 C150 146 204 150 246 174 Z" />
        <path d="M256 148 C316 70 404 64 466 112 C422 104 380 112 344 132 C376 134 402 148 420 170 C362 146 308 150 266 174 Z" />
        <path d="M256 158 C238 100 250 56 290 28 C276 64 280 110 272 166 Z" fill="#2dd4bf" />
      </g>
      {/* Ears */}
      <rect x="112" y="236" width="44" height="96" rx="18" fill="#e9a95c" />
      <rect x="356" y="236" width="44" height="96" rx="18" fill="#e9a95c" />
      {/* Tiki head */}
      <path d="M146 180 Q146 136 196 132 L316 132 Q366 136 366 180 L374 512 L138 512 Z" fill={`url(#${wood})`}/>
      {/* Carved headband */}
      <rect x="146" y="142" width="220" height="26" fill="#c2410c" />
      <g fill="#fdebc8">
        <circle cx="176" cy="155" r="6" /><circle cx="216" cy="155" r="6" /><circle cx="256" cy="155" r="6" /><circle cx="296" cy="155" r="6" /><circle cx="336" cy="155" r="6" />
      </g>
      {/* Brow ridge */}
      <path d="M152 196 Q256 170 360 196 L360 222 Q256 200 152 222 Z" fill="#2a1b12" />
      {/* Eyes */}
      <circle cx="204" cy="258" r="34" fill="#2a1b12" />
      <circle cx="308" cy="258" r="34" fill="#2a1b12" />
      <circle cx="204" cy="258" r="13" fill="#fff7e8" />
      <circle cx="308" cy="258" r="13" fill="#fff7e8" />
      {/* Nose */}
      <path d="M240 232 L272 232 L294 324 Q256 340 218 324 Z" fill="#c2410c" />
      {/* Cheek carvings */}
      <g fill="none" stroke="#c2410c" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M168 312 L184 326 L168 340" />
        <path d="M344 312 L328 326 L344 340" />
      </g>
      {/* Mouth: the grin's two rows of teeth make an equals sign */}
      <rect x="168" y="358" width="176" height="84" rx="28" fill="#2a1b12" />
      <rect x="194" y="378" width="124" height="15" rx="7.5" fill="#fff7e8" />
      <rect x="194" y="407" width="124" height="15" rx="7.5" fill="#fff7e8" />
      {/* Chin notches */}
      <g fill="#e9a95c">
        <rect x="200" y="466" width="24" height="46" rx="6" />
        <rect x="244" y="466" width="24" height="46" rx="6" />
        <rect x="288" y="466" width="24" height="46" rx="6" />
      </g>
    </svg>
  );
}
