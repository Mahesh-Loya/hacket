import { describe, expect, it } from "vitest";
import { label, type Project } from "./projects";

const nims: Project = {
  id: "fe292050-bdfa-482d-ab08-4d1355e49f3f",
  name: "Nims",
  url: "https://nearhunt.xyz/p/fe292050-bdfa-482d-ab08-4d1355e49f3f",
  tracks: ["games"],
  summary: "A market town.",
};
const byId = new Map([[nims.id, nims]]);

describe("label", () => {
  it("label_known_id", () => {
    expect(label(nims.id, byId)).toBe("Nims");
  });
  it("label_unknown_id", () => {
    expect(label("12345678-aaaa-bbbb", byId)).toBe("Unknown project (12345678…)");
  });
});

import { rankMap, safeUrl } from "./projects";

describe("rankMap", () => {
  it("breaks score ties by name like the Python agents do", () => {
    const projects = new Map<string, Project>([
      ["id-b", { ...nims, id: "id-b", name: "Bravo" }],
      ["id-a", { ...nims, id: "id-a", name: "alpha" }],
      ["id-c", { ...nims, id: "id-c", name: "Charlie" }],
    ]);
    const ranks = rankMap({ "id-b": 5, "id-c": 9, "id-a": 5 }, projects);
    expect([ranks.get("id-c"), ranks.get("id-a"), ranks.get("id-b")]).toEqual([1, 2, 3]);
  });
});

describe("safeUrl", () => {
  it("keeps https links", () => {
    expect(safeUrl("https://nearhunt.xyz/p/x")).toBe("https://nearhunt.xyz/p/x");
  });
  it("blocks javascript: and other schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("not a url")).toBe("#");
  });
});
