/**
 * Shared by the server action and the client form, so it must NOT be
 * `server-only` — `create.ts` is, and a client component cannot import that.
 */

/** Picker value meaning "create a new parameter instead of choosing one". */
export const NEW_PARAMETER = "__new__";
