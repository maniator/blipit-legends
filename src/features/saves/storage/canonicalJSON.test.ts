import { describe, expect, it } from "vitest";

import { canonicalJSON } from "./canonicalJSON";

describe("canonicalJSON", () => {
  describe("key sorting", () => {
    it("sorts object keys lexicographically", () => {
      const result = canonicalJSON({ z: 1, a: 2, m: 3 });
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it("sorts keys at every level of nesting", () => {
      const result = canonicalJSON({ outer: { z: 1, a: 2 }, a: { z: 3, m: 4 } });
      expect(result).toBe('{"a":{"m":4,"z":3},"outer":{"a":2,"z":1}}');
    });

    it("produces no whitespace in output", () => {
      const result = canonicalJSON({ key: "value", num: 42 });
      expect(result).not.toMatch(/\s/);
    });

    it("handles single-key objects", () => {
      expect(canonicalJSON({ only: "one" })).toBe('{"only":"one"}');
    });

    it("handles empty objects", () => {
      expect(canonicalJSON({})).toBe("{}");
    });
  });

  describe("array handling — id-object arrays", () => {
    it("sorts arrays of objects with id fields by id ascending", () => {
      const input = [
        { id: "zzz", name: "Last" },
        { id: "aaa", name: "First" },
        { id: "mmm", name: "Middle" },
      ];
      const result = canonicalJSON(input);
      const parsed = JSON.parse(result) as Array<{ id: string }>;
      expect(parsed.map((x) => x.id)).toEqual(["aaa", "mmm", "zzz"]);
    });

    it("does not mutate the original array", () => {
      const input = [{ id: "z" }, { id: "a" }];
      canonicalJSON(input);
      expect(input[0].id).toBe("z");
      expect(input[1].id).toBe("a");
    });

    it("sorts keys within each element of an id-object array", () => {
      const input = [{ id: "b", z: 2, a: 1 }, { id: "a", z: 4, a: 3 }];
      const result = canonicalJSON(input);
      expect(result).toBe('[{"a":3,"id":"a","z":4},{"a":1,"id":"b","z":2}]');
    });
  });

  describe("array handling — non-id arrays", () => {
    it("preserves order for arrays of primitives", () => {
      const input = [3, 1, 2];
      expect(canonicalJSON(input)).toBe("[3,1,2]");
    });

    it("preserves order for arrays of strings", () => {
      const input = ["z", "a", "m"];
      expect(canonicalJSON(input)).toBe('["z","a","m"]');
    });

    it("preserves order for mixed arrays (no id field on all elements)", () => {
      const input = [{ id: "a" }, "notAnObject", 42];
      const result = canonicalJSON(input);
      const parsed = JSON.parse(result) as unknown[];
      // Mixed array — order preserved, no id-sort applied.
      expect(parsed[0]).toEqual({ id: "a" });
      expect(parsed[1]).toBe("notAnObject");
      expect(parsed[2]).toBe(42);
    });

    it("preserves order for empty arrays", () => {
      expect(canonicalJSON([])).toBe("[]");
    });
  });

  describe("nested recursion", () => {
    it("recursively processes nested objects inside arrays", () => {
      const input = [{ id: "b", props: { z: 1, a: 2 } }, { id: "a", props: { z: 3, a: 4 } }];
      const result = canonicalJSON(input);
      // Sorted by id: a first, then b. Keys inside props sorted.
      expect(result).toBe('[{"id":"a","props":{"a":4,"z":3}},{"id":"b","props":{"a":2,"z":1}}]');
    });

    it("handles deeply nested structures", () => {
      const input = { b: { d: { f: 1, e: 2 }, c: 3 }, a: 4 };
      const result = canonicalJSON(input);
      expect(result).toBe('{"a":4,"b":{"c":3,"d":{"e":2,"f":1}}}');
    });
  });

  describe("primitive handling", () => {
    it("handles null", () => {
      expect(canonicalJSON(null)).toBe("null");
    });

    it("handles boolean values", () => {
      expect(canonicalJSON(true)).toBe("true");
      expect(canonicalJSON(false)).toBe("false");
    });

    it("handles numbers", () => {
      expect(canonicalJSON(42)).toBe("42");
      expect(canonicalJSON(3.14)).toBe("3.14");
    });

    it("handles strings", () => {
      expect(canonicalJSON("hello")).toBe('"hello"');
    });
  });

  describe("determinism", () => {
    it("produces identical output on repeated calls with the same input", () => {
      const input = { z: [{ id: "b", x: 1 }, { id: "a", y: 2 }], a: { q: true, p: false } };
      const first = canonicalJSON(input);
      const second = canonicalJSON(input);
      expect(first).toBe(second);
    });

    it("produces different output for different inputs", () => {
      expect(canonicalJSON({ a: 1 })).not.toBe(canonicalJSON({ a: 2 }));
    });
  });
});
