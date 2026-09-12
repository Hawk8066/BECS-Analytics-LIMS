import "server-only";
import * as local from "./local";
import * as supabase from "./supabase";
import type { StorageDriver } from "./shared";

// Object storage, selected at boot by STORAGE_DRIVER (SSOT §14).
//
//   unset / "local"  -> ./storage on disk; the dev default, no cloud account needed
//   "supabase"       -> Supabase Storage; required in any cloud deployment
//
// Annotating as StorageDriver is the point of this file: if either driver drifts
// from the contract, this line stops compiling instead of failing at runtime on a
// user's upload.
//
// Note that storage keys are NOT migrated when the driver changes — an Attachment
// row written by one driver is only readable by that driver until the underlying
// file is copied across. See DEPLOYMENT.md.
const driver: StorageDriver =
  process.env.STORAGE_DRIVER === "supabase" ? supabase : local;

export const saveFile = driver.saveFile;
export const loadFile = driver.loadFile;
