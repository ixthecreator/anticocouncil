import { useId } from "react";

/** CSS-only so the public, script-free prerender has the same introduction. */
export default function BrandIntro() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="brand-intro" aria-hidden="true">
      <div className="brand-intro__signature">
        <svg className="brand-intro__emblem" viewBox="0 0 2000 2000" focusable="false">
          <defs>
            <filter id={`${id}-invert`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
            </filter>
            <mask id={`${id}-mask`} x="0" y="0" width="2000" height="2000" maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
              <image href="/logo.png" width="2000" height="2000" filter={`url(#${id}-invert)`} />
            </mask>
          </defs>
          <g mask={`url(#${id}-mask)`}>
            <rect width="2000" height="2000" fill="#ffffff" />
          </g>
        </svg>
        <p className="brand-intro__name">安提柯议会</p>
      </div>
    </div>
  );
}
