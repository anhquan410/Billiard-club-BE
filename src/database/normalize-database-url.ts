/**
 * pg v8 cảnh báo khi dùng sslmode=require|prefer|verify-ca (sẽ đổi semantics ở pg v9).
 * Neon khuyến nghị SSL — chuẩn hóa sang verify-full để giữ hành vi hiện tại và hết warning.
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

    return url.toString();
  } catch {
    return connectionString;
  }
}
