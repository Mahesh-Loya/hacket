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
