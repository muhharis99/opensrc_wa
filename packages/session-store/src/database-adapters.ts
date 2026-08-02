import type { SessionStore } from "./types";

/**
 * Contract for external relational adapters. MySQL/MariaDB/PostgreSQL drivers
 * are intentionally not bundled in the zero-dependency bootstrap. Production
 * adapters must implement SessionStore and parameterized transactions.
 */
export interface RelationalSessionStoreAdapter extends SessionStore {
  readonly dialect: "mysql" | "mariadb" | "postgresql";
  migrate(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
