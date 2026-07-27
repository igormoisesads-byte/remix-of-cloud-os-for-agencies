import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src?: string | null;
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
  eager?: boolean;
};

/**
 * Miniatura de criativo com fallback: tenta a URL principal (R2), depois a
 * alternativa (CDN do Meta) e, se ambas falharem, mostra um placeholder.
 */
export function CreativeThumb({ src, fallbackSrc, alt = "", className = "w-full h-full object-cover", eager }: Props) {
  const candidates = [src, fallbackSrc].filter(Boolean) as string[];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src, fallbackSrc]);

  const current = candidates[index];
  if (!current) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
