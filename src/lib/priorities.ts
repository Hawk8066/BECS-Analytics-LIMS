// Shared priority levels for requisitions / requests.
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY: Priority = "Normal";
