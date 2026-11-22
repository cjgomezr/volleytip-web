import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  type Money,
} from "./format";

const plain = (text: string): string => text.replace(/\u00a0/g, " ");

describe("dinero", () => {
  it("formatea COP en español sin decimales", () => {
    expect(formatMoney({ amount: 12_000_000, currency: "COP" }, "es")).toBe(
      "$120.000",
    );
  });

  it("formatea COP en inglés con el código de la moneda", () => {
    expect(
      plain(formatMoney({ amount: 12_000_000, currency: "COP" }, "en")),
    ).toBe("COP 120,000");
  });

  it("muestra los dos decimales de USD", () => {
    expect(plain(formatMoney({ amount: 1999, currency: "USD" }, "en"))).toBe(
      "$19.99",
    );
    expect(formatMoney({ amount: 1900, currency: "USD" }, "es")).toMatch(
      /19,00$/,
    );
  });

  it("formatea cero como $0 y no como texto vacío", () => {
    expect(formatMoney({ amount: 0, currency: "COP" }, "es")).toBe("$0");
  });

  it("conserva el signo de un monto negativo", () => {
    expect(formatMoney({ amount: -500_000, currency: "COP" }, "es")).toBe(
      "-$5.000",
    );
  });

  it("formatea -0 como cero sin signo", () => {
    expect(formatMoney({ amount: -0, currency: "COP" }, "es")).toBe("$0");
  });

  // Un descuento por porcentaje puede dejar centavos sueltos. El peso se
  // muestra sin decimales, así que se redondea al peso más cercano.
  it.each([
    [-40, "es", "$0"],
    [-40, "en", "COP 0"],
    [40, "es", "$0"],
    [-50, "es", "-$1"],
    [99, "es", "$1"],
    [12000049, "es", "$120.000"],
    [12000050, "es", "$120.001"],
  ] as const)(
    "redondea %i centavos de peso en %s a %s, sin signo si queda en cero",
    (amount, language, expected) => {
      expect(
        formatMoney({ amount, currency: "COP" }, language).replace(
          /\u00a0/g,
          " ",
        ),
      ).toBe(expected);
    },
  );

  it("conserva el signo de un dólar negativo", () => {
    expect(formatMoney({ amount: -1, currency: "USD" }, "en")).toBe("-$0.01");
  });

  it("no pinta signo en un dólar que queda en cero", () => {
    expect(formatMoney({ amount: -0, currency: "USD" }, "en")).toBe("$0.00");
  });

  it("usa los separadores del idioma en un monto grande", () => {
    expect(
      formatMoney({ amount: 123_456_789_000, currency: "COP" }, "es"),
    ).toBe("$1.234.567.890");
  });
});

describe("dinero: rechazos", () => {
  it.each([
    ["decimal", 10.5],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
    ["entero no seguro", Number.MAX_SAFE_INTEGER + 1],
  ])("falla con un monto %s", (_name, amount) => {
    expect(() => formatMoney({ amount, currency: "COP" }, "es")).toThrow(
      /entero/,
    );
  });

  it("falla nombrando una moneda desconocida", () => {
    const money = { amount: 100, currency: "EUR" } as unknown as Money;

    expect(() => formatMoney(money, "es")).toThrow(/EUR/);
  });

  it("rechaza una moneda en minúsculas", () => {
    const money = { amount: 100, currency: "cop" } as unknown as Money;

    expect(() => formatMoney(money, "es")).toThrow(/cop/);
  });
});

describe("dinero: tipos", () => {
  it("exige monto y moneda juntos", () => {
    // @ts-expect-error un número suelto no es dinero
    expect(() => formatMoney(100, "es")).toThrow();
  });
});

describe("fechas", () => {
  const instant = new Date("2026-03-05T15:00:00Z");

  it("escribe la fecha larga con el mes y el orden de cada idioma", () => {
    expect(formatDate(instant, "es")).toBe("5 de marzo de 2026");
    expect(formatDate(instant, "en")).toBe("March 5, 2026");
  });

  it("escribe la fecha corta en cada idioma", () => {
    expect(formatDate(instant, "es", { style: "short" })).toBe("5/03/26");
    expect(formatDate(instant, "en", { style: "short" })).toBe("3/5/26");
  });

  it("agrega la hora de Colombia cuando se pide", () => {
    expect(plain(formatDate(instant, "en", { withTime: true }))).toBe(
      "March 5, 2026 at 10:00 AM",
    );
  });

  it("muestra el día de Colombia cuando en UTC ya es el siguiente", () => {
    const lateNight = new Date("2026-03-06T03:00:00Z");

    expect(formatDate(lateNight, "es")).toBe("5 de marzo de 2026");
  });

  it("da lo mismo con el proceso en otra zona horaria", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Auckland";
      const inAuckland = formatDate(instant, "es", { withTime: true });
      process.env.TZ = "America/Los_Angeles";
      const inLosAngeles = formatDate(instant, "es", { withTime: true });

      expect(inAuckland).toBe(inLosAngeles);
      expect(plain(inAuckland)).toMatch(/10:00/);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("fechas: rechazos", () => {
  it("falla con una fecha inválida", () => {
    expect(() => formatDate(new Date("nope"), "es")).toThrow(/fecha/i);
  });
});

describe("números y duraciones", () => {
  it("separa los miles según el idioma", () => {
    expect(formatNumber(1_234_567, "es")).toBe("1.234.567");
    expect(formatNumber(1_234_567, "en")).toBe("1,234,567");
  });

  it("formatea menos de un minuto", () => {
    expect(formatDuration(5)).toBe("0:05");
  });

  it("formatea minutos y segundos", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it("incluye las horas cuando hay una o más", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("formatea cero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("falla con una duración negativa o no entera", () => {
    expect(() => formatDuration(-1)).toThrow(/duración/i);
    expect(() => formatDuration(1.5)).toThrow(/duración/i);
  });
});
