/**
 * Deterministic JSON serializer for stable hashing and export signing.
 *
 * Guarantees:
 *   - Object keys are sorted lexicographically at every level of nesting.
 *   - No extraneous whitespace in the output.
 *   - Arrays whose every element is an object with an `id` string property are
 *     sorted by `id` ascending before serialisation.  All other arrays preserve
 *     their original order (sort is not semantically meaningful for primitives or
 *     mixed types).
 *   - Recursion is applied to all nested values.
 *
 * This is intentionally NOT a general-purpose JSON replacement — it is only
 * used for deterministic signature computation and export bundles.
 */

/**
 * Returns true when every element of the array is a plain object that has an
 * `id` property that is a string.  An empty array returns false (no sort needed).
 */
function isIdObjectArray(arr: unknown[]): arr is Array<{ id: string } & Record<string, unknown>> {
  return arr.length > 0 && arr.every((item) => item !== null && typeof item === "object" && typeof (item as Record<string, unknown>)["id"] === "string");
}

/**
 * Produces a deterministic JSON string for `value`.
 *
 * @param value  Any JSON-serialisable value.
 * @returns      Compact JSON string with sorted keys and id-sorted object arrays.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (isIdObjectArray(value)) {
      // Sort the array by id ascending before recursing.
      const sorted = [...value].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return "[" + sorted.map(canonicalJSON).join(",") + "]";
    }
    // Non-id-object array: preserve order, recurse into elements.
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => JSON.stringify(key) + ":" + canonicalJSON(obj[key]));
    return "{" + pairs.join(",") + "}";
  }

  // Primitive: number, string, boolean — delegate to native JSON.stringify.
  return JSON.stringify(value);
}
