import { describe, expect, it, vi } from "vitest";
import {
  ApiExplorerSettingsError,
  createRequestInterceptor,
  parseApiExplorerSettings,
  sendsToken,
} from "../src/api-explorer-settings";

const BASE = "https://portal.example.com/data/api";

describe("parseApiExplorerSettings", () => {
  it("sends the token to the spec's origin by default", () => {
    expect(
      parseApiExplorerSettings(
        { specUrl: "https://api.example.com/v3/api-docs" },
        BASE,
      ),
    ).toEqual({
      specUrl: "https://api.example.com/v3/api-docs",
      tokenOrigins: ["https://api.example.com"],
    });
  });

  it("resolves a relative specUrl against the page", () => {
    expect(
      parseApiExplorerSettings({ specUrl: "/test-api/openapi.json" }, BASE),
    ).toEqual({
      specUrl: "https://portal.example.com/test-api/openapi.json",
      tokenOrigins: ["https://portal.example.com"],
    });
  });

  it("reduces tokenOrigins to origins", () => {
    expect(
      parseApiExplorerSettings(
        {
          specUrl: "https://portal.example.com/test-api/openapi.json",
          tokenOrigins: [
            "http://localhost:8180/api",
            "https://api.example.com",
          ],
        },
        BASE,
      ).tokenOrigins,
    ).toEqual(["http://localhost:8180", "https://api.example.com"]);
  });

  it.each([
    [undefined, "config.json has no settings.specUrl"],
    [{}, "config.json has no settings.specUrl"],
    [{ specUrl: " " }, "config.json has no settings.specUrl"],
    [{ specUrl: 42 }, "config.json has no settings.specUrl"],
    [{ specUrl: "http://[" }, "settings.specUrl is not a valid URL"],
    [
      { specUrl: "/spec.json", tokenOrigins: "https://api.example.com" },
      "settings.tokenOrigins must be an array of URLs",
    ],
    [
      { specUrl: "/spec.json", tokenOrigins: [42] },
      "settings.tokenOrigins must be an array of URLs",
    ],
  ])("rejects %j", (settings, message) => {
    expect(() => parseApiExplorerSettings(settings, BASE)).toThrow(
      ApiExplorerSettingsError,
    );
    expect(() => parseApiExplorerSettings(settings, BASE)).toThrow(message);
  });
});

describe("sendsToken", () => {
  const origins = ["https://api.example.com"];

  it("allows a listed origin", () => {
    expect(
      sendsToken("https://api.example.com/api/orders", origins, BASE),
    ).toBe(true);
  });

  it.each([
    "https://evil.example.com/api/orders",
    "http://api.example.com/api/orders",
    "https://api.example.com:8443/api/orders",
    "https://api.example.com.evil.com/",
    "/api/orders",
    "http://[",
  ])("refuses %s", (url) => {
    expect(sendsToken(url, origins, BASE)).toBe(false);
  });
});

describe("createRequestInterceptor", () => {
  const origins = ["https://api.example.com"];

  it("adds the token to a request for a listed origin", async () => {
    const getToken = vi.fn(async () => "abc");
    const intercept = createRequestInterceptor(getToken, origins, BASE);
    const request = await intercept({
      headers: { accept: "*/*" },
      url: "https://api.example.com/api/orders",
    });

    expect(request.headers).toEqual({
      accept: "*/*",
      Authorization: "Bearer abc",
    });
  });

  it("asks for a token on every request, so a refreshed one is used", async () => {
    const getToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const intercept = createRequestInterceptor(getToken, origins, BASE);
    const url = "https://api.example.com/api/orders";
    await intercept({ url });
    const request = await intercept({ url });

    expect(request.headers?.Authorization).toBe("Bearer second");
  });

  it("sends no token to other origins, and doesn't ask for one", async () => {
    const getToken = vi.fn(async () => "abc");
    const intercept = createRequestInterceptor(getToken, origins, BASE);
    const request = await intercept({
      headers: {},
      url: "https://other.example.com/api/orders",
    });

    expect(request.headers).toEqual({});
    expect(getToken).not.toHaveBeenCalled();
  });

  it("adds no header when the portal has no token", async () => {
    const intercept = createRequestInterceptor(async () => "", origins, BASE);
    const request = await intercept({
      headers: {},
      url: "https://api.example.com/api/orders",
    });

    expect(request.headers).toEqual({});
  });

  it("adds headers to a request that has none", async () => {
    const intercept = createRequestInterceptor(
      async () => "abc",
      origins,
      BASE,
    );
    const request = await intercept({
      url: "https://api.example.com/v3/api-docs",
    });

    expect(request.headers).toEqual({ Authorization: "Bearer abc" });
  });
});
