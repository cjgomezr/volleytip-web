import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, data } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppAvailability } from "~/lib/app-availability.server";
import type { WaitlistOutcome } from "~/lib/forms/waitlist-form.server";
import { getMessages } from "~/lib/i18n/messages.server";
import { TranslationsProvider } from "~/lib/i18n/translations-context";

import { RoutineLinkPage } from "./routine-link-page";

vi.mock("~/lib/app-availability.server", () => ({
  readAppAvailability: vi.fn(),
}));
vi.mock("~/lib/forms/waitlist-form.server", () => ({
  WAITLIST_FORM: {},
  handleWaitlistSubmission: vi.fn(),
}));
vi.mock("~/lib/forms/protected-form.server", () => ({
  issueFormProtection: () => ({ siteKey: "k", timestamp: "t" }),
}));
const { readAppAvailability } = await import("~/lib/app-availability.server");
const { handleWaitlistSubmission } =
  await import("~/lib/forms/waitlist-form.server");
const { action, loader, meta } = await import("./routine-link");

const PROTECTION = { siteKey: "k", timestamp: "t" };
const WAITLIST: AppAvailability = { state: "waitlist" };
const APP_STORE = "https://apps.apple.com/co/app/volleytip/id123";

afterEach(() => {
  vi.mocked(readAppAvailability).mockReset();
  vi.mocked(handleWaitlistSubmission).mockReset();
});

function callLoader(path: string): ReturnType<typeof loader> {
  const code = path.split("/").at(-1) ?? "";
  return loader({
    request: new Request(`http://localhost${path}`),
    params: { code: decodeURIComponent(code) },
  } as Parameters<typeof loader>[0]);
}

async function catchResponse(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("No lanzó nada");
}

function render(
  availability: AppAvailability,
  language: "es" | "en" = "es",
): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          <RoutineLinkPage
            availability={availability}
            protection={PROTECTION}
            outcome={undefined}
          />
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/r/abc123"]} />);
}

describe("/r/: loader", () => {
  it("con un código válido devuelve la página, sin el código", async () => {
    vi.mocked(readAppAvailability).mockResolvedValue(WAITLIST);

    const data = await callLoader("/r/abc123");

    expect(data.availability).toEqual(WAITLIST);
    expect(JSON.stringify(data)).not.toContain("abc123");
  });

  it("dos códigos distintos dan los mismos datos", async () => {
    vi.mocked(readAppAvailability).mockResolvedValue(WAITLIST);

    expect(await callLoader("/r/abc123")).toEqual(await callLoader("/r/zzz"));
  });

  it("da los textos en el idioma de la dirección", async () => {
    vi.mocked(readAppAvailability).mockResolvedValue(WAITLIST);

    const spanish = await callLoader("/r/abc123");
    const english = await callLoader("/en/r/abc123");

    expect(spanish.title).not.toBe(english.title);
  });

  it.each([
    ["con 65 caracteres", `/r/${"a".repeat(65)}`],
    ["con caracteres raros", "/r/a.b"],
    ["con una barra dentro", "/r/a%2Fb"],
  ])("responde 404 con un código %s", async (_name, path) => {
    const error = await catchResponse(callLoader(path));

    expect(error).toMatchObject({ init: { status: 404 } });
  });

  it("acepta 64 caracteres", async () => {
    vi.mocked(readAppAvailability).mockResolvedValue(WAITLIST);

    await expect(callLoader(`/r/${"a".repeat(64)}`)).resolves.toBeDefined();
  });

  it("con la app disponible devuelve las tiendas", async () => {
    const available: AppAvailability = {
      state: "available",
      appStoreUrl: APP_STORE,
      playStoreUrl: null,
    };
    vi.mocked(readAppAvailability).mockResolvedValue(available);

    expect((await callLoader("/r/abc123")).availability).toEqual(available);
  });
});

describe("/r/: action", () => {
  it("inscribe el correo en la lista de la app", async () => {
    vi.mocked(handleWaitlistSubmission).mockResolvedValue(
      data<WaitlistOutcome>({ status: "joined" }),
    );
    const request = new Request("http://localhost/r/abc123", {
      method: "POST",
    });

    await action({ request } as Parameters<typeof action>[0]);

    expect(handleWaitlistSubmission).toHaveBeenCalledWith(request, "app");
  });
});

describe("/r/: meta", () => {
  it("lleva noindex", () => {
    const descriptors = meta({
      loaderData: { title: "t", description: "d" },
    } as Parameters<typeof meta>[0]);

    expect(descriptors).toContainEqual({ name: "robots", content: "noindex" });
  });
});

describe("/r/: página", () => {
  it("en lista de espera muestra Próximamente y el formulario", () => {
    const html = render(WAITLIST);

    expect(html).toContain("Próximamente");
    expect(html).toContain('name="email"');
  });

  it("sale en inglés en /en/", () => {
    const html = render(WAITLIST, "en");

    expect(html).toContain("Coming soon");
  });

  it("con la app disponible muestra las tiendas y no el formulario", () => {
    const html = render({
      state: "available",
      appStoreUrl: APP_STORE,
      playStoreUrl: null,
    });

    expect(html).toContain(APP_STORE);
    expect(html).not.toContain('name="email"');
  });
});
