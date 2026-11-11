import { describe, expect, it } from "vitest";
import { loader } from "./healthz";

describe("GET /healthz", () => {
  it("responds 200 with an ok status in JSON", async () => {
    const response = loader();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("asks not to be cached, so monitoring always reaches the server", () => {
    const response = loader();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
