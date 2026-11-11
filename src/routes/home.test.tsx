import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./home";

describe("home page", () => {
  it("renders a single main heading", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Aprende voley en");
  });

  it("shows the VolleyTip wordmark with alternative text", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toMatch(/<img[^>]+alt="VolleyTip"/);
  });

  it("links to the health check, the route that walks end to end", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toMatch(/<a[^>]+href="\/healthz"/);
  });
});
