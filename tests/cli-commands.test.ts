import {describe, expect, it} from "vitest";

import {createCommandRegistry, parseCommandIntent} from "../src/cli/commands/index.js";

describe("CLI command registry", () => {
  it("parses local runtime commands", () => {
    const registry = createCommandRegistry();

    expect(parseCommandIntent("/config", registry)).toMatchObject({
      name: "config",
      scope: "runtime",
      args: [],
    });
    expect(parseCommandIntent("/workspace D:/work/app", registry)).toMatchObject({
      name: "workspace",
      scope: "runtime",
      args: ["D:/work/app"],
    });
    expect(parseCommandIntent("/edit create a file", registry)).toMatchObject({
      name: "edit",
      scope: "runtime",
      args: ["create", "a", "file"],
    });
  });
});
