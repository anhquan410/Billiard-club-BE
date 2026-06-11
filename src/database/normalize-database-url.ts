/**
 * Chuẩn hóa DATABASE_URL cho pg + Neon:
 * - sslmode verify-full (pg v8+)
 * - connect_timeout cho cold start / mạng chậm
 * - pgbouncer=true khi dùng Neon pooler endpoint
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');

    if (
      !sslmode ||
      sslmode === 'require' ||
      sslmode === 'prefer' ||
      sslmode === 'verify-ca'
    ) {
      url.searchParams.set('sslmode', 'verify-full');
    }

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '30');
    }

    const host = url.hostname.toLowerCase();
    if (host.includes('neon.tech') && host.includes('-pooler')) {
      url.searchParams.set('pgbouncer', 'true');
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}
