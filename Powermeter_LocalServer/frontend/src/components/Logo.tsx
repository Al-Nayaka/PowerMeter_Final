export function Logo() {
  return (
    <svg
      className="logo"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bolt-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7BF3F5" />
          <stop offset="100%" stopColor="#38C6D2" />
        </linearGradient>
      </defs>
      <path
        d="M14.4 1.2 4 13.2h5.6L9.5 22.8 20 9.9h-5.7l.1-8.7Z"
        fill="url(#bolt-fill)"
      />
    </svg>
  )
}
