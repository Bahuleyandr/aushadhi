export function ctx() {
  return {
    rawRoot: process.env.AUSHADHI_RAW_ROOT ?? 'data/raw',
    distRoot: process.env.AUSHADHI_DIST_ROOT ?? 'dist',
    date: new Date().toISOString().slice(0, 10),
  };
}
