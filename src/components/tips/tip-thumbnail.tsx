import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";

import { formatDuration } from "~/lib/i18n/format";
import { useTranslate } from "~/lib/i18n/translations-context";

// La miniatura vertical de Bunny Stream. No pasa por `OptimizedImage`
// (decisión 4 del PRD de W4). Si no carga, queda el recuadro con su fondo.
const THUMBNAIL_WIDTH = 270;
const THUMBNAIL_HEIGHT = 480;

/** Rótulo pequeño sobre una miniatura. */
export const THUMBNAIL_TAG_STYLES =
  "rounded-tag bg-brand-night px-2 py-1 font-bold text-brand-mist";

interface TipThumbnailProps {
  readonly url: string;
  readonly durationSeconds: number;
  /** La del último video se ve al abrir la página; las demás esperan. */
  readonly isPriority?: boolean;
}

// Una imagen que no carga pinta su icono roto aun con `alt` vacío: se oculta.
// La que falló antes de hidratar ya no avisa, así que se le pregunta.
function useBrokenImage(url: string): {
  readonly imageRef: RefObject<HTMLImageElement | null>;
  readonly isBroken: boolean;
  readonly markBroken: () => void;
} {
  const imageRef = useRef<HTMLImageElement>(null);
  const [brokenUrl, setBrokenUrl] = useState<string>();
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setBrokenUrl(url);
  }, [url]);
  return {
    imageRef,
    isBroken: brokenUrl === url,
    markBroken: () => setBrokenUrl(url),
  };
}

/**
 * La miniatura de un tip con su duración. Va dentro de un contenedor que fija
 * su ancho y su fondo. La imagen es decorativa: el enlace que la contiene ya
 * dice el título.
 */
export function TipThumbnail({
  url,
  durationSeconds,
  isPriority = false,
}: TipThumbnailProps): ReactElement {
  const translate = useTranslate();
  const duration = formatDuration(durationSeconds);
  const { imageRef, isBroken, markBroken } = useBrokenImage(url);
  return (
    <>
      <img
        ref={imageRef}
        onError={markBroken}
        src={url}
        alt=""
        width={THUMBNAIL_WIDTH}
        height={THUMBNAIL_HEIGHT}
        loading={isPriority ? "eager" : "lazy"}
        fetchPriority={isPriority ? "high" : undefined}
        className={`absolute inset-0 size-full object-cover ${isBroken ? "opacity-0" : ""}`}
      />
      <span
        className={`${THUMBNAIL_TAG_STYLES} absolute right-2.5 bottom-2.5 text-[12px]`}
      >
        <span aria-hidden="true">{duration}</span>
        <span className="sr-only">
          {translate("tips.card.duration", { duration })}
        </span>
      </span>
    </>
  );
}
