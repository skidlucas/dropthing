// Upload constraints
export const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3 GB
/** Leaves headroom below D1's 2 MB row/value limit for metadata and SQLite overhead. */
export const MAX_TEXT_SIZE = 1024 * 1024;
export const MIN_TTL = 60; // 1 minute
export const MAX_TTL = 7 * 24 * 60 * 60; // 7 days
