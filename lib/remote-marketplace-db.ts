import { createClient, type Client, type InValue } from "@libsql/client/web";
import type { D1Database, D1PreparedStatement } from "./marketplace-index";

// Preserve the D1 interface used by the indexer while making its events and
// cursor durable across serverless instances. Each batch commits atomically.
export function adaptLibsqlClient(client: Pick<Client, "execute" | "batch">): D1Database {
  class Statement implements D1PreparedStatement {
    constructor(readonly sql: string, readonly args: InValue[] = []) {}
    bind(...values: unknown[]) { return new Statement(this.sql, values as InValue[]); }
    async first<T>() {
      const result = await client.execute({ sql: this.sql, args: this.args });
      const row = result.rows[0];
      return row ? Object.fromEntries(result.columns.map(column => [column, row[column]])) as T : null;
    }
  }
  return {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      const results = await client.batch(statements.map(statement => {
        if (!(statement instanceof Statement)) throw new Error("Invalid marketplace database statement");
        return { sql: statement.sql, args: statement.args };
      }), "write");
      return results.map(result => ({ results: result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]]))) }));
    },
  };
}

export function createRemoteMarketplaceDb(url: string, authToken: string): D1Database {
  if (!/^(libsql|https):\/\//.test(url) || !authToken) throw new Error("Configure a remote marketplace database URL and token");
  return adaptLibsqlClient(createClient({ url, authToken, intMode: "number" }));
}
