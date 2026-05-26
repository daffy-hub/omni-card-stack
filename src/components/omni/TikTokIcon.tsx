interface Props {
  className?: string;
  style?: React.CSSProperties;
}

// Simple TikTok glyph (lucide doesn't ship one). Uses currentColor so it
// inherits the platform color token like the other icons.
export function TikTokIcon({ className, style }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d="M19.6 6.4a5.4 5.4 0 0 1-3.2-1.1 5.4 5.4 0 0 1-2.1-3.5h-3.1v13.1a2.6 2.6 0 1 1-1.9-2.5V9.2a5.7 5.7 0 1 0 4.9 5.7V9.4a8.3 8.3 0 0 0 5.4 2v-3.1c-.4 0-.8 0-1-.1Z" />
    </svg>
  );
}
