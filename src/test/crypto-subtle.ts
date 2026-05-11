// RxDB validates `globalThis.crypto.subtle` while importing database helpers.
// Keep this in its own first setup file so the polyfill runs before setup.ts
// imports RxDB modules.
import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
} else if (typeof globalThis.crypto.subtle === "undefined") {
  Object.defineProperty(globalThis.crypto, "subtle", {
    value: webcrypto.subtle,
    configurable: true,
    writable: true,
  });
}
