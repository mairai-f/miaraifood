import { ImageIcon } from "lucide-react";
import type { CSSProperties } from "react";

type FoodImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
};

export function FoodImage({ src, alt, className = "", style }: FoodImageProps) {
  if (!src) {
    return (
      <div style={style} className={`grid place-items-center bg-gradient-to-br from-[#fff0df] via-white to-[#ffe2c2] text-muted-foreground ${className}`}>
        <ImageIcon size={28} />
      </div>
    );
  }

  return <img src={src} alt={alt} style={style} className={`object-cover ${className}`} loading="lazy" decoding="async" />;
}
