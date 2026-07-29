interface SkipLinkProps {
  targetId: string;
  label?: string;
}

export function SkipLink({ targetId, label = "Skip to main content" }: SkipLinkProps) {
  return (
    <a
      href={#}
      className="skip-link"
      style={{
        position: "absolute",
        top: "-100%",
        left: 0,
        zIndex: 9999,
        padding: "8px 16px",
        background: "var(--color-primary-600)",
        color: "#fff",
        textDecoration: "none",
        fontWeight: 600,
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = "0";
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = "-100%";
      }}
    >
      {label}
    </a>
  );
}
