/** A link that opens the site straight on one project. */
export function projectLink(base: string, id: string): string {
  return `${base.split("#")[0]}#p=${encodeURIComponent(id)}`;
}

/** The project id from a `#p=<id>` link, or null for any other hash. */
export function projectFromHash(hash: string): string | null {
  const m = /^#p=([a-z0-9-]{1,64})$/.exec(hash);
  return m ? m[1] : null;
}

/** An X "compose post" link a builder can use to share their project's rank. */
export function shareOnX(name: string, place: number | null, total: number, link: string): string {
  const rank = place ? `ranked #${place} of ${total}` : "ranked";
  const text = `My project ${name} is ${rank} by 5 AI judges on The Hackathon Market. Can you predict the winners better than them? #NEARHackathon`;
  return `https://x.com/intent/post?${new URLSearchParams({ text, url: link })}`;
}
