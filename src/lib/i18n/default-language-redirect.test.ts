import { describe, expect, it } from "vitest";

import { redirectFromDefaultPrefix } from "./default-language-redirect";

function redirectOf(path: string): string | null {
  const response = redirectFromDefaultPrefix(new URL(`http://x.test${path}`));
  return response?.headers.get("Location") ?? null;
}

describe("redirección del prefijo /es", () => {
  it.each([
    ["/es", "/"],
    ["/es/", "/"],
    ["/es/tips?page=2&q=a", "/tips?page=2&q=a"],
    ["/es?x=1", "/?x=1"],
    ["/es//evil.com", "/evil.com"],
    ["/es///x", "/x"],
    ["/es/%5Cevil.com", "/%5Cevil.com"],
    ["/es/%2Fevil.com", "/%2Fevil.com"],
    ["/es/%2F%2Fevil.com", "/%2F%2Fevil.com"],
    ["/es\\evil.com", "/evil.com"],
    ["/es/a%20b", "/a%20b"],
    ["/es/es/tips", "/es/tips"],
  ])("%s lleva a %s con 301", (from, to) => {
    const response = redirectFromDefaultPrefix(new URL(`http://x.test${from}`));

    expect(response?.status).toBe(301);
    expect(redirectOf(from)).toBe(to);
  });

  // El analizador de URL resuelve `..` antes de llegar aquí: la dirección ya
  // no empieza por `/es`.
  it.each(["/", "/en/", "/espanol", "/esto", "/ES/", "/es/..//evil.com"])(
    "%s no se redirige",
    (path) => {
      expect(redirectOf(path)).toBeNull();
    },
  );
});
