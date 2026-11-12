import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
// Meteor's wallet code reads process.env, which only exists in Node.
(globalThis as unknown as { process: { env: Record<string, string> } }).process ??= { env: {} };
