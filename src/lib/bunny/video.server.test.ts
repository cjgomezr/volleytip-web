import { describe, expect, it } from "vitest";

import { readOrientation, readStatus } from "./video.server";

describe("bunny stream: orientación", () => {
  it("es vertical con el alto mayor que el ancho", () => {
    expect(readOrientation({ width: 1080, height: 1920 })).toBe("vertical");
  });

  it.each([90, 270, -90])(
    "es vertical un video apaisado con rotación de %i grados",
    (rotation) => {
      expect(readOrientation({ width: 1920, height: 1080, rotation })).toBe(
        "vertical",
      );
    },
  );

  it.each([null, 0, 180, -180, 360])(
    "es horizontal un video apaisado con rotación %j",
    (rotation) => {
      expect(readOrientation({ width: 1920, height: 1080, rotation })).toBe(
        "horizontal",
      );
    },
  );

  it("sigue vertical un video más alto que ancho aunque tenga rotación", () => {
    expect(readOrientation({ width: 1080, height: 1920, rotation: 90 })).toBe(
      "vertical",
    );
  });

  it("es horizontal un video cuadrado, también rotado", () => {
    expect(readOrientation({ width: 1080, height: 1080, rotation: 90 })).toBe(
      "horizontal",
    );
  });

  it.each([
    {},
    { width: 1920 },
    { height: 1920 },
    { width: 0, height: 0, rotation: 90 },
    { width: null, height: null, rotation: null },
    { width: "1080", height: "1920" },
  ])("con datos faltantes o raros (%j) es horizontal", (size) => {
    expect(readOrientation(size)).toBe("horizontal");
  });
});

describe("bunny stream: estado", () => {
  it.each([
    [0, "processing"],
    [1, "processing"],
    [2, "processing"],
    [3, "processing"],
    [4, "ready"],
    [5, "failed"],
    [6, "failed"],
    [7, "processing"],
    [8, "processing"],
  ])("traduce el estado %i de Bunny a %s", (bunnyStatus, expected) => {
    expect(readStatus(bunnyStatus)).toBe(expected);
  });

  it.each([9, 42, -1])(
    "cuenta como procesando un valor desconocido (%i)",
    (bunnyStatus) => {
      expect(readStatus(bunnyStatus)).toBe("processing");
    },
  );
});
