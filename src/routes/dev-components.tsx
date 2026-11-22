import { useState, type ReactElement, type ReactNode } from "react";
import { data, Form, useNavigation } from "react-router";

import { AnnouncementBar } from "~/components/announcement-bar";
import { Button, type ButtonVariant } from "~/components/button";
import { Eyebrow } from "~/components/eyebrow";
import { FormProtection } from "~/components/form-protection";
import { IconButton } from "~/components/icon-button";
import { LanguageSwitcher } from "~/components/language-switcher";
import type { PreviewState, Zone } from "~/components/pressable";
import { PriceApproximation } from "~/components/price-approximation";
import { TextField } from "~/components/text-field";
import { serverEnv } from "~/lib/env.server";
import {
  issueFormProtection,
  processProtectedForm,
  type FormProtectionFields,
  type ProtectedFormResult,
} from "~/lib/forms/protected-form.server";
import { SAMPLE_FORM } from "~/lib/forms/sample-form.server";
import {
  calculateUsdApproximation,
  type UsdApproximation,
} from "~/lib/usd-approximation";

import type { Route } from "./+types/dev-components";

// Página de muestra de los componentes base (RF-12). Enseña cada uno en cada
// estado y es lo que Playwright captura como línea base visual. Los textos
// son datos de prueba, no contenido del sitio: por eso van escritos aquí y no
// en los archivos de traducción.

const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const TOO_MANY_REQUESTS_STATUS = 429;

type SampleStatus = ProtectedFormResult<unknown>["status"];

/** Lo que el formulario de ejemplo le devuelve a la página. */
interface SampleOutcome {
  readonly status: SampleStatus;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, string>>;
}

interface SampleLoaderData {
  readonly protection: FormProtectionFields;
}

const HTTP_STATUS: Record<SampleStatus, number> = {
  accepted: OK_STATUS,
  // A quien llenó el campo trampa se le responde como a un envío exitoso.
  discarded: OK_STATUS,
  too_fast: BAD_REQUEST_STATUS,
  verification_failed: BAD_REQUEST_STATUS,
  rate_limited: TOO_MANY_REQUESTS_STATUS,
  invalid: BAD_REQUEST_STATUS,
};

// No existe en producción. Un 404 y no una redirección: para un visitante,
// la página no está.
function rejectInProduction(): void {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
}

export function loader(): SampleLoaderData {
  rejectInProduction();
  return { protection: issueFormProtection(SAMPLE_FORM) };
}

export async function action({
  request,
}: Route.ActionArgs): Promise<ReturnType<typeof data<SampleOutcome>>> {
  rejectInProduction();
  const result = await processProtectedForm(request, SAMPLE_FORM);
  const outcome: SampleOutcome =
    result.status === "invalid"
      ? {
          status: result.status,
          fieldErrors: result.fieldErrors,
          values: result.values,
        }
      : { status: result.status, fieldErrors: {}, values: {} };
  return data(outcome, { status: HTTP_STATUS[result.status] });
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

// Un precio de muestra con una tasa de muestra: la página no lee la base.
const SAMPLE_COP_PER_USD = 4000;
const SAMPLE_PRICE_PESOS = 48_000;
const CENTS_PER_PESO = 100;
const SAMPLE_APPROXIMATIONS: readonly {
  name: string;
  approximation: UsdApproximation;
}[] = [
  {
    name: "Con aproximado",
    approximation: calculateUsdApproximation(
      { amount: SAMPLE_PRICE_PESOS * CENTS_PER_PESO, currency: "COP" },
      SAMPLE_COP_PER_USD,
    ),
  },
  {
    name: "Menos de un dólar",
    approximation: calculateUsdApproximation(
      { amount: CENTS_PER_PESO, currency: "COP" },
      SAMPLE_COP_PER_USD,
    ),
  },
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
    <figure className="flex min-w-0 flex-col items-start gap-3">
      {children}
      <figcaption
        className={`text-[11px] font-bold tracking-[0.08em] uppercase ${CAPTION_STYLES[zone]}`}
      >
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
          <Button variant={variant} zone={zone} to="home">
            {LINK_TEXT}
          </Button>
        </Specimen>
        <Specimen name="Enlace deshabilitado" zone={zone}>
          <Button variant={variant} zone={zone} to="home" isDisabled>
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
        <Showcase title="Precio aproximado">
          {SAMPLE_APPROXIMATIONS.map(({ name, approximation }) => (
            <Specimen key={name} name={name} zone={zone}>
              <PriceApproximation approximation={approximation} />
            </Specimen>
          ))}
        </Showcase>
        <Showcase title="Selector de idioma">
          <LanguageSwitcher zone={zone} />
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

// Para ver las cinco capas de la protección en un entorno real. El
// resultado se muestra tal cual lo devuelve el servidor.
function ProtectedFormSample({
  protection,
  outcome,
}: {
  protection: FormProtectionFields;
  outcome: SampleOutcome | undefined;
}): ReactElement {
  const navigation = useNavigation();
  const isSending = navigation.state !== "idle";
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-16 min-[390px]:px-6">
      <h2 className="font-display text-[36px] leading-[0.95] uppercase">
        Formulario protegido
      </h2>
      <Form
        method="post"
        noValidate
        className="mt-6 flex max-w-[420px] flex-col items-start gap-6"
      >
        <TextField
          label={FIELD_LABEL}
          name="email"
          type="email"
          autoComplete="email"
          isRequired
          defaultValue={outcome?.values.email}
          error={outcome?.fieldErrors.email}
        />
        <FormProtection
          siteKey={protection.siteKey}
          timestamp={protection.timestamp}
        />
        <Button
          type="submit"
          submittingLabel={isSending ? "Enviando" : undefined}
        >
          Enviar
        </Button>
      </Form>
      <p className="mt-6 text-[16px]" role="status" data-testid="form-result">
        Resultado: {outcome?.status ?? "sin enviar"}
      </p>
    </section>
  );
}

export default function DevComponents({
  loaderData,
  actionData,
}: Route.ComponentProps): ReactElement {
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
        <ProtectedFormSample
          protection={loaderData.protection}
          outcome={actionData}
        />
        <ClickCounter />
      </div>
    </main>
  );
}
