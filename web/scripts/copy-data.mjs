// Copy the agents' output into public/ so the static site can load it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/data", { recursive: true });
for (const f of ["facts.json", "agents.json"]) copyFileSync(`../data/${f}`, `public/data/${f}`);
