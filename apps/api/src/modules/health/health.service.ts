import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthReport {
  readonly status: HealthStatus;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
  readonly checks: readonly HealthCheck[];
}

export interface HealthCheck {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs: number;
  readonly message?: string;
}

/**
 * Liveness and readiness probes.
 *
 * The distinction matters operationally:
 *  - **liveness** answers "is the process wedged?" and must not touch the
 *    database, or a brief database blip would restart every healthy pod
 *  - **readiness** answers "should traffic be routed here?" and therefore does
 *    check the database, reporting `degraded` rather than throwing so the
 *    orchestrator can drain instead of kill
 */
@Injectable()
export class HealthService {
  private readonly bootedAt = Date.now();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async readiness(): Promise<HealthReport> {
    const checks: HealthCheck[] = [await this.databaseCheck()];
    return this.report(checks);
  }

  liveness(): HealthReport {
    return this.report([]);
  }

  private async databaseCheck(): Promise<HealthCheck> {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { name: 'database', status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        name: 'database',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private report(checks: readonly HealthCheck[]): HealthReport {
    const status: HealthStatus = checks.some((check) => check.status === 'error')
      ? 'error'
      : checks.some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'ok';

    return {
      status,
      uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
