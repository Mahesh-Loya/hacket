import { describe, expect, it } from "vitest";
import { projectFromHash, projectLink, shareOnX } from "./share";

describe("share", () => {
  it("links straight to a project", () => {
    expect(projectLink("https://site.app/", "abc-1")).toBe("https://site.app/#p=abc-1");
  });

  it("reads the project back from the link", () => {
    expect(projectFromHash("#p=abc-1")).toBe("abc-1");
    expect(projectFromHash("#picks-sec")).toBeNull();
    expect(projectFromHash("#p=<script>")).toBeNull();
  });

  it("builds an X post with the rank, link and hashtag", () => {
    const url = new URL(shareOnX("Nims", 212, 1220, "https://site.app/#p=abc"));
    expect(url.origin).toBe("https://x.com");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Nims");
    expect(text).toContain("#212 of 1220");
    expect(text).toContain("#NEARHackathon");
    expect(url.searchParams.get("url")).toBe("https://site.app/#p=abc");
  });
});
