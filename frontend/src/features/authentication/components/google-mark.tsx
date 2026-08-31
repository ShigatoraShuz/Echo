interface GoogleMarkProps {
  className?: string;
}

/** Official multicolour Google "G" mark used for Google authentication actions. */
export function GoogleMark({ className = "h-5 w-5 shrink-0" }: GoogleMarkProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.7-.06-1.37-.18-2.02H12v3.82h5.24a4.48 4.48 0 0 1-1.94 2.94v2.54h3.15c1.84-1.7 2.9-4.2 2.9-7.28Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.15-2.54c-.87.58-1.99.92-3.3.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.62A9.74 9.74 0 0 0 2.25 12c0 1.57.37 3.06 1.04 4.36l3.24-2.62Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.74A5.88 5.88 0 0 1 6.22 12c0-.6.11-1.18.31-1.74V7.64H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.37 3.06 1.04 4.36l3.24-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.23c1.43 0 2.7.49 3.71 1.45l2.78-2.78C16.83 3.35 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.71 5.39l3.24 2.62c.77-2.31 2.93-4.03 5.47-4.03Z"
      />
    </svg>
  );
}
