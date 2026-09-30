// PostgREST / Postgres codes for schema that a migration hasn't created yet.
// Used to degrade gracefully between merging code and applying its migration.
type PgError = { code?: string } | null | undefined;

export const isMissingColumn = (e: PgError) => e?.code === "PGRST204" || e?.code === "42703";
export const isMissingTable = (e: PgError) => e?.code === "PGRST205" || e?.code === "42P01";
