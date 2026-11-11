import type { ReactElement } from "react";

// Página provisional de la cáscara. Los textos van escritos aquí solo hasta
// que W2 traiga los archivos de traducción (FR-006) y W3 la home real.
const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

export function meta(): { title: string }[] {
  return [{ title: "VolleyTip" }];
}

export default function Home(): ReactElement {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1280px] items-center px-6 py-5">
        <img
          src="/brand/wordmark.png"
          alt="VolleyTip"
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          className="h-[30px] w-auto"
        />
      </header>
      <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24">
        <p className="text-[12px] font-bold tracking-[0.12em] uppercase">
          Sitio en construcción
        </p>
        <h1 className="mt-4 font-display text-[56px] leading-[0.95] uppercase md:text-[72px]">
          Aprende voley en <span className="text-brand-red">60</span> segundos
        </h1>
        <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.5] text-ink-muted">
          Estamos reconstruyendo volleytip.com. Esta página es la base del sitio
          nuevo.
        </p>
        <a
          href="/healthz"
          className="mt-8 inline-flex h-[54px] items-center justify-center rounded-pill bg-brand-red px-8 text-[17px] font-bold text-brand-night no-underline hover:bg-brand-lime active:bg-brand-mist"
        >
          Ver estado del servicio
        </a>
      </main>
    </div>
  );
}
