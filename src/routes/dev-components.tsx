import { useState, type ReactElement, type ReactNode } from "react";
import { data } from "react-router";

import { AnnouncementBar } from "~/components/announcement-bar";
import { Button, type ButtonVariant } from "~/components/button";
import { Eyebrow } from "~/components/eyebrow";
import { IconButton } from "~/components/icon-button";
import type { PreviewState, Zone } from "~/components/pressable";
import { TextField } from "~/components/text-field";
import { serverEnv } from "~/lib/env.server";

// Página de muestra de los componentes base (RF-12). Enseña cada uno en cada
// estado y es lo que Playwright captura como línea base visual. Los textos
// son datos de prueba, no contenido del sitio: por eso van escritos aquí y no
// en los archivos de traducción.

const NOT_FOUND_STATUS = 404;

export function loader(): null {
  // No existe en producción. Un 404 y no una redirección: para un visitante,
  // la página no está.
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  return null;
}

export function meta(): { title: string }[] {
  return [{ title: "Componentes · VolleyTip" }];
}

interface SampleState {
  readonly name: string;
  readonly previewState?: PreviewState;
  readonly isDisabled?: boolean;
  readonly submittingLabel?: string;
}

const POINTER_STATES: readonly SampleState[] = [
  { name: "Normal" },
  { name: "Hover", previewState: "hover" },
  { name: "Foco", previewState: "focus" },
  { name: "Activo", previewState: "active" },
  { name: "Deshabilitado", isDisabled: true },
];

const BUTTON_STATES: readonly SampleState[] = [
  ...POINTER_STATES,
  { name: "Enviando", submittingLabel: "Enviando" },
];

const ZONES: readonly { zone: Zone; title: string; styles: string }[] = [
  { zone: "dark", title: "Zona oscura", styles: "bg-brand-night" },
  {
    zone: "light",
    title: "Zona clara",
    styles: "bg-brand-mist text-brand-night",
  },
];

const CAPTION_STYLES: Record<Zone, string> = {
  dark: "text-ink-muted",
  light: "text-ink-subtle",
};

const BUTTON_VARIANTS: readonly { variant: ButtonVariant; title: string }[] = [
  { variant: "primary", title: "Botón primario" },
  { variant: "secondary", title: "Botón secundario" },
];

const BUTTON_TEXT = "Agregar al carrito";
const LINK_TEXT = "Ver la tienda";
const ICON_LABEL = "Cerrar";
const EYEBROW_TEXT = "Quiénes somos";
const BAR_MESSAGES = [
  "Envíos a toda Colombia",
  "Camp de enero: cupos abiertos",
];

const FIELD_LABEL = "Correo electrónico";
const FIELD_HINT = "Ahí te enviamos la confirmación";
const FIELD_ERROR = "Escribe un correo válido";
const FIELD_VALUE = "ana@ejemplo.co";

// El triple de largo de lo que se espera en cada componente.
const LONG_BUTTON_TEXT =
  "Agregar al carrito todos los productos seleccionados para el próximo camp de voleibol";
const LONG_EYEBROW_TEXT =
  "Quiénes somos, de dónde venimos y por qué enseñamos voleibol en videos de sesenta segundos";
const LONG_BAR_MESSAGES = [
  "Envíos a toda Colombia con seguimiento y entrega en la puerta de tu casa en cinco días hábiles",
  "Camp de enero: cupos abiertos para las categorías infantil, juvenil y mayores hasta agotar existencias",
];

const LONG_FIELD_LABEL =
  "Correo electrónico de la persona que va a recibir la confirmación y el tiquete del camp";
const LONG_FIELD_ERROR =
  "Escribe un correo válido, con un nombre, una arroba y un dominio, por ejemplo ana@ejemplo.co, para poder enviarte la confirmación";

function CloseIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

interface ZoneProps {
  readonly zone: Zone;
}

function Specimen({
  name,
  zone,
  children,
}: ZoneProps & { name: string; children: ReactNode }): ReactElement {
  return (
    <figure className="flex min-w-0 flex-col items-start gap-2">
      {children}
      <figcaption className={`text-[13px] ${CAPTION_STYLES[zone]}`}>
        {name}
      </figcaption>
    </figure>
  );
}

function Showcase({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="mt-12">
      <h3 className="font-display text-[26px] leading-[0.95] uppercase">
        {title}
      </h3>
      <div className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-6">
        {children}
      </div>
    </section>
  );
}

// Rejilla de columnas iguales: los estados quedan alineados aunque la fila
// salte de línea.
function SpecimenGrid({
  minColumnStyles,
  children,
}: {
  minColumnStyles: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={`grid w-full gap-x-8 gap-y-6 ${minColumnStyles}`}>
      {children}
    </div>
  );
}

const BUTTON_GRID = "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]";
const ICON_GRID = "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]";

function ButtonShowcase({
  zone,
  variant,
  title,
}: ZoneProps & { variant: ButtonVariant; title: string }): ReactElement {
  return (
    <Showcase title={title}>
      <SpecimenGrid minColumnStyles={BUTTON_GRID}>
        {BUTTON_STATES.map(({ name, ...state }) => (
          <Specimen key={name} name={name} zone={zone}>
            <Button variant={variant} zone={zone} {...state}>
              {BUTTON_TEXT}
            </Button>
          </Specimen>
        ))}
        <Specimen name="Enlace" zone={zone}>
          <Button variant={variant} zone={zone} to="/">
            {LINK_TEXT}
          </Button>
        </Specimen>
        <Specimen name="Enlace deshabilitado" zone={zone}>
          <Button variant={variant} zone={zone} to="/" isDisabled>
            {LINK_TEXT}
          </Button>
        </Specimen>
      </SpecimenGrid>
    </Showcase>
  );
}

function IconButtonShowcase({ zone }: ZoneProps): ReactElement {
  return (
    <Showcase title="Botón de ícono">
      <SpecimenGrid minColumnStyles={ICON_GRID}>
        {POINTER_STATES.map(({ name, ...state }) => (
          <Specimen key={name} name={name} zone={zone}>
            <IconButton zone={zone} aria-label={ICON_LABEL} {...state}>
              <CloseIcon />
            </IconButton>
          </Specimen>
        ))}
      </SpecimenGrid>
    </Showcase>
  );
}

const FIELD_GRID = "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]";

function TextFieldShowcase({ zone }: ZoneProps): ReactElement {
  return (
    <Showcase title="Campo de texto">
      <SpecimenGrid minColumnStyles={FIELD_GRID}>
        <Specimen name="Normal" zone={zone}>
          <TextField zone={zone} label={FIELD_LABEL} name="normal" />
        </Specimen>
        <Specimen name="Hover" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="hover"
            previewState="hover"
          />
        </Specimen>
        <Specimen name="Foco" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="focus"
            previewState="focus"
            defaultValue={FIELD_VALUE}
          />
        </Specimen>
        <Specimen name="Deshabilitado" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="disabled"
            defaultValue={FIELD_VALUE}
            isDisabled
          />
        </Specimen>
        <Specimen name="Con error" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="error"
            error={FIELD_ERROR}
          />
        </Specimen>
        <Specimen name="Obligatorio, con ayuda" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="required"
            hint={FIELD_HINT}
            isRequired
          />
        </Specimen>
        <Specimen name="Con ayuda y error" zone={zone}>
          <TextField
            zone={zone}
            label={FIELD_LABEL}
            name="hint-error"
            hint={FIELD_HINT}
            error={FIELD_ERROR}
          />
        </Specimen>
      </SpecimenGrid>
    </Showcase>
  );
}

// Cada muestra va en una caja angosta marcada con `data-long-text`:
// Playwright comprueba que nada se sale de ella.
function LongTextShowcase({ zone }: ZoneProps): ReactElement {
  const boxStyles = "w-full max-w-[320px] min-w-0";
  return (
    <Showcase title="Texto largo">
      <div data-long-text className={boxStyles}>
        <Button zone={zone}>{LONG_BUTTON_TEXT}</Button>
      </div>
      <div data-long-text className={boxStyles}>
        <Button variant="secondary" zone={zone}>
          {LONG_BUTTON_TEXT}
        </Button>
      </div>
      <div data-long-text className={boxStyles}>
        <Eyebrow text={LONG_EYEBROW_TEXT} />
      </div>
      <div data-long-text className={boxStyles}>
        <AnnouncementBar messages={LONG_BAR_MESSAGES} />
      </div>
      <div data-long-text className={boxStyles}>
        <TextField
          zone={zone}
          label={LONG_FIELD_LABEL}
          name="long"
          error={LONG_FIELD_ERROR}
          isRequired
        />
      </div>
    </Showcase>
  );
}

function ZoneShowcase({
  zone,
  title,
  styles,
}: ZoneProps & { title: string; styles: string }): ReactElement {
  return (
    <section data-zone={zone} className={`pt-12 pb-16 ${styles}`}>
      <div className="mx-auto max-w-[1280px] px-4 min-[390px]:px-6">
        <h2 className="font-display text-[36px] leading-[0.95] uppercase">
          {title}
        </h2>
        {BUTTON_VARIANTS.map(({ variant, title: variantTitle }) => (
          <ButtonShowcase
            key={variant}
            zone={zone}
            variant={variant}
            title={variantTitle}
          />
        ))}
        <IconButtonShowcase zone={zone} />
        <TextFieldShowcase zone={zone} />
        <Showcase title="Eyebrow">
          <Eyebrow text={EYEBROW_TEXT} />
        </Showcase>
        <Showcase title="Barra de anuncios">
          <div className="w-full">
            <AnnouncementBar messages={BAR_MESSAGES} />
          </div>
        </Showcase>
        <LongTextShowcase zone={zone} />
      </div>
    </section>
  );
}

// Para comprobar en un navegador de verdad qué botones responden al clic.
function ClickCounter(): ReactElement {
  const [clickCount, setClickCount] = useState(0);
  const countClick = (): void => {
    setClickCount((count) => count + 1);
  };
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-16 min-[390px]:px-6">
      <h2 className="font-display text-[36px] leading-[0.95] uppercase">
        Clics
      </h2>
      <p className="mt-4 text-[16px]" data-testid="click-count">
        Clics recibidos: {clickCount}
      </p>
      <div className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-6">
        <Button onClick={countClick}>Contar un clic</Button>
        <Button onClick={countClick} isDisabled>
          No cuenta: deshabilitado
        </Button>
        <Button onClick={countClick} submittingLabel="Enviando">
          No cuenta: enviando
        </Button>
      </div>
    </section>
  );
}

export default function DevComponents(): ReactElement {
  return (
    <main>
      <header className="mx-auto max-w-[1280px] px-4 pt-12 pb-12 min-[390px]:px-6">
        <h1 className="font-display text-[44px] leading-[0.95] uppercase">
          Componentes
        </h1>
        <p className="mt-4 max-w-[70ch] text-[16px] leading-[1.5] text-ink-muted">
          Cada componente base en cada uno de sus estados. Los textos son de
          prueba.
        </p>
      </header>
      {ZONES.map(({ zone, title, styles }) => (
        <ZoneShowcase key={zone} zone={zone} title={title} styles={styles} />
      ))}
      <div className="pt-12">
        <ClickCounter />
      </div>
    </main>
  );
}
