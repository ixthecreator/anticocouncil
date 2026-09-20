import { useId } from "react";

/** CSS-only so the public, script-free prerender has the same introduction. */
export default function BrandIntro() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="brand-intro" aria-hidden="true">
      <span className="brand-intro__edition">ANTICO — COUNCIL</span>
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
            <rect width="2000" height="2000" fill="#e8e8e8" />
          </g>
        </svg>
        <div className="brand-intro__wordmark">
          <span className="brand-intro__rule" />
          <p className="brand-intro__name">安提柯议会</p>
          <p className="brand-intro__english" lang="en">ANTICO COUNCIL</p>
        </div>
      </div>
      <div className="brand-intro__footer"><span>让讨论有回响 · 让共识有行动</span><span className="brand-intro__hairline" /></div>
    </div>
  );
}
