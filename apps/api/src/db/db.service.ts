import { PgClient } from '@effect/sql-pg';
import * as PgDrizzle from 'drizzle-orm/effect-postgres';
import { Config, Context, Layer } from 'effect';
import type { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';

type DrizzleDb = PgDrizzle.EffectPgDatabase & {
  readonly $client: PgClient.PgClient;
};

export const Pg: Layer.Layer<PgClient.PgClient | SqlClient, Config.ConfigError | SqlError> =
  PgClient.layerConfig({
    url: Config.redacted('DB_URL'),
  });

export class DrizzleService extends Context.Service<DrizzleService, DrizzleDb>()(
  '@dropthing/DrizzleService'
) {
  static readonly layer: Layer.Layer<DrizzleService, Config.ConfigError | SqlError> = Layer.effect(
    DrizzleService,
    PgDrizzle.make()
  ).pipe(Layer.provide(PgDrizzle.DefaultServices), Layer.provide(Pg));
}
