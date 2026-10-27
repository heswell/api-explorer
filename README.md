# API Explorer

A [Vuu](https://github.com/finos/vuu) portal remote module that shows a REST
API from its OpenAPI document, using
[Swagger UI](https://github.com/swagger-api/swagger-ui), and lets users try
its operations with their portal sign-in.

## Requirements

The explorer reads its settings with `useRemoteModuleSettings()` from
`@vuu-ui/core`. That hook is not in a published release yet: it is on the
`remote-module-settings` branch of finos/vuu. Until a release includes it,
both the portal host and this module must be built against that branch's
`@vuu-ui/core`; with the published 4.0.0-alpha.31 the explorer reports that
`config.json` has no `settings.specUrl`.

To build and test locally against the branch, build `@vuu-ui/core` there and
install it without saving:

```sh
# in finos/vuu/vuu-ui, on remote-module-settings
cd packages/core && npm run build && npm run type-defs && cd ../..
npm pack ./dist/core

# here
npm install --no-save <path to>/vuu-ui-core-4.0.0-alpha.31.tgz
```

## Configuration

The explorer reads `settings` from the `config.json` published beside its
`mf-manifest.json`. The file is not content-hashed and is served with
`Cache-Control: no-cache`, so it can be edited on deployment without a
rebuild.

```json
{
  "settings": {
    "specUrl": "https://api.example.com/v3/api-docs",
    "tokenOrigins": ["https://api.example.com"]
  }
}
```

| Setting        | Required | Description                                                                                                                                                                  |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specUrl`      | yes      | The OpenAPI document, e.g. springdoc's `/v3/api-docs`. A relative URL resolves against the portal page.                                                                      |
| `tokenOrigins` | no       | Origins whose requests carry the user's Keycloak access token as `Authorization: Bearer …`. Defaults to the origin of `specUrl`. Requests to any other origin carry no token. |

The build writes `config.json` from `manifest.remote` in `portal-build.json`.
Until the API service exists it points at a test document,
[`public/test-api/openapi.json`](public/test-api/openapi.json), which the
module serves itself at `http://localhost:5008/test-api/openapi.json`. The
portal page fetches it from another origin, so whatever serves the module
must send `Access-Control-Allow-Origin` for it. Its `tokenOrigins` names
`http://localhost:8180`, the server the test document lists, which nothing
answers on.

The token is requested from the portal for every request, so a refreshed
token is always used. Swagger UI's own Authorize button is hidden, since the
portal supplies the token. The generated `curl` command shows the token.

## What the API service needs

For a Spring Boot service using springdoc:

1. **Accept Keycloak bearer tokens** with `spring-boot-starter-oauth2-resource-server`:

   ```yaml
   spring:
     security:
       oauth2:
         resourceserver:
           jwt:
             issuer-uri: https://keycloak.example.com/realms/vuu
   ```

   and `.oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))` in the
   `SecurityFilterChain`.

2. **Allow CORS from the portal origin**, for `/v3/api-docs` and the API
   itself, including the `OPTIONS` preflight that the `Authorization` header
   causes:

   ```java
   http.cors(c -> c.configurationSource(req -> {
       var cfg = new CorsConfiguration();
       cfg.setAllowedOrigins(List.of("https://portal.example.com"));
       cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
       cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
       return cfg;
   }));
   ```

3. **Declare the bearer scheme**, so that operations show as secured:

   ```java
   @SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP,
                   scheme = "bearer", bearerFormat = "JWT")
   @SecurityRequirement(name = "bearerAuth")
   ```

4. **Check the server URL** in the generated document. springdoc derives it
   from the incoming request; behind a proxy, set
   `server.forward-headers-strategy=framework` so that it is the public URL.

## Styling

Swagger UI's stylesheet is used as it is, on a light background in every
portal theme. A stylesheet in the portal's theme is to follow from design.

## Build and run

```sh
npm install
npm run build      # writes dist/
npm start          # serves dist/ on port 5008
npm test
npm run typecheck
```

The portal loads the module from `http://localhost:5008`, as registered in
the portal server's module registry (`mfScope: apiExplorer`,
`mfComponent: ApiExplorer`). It is under Data → API in the portal nav, for
users with the `api-explorer-access` role.
