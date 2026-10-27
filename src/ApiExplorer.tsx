import { Banner, BannerContent } from "@salt-ds/core";
import { useIdentityToken, useRemoteModuleSettings } from "@vuu-ui/core";
import { type ComponentProps, useMemo } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import {
  type ApiExplorerSettings,
  createRequestInterceptor,
  parseApiExplorerSettings,
} from "./api-explorer-settings";

import "./ApiExplorer.css";

const classBase = "vuuApiExplorer";

type RequestInterceptor = NonNullable<
  ComponentProps<typeof SwaggerUI>["requestInterceptor"]
>;

/**
 * The portal supplies the user's token, so Swagger UI's own Authorize
 * button and dialog are hidden.
 */
const HidePortalAuthorization = () => ({
  wrapComponents: {
    authorizeBtn: () => () => null,
  },
});

const plugins = [HidePortalAuthorization];

const useApiExplorerSettings = ():
  | { settings: ApiExplorerSettings }
  | { error: string } => {
  const settings = useRemoteModuleSettings();
  return useMemo(() => {
    try {
      return {
        settings: parseApiExplorerSettings(settings, location.href),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [settings]);
};

const ApiExplorerView = ({ specUrl, tokenOrigins }: ApiExplorerSettings) => {
  const getIdentityToken = useIdentityToken();

  const requestInterceptor = useMemo<RequestInterceptor>(
    () =>
      createRequestInterceptor(getIdentityToken, tokenOrigins, location.href),
    [getIdentityToken, tokenOrigins],
  );

  return (
    <div className={classBase}>
      <SwaggerUI
        deepLinking={false}
        docExpansion="list"
        plugins={plugins}
        requestInterceptor={requestInterceptor}
        tryItOutEnabled
        url={specUrl}
      />
    </div>
  );
};

/**
 * Shows the OpenAPI document named by `settings.specUrl` in the module's
 * `config.json`. Requests to `settings.tokenOrigins` carry the user's token.
 */
const ApiExplorer = () => {
  const result = useApiExplorerSettings();
  if ("error" in result) {
    return (
      <div className={`${classBase}-error`}>
        <Banner status="error">
          <BannerContent>{result.error}</BannerContent>
        </Banner>
      </div>
    );
  }
  return <ApiExplorerView {...result.settings} />;
};

export default ApiExplorer;
