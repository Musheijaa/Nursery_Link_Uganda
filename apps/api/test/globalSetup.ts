import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** Starts one throwaway PostGIS database for the whole test run. Tests never touch DATABASE_URL. */
export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withDatabase('nurserylink_test')
    .withUsername('test')
    .withPassword('test')
    .start();
  project.provide('databaseUrl', container.getConnectionUri());
}

export async function teardown() {
  await container?.stop();
}
