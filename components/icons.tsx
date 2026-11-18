// Monochrome 16px line icons (1.5px stroke). Color comes from currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const IconCheck = (p: P) => <Svg {...p}><path d="M3.5 8.5l3 3 6-7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></Svg>;
export const IconCheckCircle = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" /><path d="M5.5 8.25l1.75 1.75L10.75 6.5" /></Svg>;
export const IconXCircle = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" /><path d="M6 6l4 4M10 6l-4 4" /></Svg>;
export const IconCircle = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" strokeDasharray="2.2 2.2" /></Svg>;
export const IconDot = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" /><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" /></Svg>;
export const IconHalf = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" stroke="none" /></Svg>;
export const IconFlag = (p: P) => <Svg {...p}><path d="M3.5 14V2.5M3.5 2.75h8l-1.75 3 1.75 3h-8" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M3 8h10M9 4l4 4-4 4" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M13 8H3M7 4L3 8l4 4" /></Svg>;
export const IconChevronRight = (p: P) => <Svg {...p}><path d="M6 3.5L10.5 8 6 12.5" /></Svg>;
export const IconChevronDown = (p: P) => <Svg {...p}><path d="M3.5 6L8 10.5 12.5 6" /></Svg>;
export const IconRefresh = (p: P) => <Svg {...p}><path d="M13 3v3.5H9.5" /><path d="M12.6 6.5A5 5 0 1 0 13 9" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M8 2l6.5 11.5h-13z" /><path d="M8 6.5v3M8 11.6v.1" /></Svg>;
export const IconSpark = (p: P) => <Svg {...p}><path d="M8 1.75v3M8 11.25v3M1.75 8h3M11.25 8h3M3.6 3.6l2 2M10.4 10.4l2 2M12.4 3.6l-2 2M5.6 10.4l-2 2" /></Svg>;
export const IconBook = (p: P) => <Svg {...p}><path d="M2.5 3.25h4a1.5 1.5 0 0 1 1.5 1.5v8.5a1.25 1.25 0 0 0-1.25-1.25H2.5zM13.5 3.25h-4A1.5 1.5 0 0 0 8 4.75v8.5a1.25 1.25 0 0 1 1.25-1.25h4.25z" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 4.75V8l2.25 1.5" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>;

export function Spinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`gf-spin ${className}`} aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.75" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
