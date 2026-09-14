import fs from 'node:fs';
import { loadStudyRecords } from '../src/lib/loadData.js';
import { subjectTrends, syncPairs } from '../src/lib/diagnose.js';

const { records } = loadStudyRecords(fs.readFileSync('public/data/学习记录示例.csv', 'utf8'));
for (const t of subjectTrends(records)) {
  const a = t.accuracyChange;
  const m = t.minutesChange;
  const acc = a ? a.date + ' ' + a.direction + ' ' + (a.delta * 100).toFixed(2) + 'pt' : 'null';
  const min = m
    ? m.date + ' ' + m.direction + ' ' + m.meanBefore.toFixed(1) + '->' + m.meanAfter.toFixed(1) +
      ' (' + (((m.meanAfter - m.meanBefore) / m.meanBefore) * 100).toFixed(0) + '%)'
    : 'null';
  console.log(t.subject.padEnd(4), '正确率', acc, '| 时长', min);
}
console.log('pairs =', JSON.stringify(syncPairs(subjectTrends(records))));
