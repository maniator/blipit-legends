import type { CreateCustomTeamInput, TeamRecord } from "@storage/types";

import { sanitizeAbbreviation } from "./customTeamSanitizers";
import { buildTeamFingerprint } from "./customTeamSignatures";

const SCHEMA_VERSION = 1;

/**
 * Builds a new `TeamRecord` (v1 schema) from already-validated input fields.
 * Pure function — no DB side-effects. `roster` is never embedded in the team
 * doc; players live in the dedicated `players` collection.
 * `input.name` must already be validated (non-empty, trimmed) by the caller.
 * Called by `createCustomTeam` in the store after name uniqueness is confirmed.
 */
export function buildNewTeamDoc(input: CreateCustomTeamInput, id: string): TeamRecord {
  const now = new Date().toISOString();
  const sanitizedAbbrev =
    input.abbreviation !== undefined ? sanitizeAbbreviation(input.abbreviation) : undefined;
  const doc: TeamRecord = {
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    name: input.name,
    nameLowercase: input.name.toLowerCase(),
    ...(sanitizedAbbrev !== undefined && { abbreviation: sanitizedAbbrev }),
    ...(input.nickname !== undefined && { nickname: input.nickname }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.slug !== undefined && { slug: input.slug }),
    metadata: {
      ...(input.metadata?.notes !== undefined && { notes: input.metadata.notes }),
      ...(input.metadata?.tags !== undefined && { tags: input.metadata.tags }),
      archived: input.metadata?.archived ?? false,
    },
    ...(input.statsProfile !== undefined && { statsProfile: input.statsProfile }),
    ...(input.autogen !== undefined && { autogen: input.autogen }),
  };
  doc.fingerprint = buildTeamFingerprint(doc);
  return doc;
}
