import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// React Router 8 pide Node 22.22 o más (docs/prd/w1-fundacion-tecnica.md,
// sección 9). Estos tests vigilan que el repo lo diga en un solo sentido:
// los cuatro paquetes en la misma versión mayor, y .nvmrc, engines y npm
// pidiendo el mismo Node.
const REACT_ROUTER_MAJOR = 8;
const REACT_ROUTER_PACKAGES = [
  "react-router",
  "@react-router/node",
  "@react-router/serve",
  "@react-router/dev",
] as const;
const MINIMUM_NODE = { major: 22, minor: 22 } as const;

interface PackageManifest {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly engines?: { readonly node?: string };
}

interface NodeVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function readManifest(): PackageManifest {
  return JSON.parse(readRepoFile("package.json")) as PackageManifest;
}

function findDeclaredRange(packageName: string): string {
  const { dependencies, devDependencies } = readManifest();
  const range = dependencies?.[packageName] ?? devDependencies?.[packageName];
  if (range === undefined) {
    throw new Error(`package.json no declara ${packageName}`);
  }
  return range;
}

function parseMajor(range: string): number {
  const major = /^[\^~]?(\d+)\./.exec(range)?.[1];
  if (major === undefined) {
    throw new Error(`No se puede leer la versión mayor de "${range}"`);
  }
  return Number(major);
}

/** Lee una versión completa de Node ("22.22.0", "v22.22.0", ">=22.22.0"),
 * ignorando espacios y saltos de línea alrededor. */
function parseNodeVersion(declared: string): NodeVersion {
  const match = /^(?:>=|v)?(\d+)\.(\d+)\.(\d+)$/.exec(declared.trim());
  if (match === null) {
    throw new Error(`"${declared}" no es una versión completa de Node`);
  }
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

function isAtLeastMinimumNode({ major, minor }: NodeVersion): boolean {
  if (major !== MINIMUM_NODE.major) {
    return major > MINIMUM_NODE.major;
  }
  return minor >= MINIMUM_NODE.minor;
}

describe("versiones de React Router", () => {
  it.each(REACT_ROUTER_PACKAGES)(
    `%s declara la versión mayor ${REACT_ROUTER_MAJOR}`,
    (packageName) => {
      expect(parseMajor(findDeclaredRange(packageName))).toBe(
        REACT_ROUTER_MAJOR,
      );
    },
  );
});

describe("versión mínima de Node", () => {
  it(".nvmrc exige 22.22 o más", () => {
    const declared = parseNodeVersion(readRepoFile(".nvmrc"));

    expect(isAtLeastMinimumNode(declared)).toBe(true);
  });

  it("engines.node pide como mínimo la misma versión que .nvmrc", () => {
    const enginesRange = readManifest().engines?.node;

    expect(enginesRange).toMatch(/^>=/);
    expect(parseNodeVersion(enginesRange ?? "")).toEqual(
      parseNodeVersion(readRepoFile(".nvmrc")),
    );
  });

  it("npm falla en vez de advertir cuando el Node es menor al mínimo", () => {
    const npmConfig = readRepoFile(".npmrc");

    expect(npmConfig).toMatch(/^engine-strict\s*=\s*true$/m);
  });

  it.each(["22.22.0", "22.22.0\n", "  22.22.0  \r\n", "v22.22.0\n"])(
    "lee %j igual aunque traiga espacios o un salto de línea final",
    (declared) => {
      expect(parseNodeVersion(declared)).toEqual({
        major: 22,
        minor: 22,
        patch: 0,
      });
    },
  );

  it.each(["", "22", "lts/jod", "22.22"])(
    "rechaza %j porque no fija una versión completa",
    (declared) => {
      expect(() => parseNodeVersion(declared)).toThrow(/versión completa/);
    },
  );

  it.each([
    ["22.21.9", false],
    ["22.22.0", true],
    ["22.23.5", true],
    ["21.99.0", false],
    ["24.0.0", true],
  ])("considera %s suficiente: %s", (declared, expected) => {
    expect(isAtLeastMinimumNode(parseNodeVersion(declared))).toBe(expected);
  });
});
