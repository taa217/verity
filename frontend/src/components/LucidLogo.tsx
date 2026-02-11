interface LucidLogoProps {
  size?: number;
  className?: string;
}

export default function LucidLogo({ size = 34, className }: LucidLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="Lucid logo"
      width={size}
      height={size}
      className={className}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}
