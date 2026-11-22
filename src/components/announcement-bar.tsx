import type { ReactElement } from "react";

interface AnnouncementBarProps {
  readonly messages: readonly string[];
}

/**
 * Franja de avisos cortos en la parte de arriba del sitio. Los mensajes
 * vacíos se descartan y, si no queda ninguno, no pinta nada.
 */
export function AnnouncementBar({
  messages,
}: AnnouncementBarProps): ReactElement | null {
  // Sin vacíos ni repetidos: un aviso dos veces no dice nada nuevo.
  const visibleMessages = [
    ...new Set(messages.filter((message) => message.trim() !== "")),
  ];
  if (visibleMessages.length === 0) {
    return null;
  }
  return (
    <div className="bg-brand-lime text-brand-night">
      <ul className="mx-auto flex max-w-[1280px] flex-wrap justify-center gap-x-8 gap-y-1 px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.08em] break-words uppercase min-[390px]:px-6">
        {visibleMessages.map((message, index) => (
          <li
            key={message}
            // En celular cabe un solo aviso: solo el primero se ve.
            className={index === 0 ? "max-w-full" : "max-w-full max-md:hidden"}
          >
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
