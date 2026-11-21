import type { ReactElement } from "react";

import { buildImageUrl, MAX_IMAGE_WIDTH } from "~/lib/images/image-url";

interface OptimizedImageProps {
  /** Dominio del CDN de imágenes. Lo entrega el `loader` de la página. */
  readonly cdnHost: string;
  /** Ruta de la imagen dentro del almacenamiento: `productos/balon.jpg`. */
  readonly src: string;
  /** Obligatorio. Una imagen decorativa lleva `alt=""` escrito a propósito. */
  readonly alt: string;
  /** Ancho en píxeles CSS al que se muestra. */
  readonly width: number;
  /** Alto en píxeles CSS. Con el ancho, reserva el espacio antes de cargar. */
  readonly height: number;
  /**
   * Cuánto ocupa la imagen según la pantalla, cuando no es fija. Sin esto se
   * asume que siempre se muestra a `width`.
   */
  readonly sizes?: string;
  /** Para la imagen principal de la página: carga de inmediato. Las demás
   * esperan a acercarse a la pantalla. */
  readonly isPriority?: boolean;
  readonly className?: string;
}

const HIGH_DENSITY_FACTOR = 2;

/**
 * Imagen de contenido servida por el CDN (FR-123): fotos de productos, camps
 * y tips. Los logos de `public/brand/` no pasan por aquí: usan `<img>`.
 */
export function OptimizedImage({
  cdnHost,
  src,
  alt,
  width,
  height,
  sizes,
  isPriority = false,
  className,
}: OptimizedImageProps): ReactElement {
  const highDensityWidth = Math.min(
    width * HIGH_DENSITY_FACTOR,
    MAX_IMAGE_WIDTH,
  );
  // En el tope los dos anchos coinciden: el Set evita ofrecer dos veces el
  // mismo candidato.
  const candidates = [...new Set([width, highDensityWidth])].map(
    (candidate) =>
      `${buildImageUrl({ cdnHost, path: src, width: candidate })} ${String(candidate)}w`,
  );
  return (
    <img
      src={buildImageUrl({ cdnHost, path: src, width })}
      srcSet={candidates.join(", ")}
      sizes={sizes ?? `${String(width)}px`}
      alt={alt}
      width={width}
      height={height}
      loading={isPriority ? "eager" : "lazy"}
      fetchPriority={isPriority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
