import fs from 'node:fs/promises';
const root = 'artifacts/professional-performance/';
const before = JSON.parse(await fs.readFile(root + 'runtime-before.json', 'utf8'));
const after = JSON.parse(await fs.readFile(root + 'runtime-after.json', 'utf8'));
const median = values => { const sorted = [...values].sort((a,b) => a-b); return sorted[Math.floor(sorted.length / 2)]; };
const summary = values => ({ median: median(values), min: Math.min(...values), max: Math.max(...values) });
const rows = [];
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (const delay of [0, 150]) for (const label of [...new Set(before.results.map(row => row.label))]) {
  const subset = source => source.results.filter(row => row.width === width && row.theme === theme && row.delay === delay && row.label === label);
  const b = subset(before), a = subset(after);
  if (b.length !== 3 || a.length !== 3) throw new Error('Incomplete samples');
  const measures = source => ({ usefulMs: summary(source.map(row => row.usefulMs)), settledMs: summary(source.map(row => row.settledMs)), calls: summary(source.map(row => row.calls.length)), commits: summary(source.map(row => row.commits)), renderMs: summary(source.map(row => row.renderMs)), skeletonMs: summary(source.map(row => row.skeletonMs)), shellsRemoved: summary(source.map(row => row.shellsRemoved)), longTaskMs: summary(source.map(row => row.longTaskMs)) });
  rows.push({ width, theme, delay, label, before: measures(b), after: measures(a) });
}
const result = { environment: after.environment, errors: [...before.results, ...after.results].flatMap(row => row.errors), rows };
await fs.writeFile(root + 'runtime-comparison.json', JSON.stringify(result, null, 2));
for (const row of rows.filter(row => row.width === 1440 && row.theme === 'light' && row.delay === 150)) console.log(JSON.stringify(row));
