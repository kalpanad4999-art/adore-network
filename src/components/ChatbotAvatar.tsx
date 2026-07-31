interface ChatbotAvatarProps {
  className?: string;
  /** Tailwind text size class for the letter */
  textClassName?: string;
  title?: string;
}

/**
 * Built-in circular "T" avatar for the Trinetra Yoga assistant.
 * Pure CSS/SVG-free — works offline, after deploy, and on every device.
 */
const ChatbotAvatar = ({
  className = "h-8 w-8",
  textClassName = "text-sm",
  title = "Trinetra Yoga assistant",
}: ChatbotAvatarProps) => (
  <span
    role="img"
    aria-label={title}
    title={title}
    className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-semibold leading-none select-none ${className} ${textClassName}`}
  >
    T
  </span>
);

export default ChatbotAvatar;
