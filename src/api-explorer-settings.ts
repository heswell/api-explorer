import type { RemoteModuleSettings } from "@vuu-ui/core";

/** The API Explorer's `settings` in its `config.json`. */
export interface ApiExplorerSettings {
  /** The OpenAPI document, e.g. a springdoc `/v3/api-docs` endpoint. */
  specUrl: string;
  /**
   * Origins that receive the user's bearer token. Defaults to the origin of
   * `specUrl`. Requests to any other origin are sent without it.
   */
  tokenOrigins: string[];
}

export class ApiExplorerSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiExplorerSettingsError";
  }
}

const toUrl = (value: string, name: string, base: string) => {
  try {
    return new URL(value, base);
  } catch {
    throw new ApiExplorerSettingsError(`${name} is not a valid URL: ${value}`);
  }
};

/**
 * Validates the settings from `config.json`. Relative URLs resolve against
 * `base`, the page's location.
 */
export const parseApiExplorerSettings = (
  settings: RemoteModuleSettings | undefined,
  base: string,
): ApiExplorerSettings => {
  const specUrl = settings?.specUrl;
  if (typeof specUrl !== "string" || specUrl.trim() === "") {
    throw new ApiExplorerSettingsError(
      "config.json has no settings.specUrl, the URL of the OpenAPI document",
    );
  }
  const spec = toUrl(specUrl, "settings.specUrl", base);

  const { tokenOrigins } = settings ?? {};
  if (
    tokenOrigins !== undefined &&
    (!Array.isArray(tokenOrigins) ||
      tokenOrigins.some((origin) => typeof origin !== "string"))
  ) {
    throw new ApiExplorerSettingsError(
      "settings.tokenOrigins must be an array of URLs",
    );
  }
  return {
    specUrl: spec.href,
    tokenOrigins: tokenOrigins
      ? (tokenOrigins as string[]).map(
          (origin) => toUrl(origin, "settings.tokenOrigins", base).origin,
        )
      : [spec.origin],
  };
};

/** True when a request to `url` may carry the user's token. */
export const sendsToken = (
  url: string,
  tokenOrigins: readonly string[],
  base: string,
) => {
  try {
    return tokenOrigins.includes(new URL(url, base).origin);
  } catch {
    return false;
  }
};

interface InterceptedRequest {
  [key: string]: unknown;
  headers?: Record<string, string>;
  url?: unknown;
}

/**
 * A Swagger UI `requestInterceptor` that adds the user's bearer token to
 * requests for `tokenOrigins`, including the OpenAPI document itself when
 * its origin is listed. An empty token, as in the local portal, adds none.
 */
export const createRequestInterceptor =
  (
    getToken: () => Promise<string>,
    tokenOrigins: readonly string[],
    base: string,
  ) =>
  async <T extends InterceptedRequest>(
    request: T,
  ): Promise<T & Pick<InterceptedRequest, "headers">> => {
    if (sendsToken(String(request.url), tokenOrigins, base)) {
      const token = await getToken();
      if (token) {
        request.headers = {
          ...request.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }
    return request;
  };
