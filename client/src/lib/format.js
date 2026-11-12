// Small helpers for showing numbers and dates in a readable way.

export function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : value < 10 ? 2 : 1)} ${units[i]}`;
}

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
