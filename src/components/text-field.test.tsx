import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextField } from "./text-field";

function readAttribute(tag: string, name: string): string | undefined {
  return new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];
}

function findTag(html: string, tagName: string): string {
  const tag = new RegExp(`<${tagName}\\b[^>]*>`).exec(html)?.[0];
  if (tag === undefined) {
    throw new Error(`No hay <${tagName}> en el marcado`);
  }
  return tag;
}

function findElementById(html: string, id: string): string | undefined {
  return new RegExp(`<[a-z]+\\b[^>]* id="${id}"[^>]*>`).exec(html)?.[0];
}

function readDescribedBy(html: string): string[] {
  const value = readAttribute(findTag(html, "input"), "aria-describedby");
  return value === undefined ? [] : value.split(" ");
}

describe("Campo de texto", () => {
  it("la etiqueta y el campo quedan asociados", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" />,
    );
    const inputId = readAttribute(findTag(html, "input"), "id");

    expect(inputId).toBeDefined();
    expect(readAttribute(findTag(html, "label"), "for")).toBe(inputId);
    expect(html).toMatch(/<label [^>]*>Correo/);
  });

  it("pasa name, type, autoComplete y defaultValue al input", () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue="ana@ejemplo.co"
      />,
    );
    const input = findTag(html, "input");

    expect(readAttribute(input, "name")).toBe("email");
    expect(readAttribute(input, "type")).toBe("email");
    expect(readAttribute(input, "autoComplete")).toBe("email");
    expect(readAttribute(input, "value")).toBe("ana@ejemplo.co");
  });

  it("sin type es un campo de texto", () => {
    const html = renderToStaticMarkup(<TextField label="Nombre" name="name" />);

    expect(readAttribute(findTag(html, "input"), "type")).toBe("text");
  });

  it("lleva las medidas de la tabla: 52 px, radio de control, borde de 2 px, 16 px", () => {
    const input = findTag(
      renderToStaticMarkup(<TextField label="Nombre" name="name" />),
      "input",
    );

    expect(input).toContain("h-[52px]");
    expect(input).toContain("rounded-control");
    expect(input).toContain("border-2");
    expect(input).toContain("border-brand-night");
    expect(input).toContain("bg-surface-light");
    expect(input).toContain("text-[16px]");
    expect(input).toContain("px-4");
  });

  it("la etiqueta es un bloque de 14 px en negrita, a 6 px del campo", () => {
    const label = findTag(
      renderToStaticMarkup(<TextField label="Nombre" name="name" />),
      "label",
    );

    expect(label).toContain("block");
    expect(label).toContain("text-[14px]");
    expect(label).toContain("font-bold");
    expect(label).toContain("mb-1.5");
  });

  it("no contiene ningún texto propio: solo pinta los que recibe", () => {
    const html = renderToStaticMarkup(
      <TextField label="Nombre" name="name" hint="Como en tu documento" />,
    );
    const visibleText = html.replaceAll(/<[^>]+>/g, "");

    expect(visibleText).toBe("NombreComo en tu documento");
  });
});

describe("Campo de texto: error", () => {
  it("con error lleva aria-invalid y aria-describedby hacia el mensaje", () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Correo"
        name="email"
        error="Escribe un correo válido"
      />,
    );
    const [errorId] = readDescribedBy(html);

    expect(readAttribute(findTag(html, "input"), "aria-invalid")).toBe("true");
    expect(readDescribedBy(html)).toHaveLength(1);
    expect(findElementById(html, errorId ?? "")).toBeDefined();
    expect(html).toContain("Escribe un correo válido");
  });

  it("el mensaje de error lleva un ícono decorativo, no solo color", () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Correo"
        name="email"
        error="Escribe un correo válido"
      />,
    );

    expect(html).toMatch(/<svg [^>]*aria-hidden="true"/);
  });

  it("en zona clara el error va en brand-red-deep", () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Correo"
        name="email"
        zone="light"
        error="Escribe un correo válido"
      />,
    );

    expect(html).toContain("text-brand-red-deep");
  });

  it("sin error no lleva aria-invalid ni aria-describedby", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" />,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });

  it("un error vacío no cuenta como error", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" error="  " />,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });

  it("con ayuda y sin error enlaza solo la ayuda", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" hint="Te escribimos ahí" />,
    );
    const describedBy = readDescribedBy(html);

    expect(describedBy).toHaveLength(1);
    expect(findElementById(html, describedBy[0] ?? "")).toBeDefined();
    expect(html).not.toContain("aria-invalid");
  });

  it("con ayuda y error enlaza los dos, y los dos existen", () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Correo"
        name="email"
        hint="Te escribimos ahí"
        error="Escribe un correo válido"
      />,
    );
    const describedBy = readDescribedBy(html);

    expect(describedBy).toHaveLength(2);
    expect(new Set(describedBy).size).toBe(2);
    for (const id of describedBy) {
      expect(findElementById(html, id)).toBeDefined();
    }
  });
});

describe("Campo de texto: obligatorio y deshabilitado", () => {
  it("obligatorio lleva required y una marca visible además del color", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" isRequired />,
    );

    expect(findTag(html, "input")).toContain('required=""');
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>\s?\*<\/span>/);
  });

  it("sin isRequired no lleva required ni la marca", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" />,
    );

    expect(html).not.toContain("required");
    expect(html).not.toContain("*");
  });

  it("deshabilitado lleva disabled", () => {
    const html = renderToStaticMarkup(
      <TextField label="Correo" name="email" isDisabled />,
    );

    expect(findTag(html, "input")).toContain('disabled=""');
  });
});

describe("Campo de texto: tipos", () => {
  it("sin etiqueta no compila", () => {
    // @ts-expect-error -- el tipo exige label: un campo sin etiqueta no es accesible
    const withoutLabel = <TextField name="email" />;

    expect(withoutLabel).toBeDefined();
  });
});

describe("Campo de texto: ids", () => {
  it("dos campos en la misma página no comparten id", () => {
    const html = renderToStaticMarkup(
      <>
        <TextField label="Nombre" name="name" error="Falta el nombre" />
        <TextField label="Correo" name="email" error="Falta el correo" />
      </>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("Campo de texto: zonas", () => {
  it("en zona clara el anillo de foco pasa a brand-night", () => {
    const light = renderToStaticMarkup(
      <TextField label="Correo" name="email" zone="light" />,
    );
    const dark = renderToStaticMarkup(
      <TextField label="Correo" name="email" />,
    );

    expect(light).toContain("focused:outline-brand-night");
    expect(dark).not.toContain("focused:outline-brand-night");
  });
});
