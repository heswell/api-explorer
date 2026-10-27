import { RemoteModuleSettingsContext } from "@vuu-ui/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ApiExplorer from "../src/ApiExplorer";

describe("ApiExplorer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("explains a config.json with no specUrl", async () => {
    await act(async () => {
      root.render(
        <RemoteModuleSettingsContext.Provider value={{}}>
          <ApiExplorer />
        </RemoteModuleSettingsContext.Provider>,
      );
    });

    expect(container.textContent).toContain(
      "config.json has no settings.specUrl",
    );
  });

  it("explains a missing config when rendered outside the portal", async () => {
    await act(async () => {
      root.render(<ApiExplorer />);
    });

    expect(container.textContent).toContain(
      "config.json has no settings.specUrl",
    );
  });
});
