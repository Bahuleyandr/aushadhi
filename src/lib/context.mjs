export function ctx() {
  return { rawRoot: 'data/raw', distRoot: 'dist', date: new Date().toISOString().slice(0, 10) };
}
