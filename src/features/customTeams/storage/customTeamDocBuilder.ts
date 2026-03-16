import type { CreateCustomTeamInput, CustomTeamDoc } from "@storage/types";

import { ROSTER_SCHEMA_VERSION, sanitizeAbbreviation } from "./customTeamSanitizers";
import { buildTeamFingerprint } from "./customTeamSignatures";

const SCHEMA_VERSION = 1;

/**
 * Builds a new `CustomTeamDoc` from already-validated input fields.
 * Pure function — no DB side-effects.
 * `input.name` must already be validated (non-empty, trimmed) by the caller before
 * calling this function.
 * Called by `createCustomTeam` in the store after name uniqueness is confirmed.
 */
export function buildNewTeamDoc(
  input: CreateCustomTeamInput,
  id: string,
  teamSeed: string,
): CustomTeamDoc {
  const now = new Date().toISOString();
  const sanitizedAbbrev =
    input.abbreviation !== undefined ? sanitizeAbbreviation(input.abbreviation) : undefined;
  const doc: CustomTeamDoc = {
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    name: input.name,
    ...(sanitizedAbbrev !== undefined && { abbreviation: sanitizedAbbrev }),
    ...(input.nickname !== undefined && { nickname: input.nickname }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.slug !== undefined && { slug: input.slug }),
    source: input.source ?? "custom",
    // Store empty embedded arrays — players live in the `players` collection.
    roster: { schemaVersion: ROSTER_SCHEMA_VERSION, lineup: [], bench: [], pitchers: [] },
    metadata: {
      ...(input.metadata?.notes !== undefined && { notes: input.metadata.notes }),
      ...(input.metadata?.tags !== undefined && { tags: input.metadata.tags }),
      archived: input.metadata?.archived ?? false,
    },
    ...(input.statsProfile !== undefined && { statsProfile: input.statsProfile }),
    teamSeed,
  };
  doc.fingerprint = buildTeamFingerprint(doc);
  return doc;
}
