import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { isTransientDbError, sleep } from './is-transient-db-error';
import { normalizeDatabaseUrl } from './normalize-database-url';

const CONNECT_RETRIES = 3;
const CONNECT_RETRY_DELAY_MS = 2_000;

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const normalizedUrl = normalizeDatabaseUrl(connectionString);
    const pool = new Pool({
      connectionString: normalizedUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 30_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      maxLifetimeSeconds: 60,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      this.logger.warn(`[pg pool] Kết nối idle bị ngắt: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    if (
      process.env.DATABASE_URL?.includes('neon.tech') &&
      !process.env.DATABASE_URL.includes('-pooler')
    ) {
      this.logger.warn(
        'Neon: nên dùng connection string có "-pooler" trong hostname để giảm timeout',
      );
    }

    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  private async connectWithRetry() {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Kết nối DB thành công sau ${attempt} lần thử`);
        }
        return;
      } catch (error) {
        lastError = error;
        if (!isTransientDbError(error) || attempt === CONNECT_RETRIES) {
          throw error;
        }
        this.logger.warn(
          `Kết nối DB thất bại (lần ${attempt}/${CONNECT_RETRIES}), thử lại...`,
        );
        await sleep(CONNECT_RETRY_DELAY_MS * attempt);
      }
    }
    throw lastError;
  }
}
