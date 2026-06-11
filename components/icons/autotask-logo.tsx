import * as React from "react";

// Autotask-Logo als Inline-SVG mit `fill="currentColor"`, damit es über die
// semantischen Text-Tokens automatisch Light/Dark folgt. Quelle: public/autotask-logo-svg.svg
// (dort hart `#000000`; diese Variante ist die einzige thembare Form).
export function AutotaskLogo({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M23.907 15.5l3.708 9.317h-5.729l-2.432-6.312-13.183 8.891-4.937-10.593h1.088l5.849 4.557 10.151-5.532-1.448-3.76-1.557 3.307-6.583 3.62 4.735-12.453h6.771l2.697 6.771 8.964-4.885v-8.427h-32v32h32v-21.959z" />
    </svg>
  );
}
