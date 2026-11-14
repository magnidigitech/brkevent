/**
 * Time formatting helpers for Asia/Kolkata (IST: UTC+05:30)
 */

export function formatInKolkataTime(
  utcTimestamp: string | Date | null | undefined,
  options: { includeTime?: boolean; includeSeconds?: boolean } = { includeTime: true, includeSeconds: true }
): string {
  if (!utcTimestamp) return '—';

  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  if (isNaN(date.getTime())) return 'Invalid date';

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (options.includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
    if (options.includeSeconds) {
      formatOptions.second = '2-digit';
    }
    formatOptions.hour12 = true;
  }

  return new Intl.DateTimeFormat('en-IN', formatOptions).format(date);
}
