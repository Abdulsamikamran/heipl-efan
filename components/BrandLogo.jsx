export default function BrandLogo({ size = 40, className = '' }) {
  return (
    <img
      src="/favicon.png"
      alt="HEIPL-E2P"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
