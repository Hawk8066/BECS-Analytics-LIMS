/**
 * Shared by the reset action and its confirmation form, so it must not be
 * `server-only` and must not live in the `"use server"` action module, where
 * only async functions may be exported.
 */

/** Typed verbatim to arm the lot reset — a misclick must not wipe the register. */
export const RESET_PHRASE = "DELETE ALL LOTS";
