import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function SunriseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 2.5v2.25" />
      <path d="M4.2 5.2l1.6 1.6" />
      <path d="M13.8 5.2l-1.6 1.6" />
      <path d="M2.25 12.75h13.5" />
      <path d="M5.25 12.75a3.75 3.75 0 0 1 7.5 0" />
      <path d="M7.25 15.25h3.5" />
    </svg>
  );
}

export function SunsetIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 6.75V2.75" />
      <path d="M7.25 5L9 6.75 10.75 5" />
      <path d="M2.25 12.75h13.5" />
      <path d="M5.25 12.75a3.75 3.75 0 0 1 7.5 0" />
      <path d="M6.25 15.25h5.5" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M11 4.25L6.25 9 11 13.75" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 4.25L11.75 9 7 13.75" />
    </svg>
  );
}

export function TideFallingIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 5.25L13.5 13.25" />
      <path d="M13.5 8.5v4.75H8.75" />
    </svg>
  );
}

export function TideRisingIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 13.25L13.5 5.25" />
      <path d="M8.75 5.25h4.75V10" />
    </svg>
  );
}

export function TideSlackIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.75 9h10.5" />
      <path d="M6.25 6.75L3.75 9l2.5 2.25" />
      <path d="M11.75 6.75L14.25 9l-2.5 2.25" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 15.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
      <circle cx="9" cy="7.5" r="1.65" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5V9l2.4 1.6" />
    </svg>
  );
}

export function WaveIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M1.75 7.25c1.6-1.7 3.2-1.7 4.8 0s3.2 1.7 4.8 0 3.2-1.7 4.8 0 1.6.95 2.1.45" />
      <path d="M1.75 11.75c1.6-1.7 3.2-1.7 4.8 0s3.2 1.7 4.8 0 3.2-1.7 4.8 0 1.6.95 2.1.45" />
    </svg>
  );
}
