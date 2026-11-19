import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Download, Search } from 'lucide-react';
import { Button, Card, Empty, PageLoader, StatusPill, fmtDate, scoreColor } from '../ui/ui.jsx';
import { Rich } from '../lib/Rich.jsx';
import { PageHeader, useFetch } from './AdminApp.jsx';

function toCsv(rows) {
  const head = ['תלמיד', 'כיתה', 'נושא', 'מבחן', 'ציון', 'נכונות', 'סה"כ', 'משך (דק׳)', 'תאריך'];
  const esc = (v) => `"${String(v ?? '').replace(/\$/g, '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.name, r.grade, r.topicTitle, r.exam_title, r.score, r.correct, r.total, Math.round(r.duration_sec / 60), new Date(r.ts).toLocaleString('he-IL')].map(esc).join(','));
  return '﻿' + [head.map(esc).join(','), ...lines].join('\n');
}

export default function Reports() {
  const navigate = useNavigate();
  const { data } = useFetch('/api/admin/exam-results');
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');

  const topics = useMemo(() => [...new Set((data?.results || []).map((r) => r.topicTitle).filter(Boolean))], [data]);
  const rows = useMemo(() => (data?.results || []).filter((r) => (!topic || r.topicTitle === topic) && (!q || r.name.includes(q))), [data, q, topic]);

  if (!data) return <PageLoader />;

  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null;
  const dist = [0, 0, 0, 0]; // <55, 55-69, 70-84, 85+
  rows.forEach((r) => { dist[r.score >= 85 ? 3 : r.score >= 70 ? 2 : r.score >= 55 ? 1 : 0] += 1; });
  const maxD = Math.max(1, ...dist);

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ציוני-מבחנים.csv';
    a.click();
  };

  return (
    <div className="animate-rise space-y-5">
      <PageHeader title="דוחות וציונים" subtitle="כל המבחנים שהוגשו בלומדה" icon={BarChart3} color="bg-st-teal"
        actions={<Button variant="soft" icon={Download} disabled={!rows.length} onClick={download}>ייצוא לאקסל (CSV)</Button>} />

      {data.results.length === 0 ? <Card><Empty icon={BarChart3} title="עוד לא הוגשו מבחנים">כשתלמידים יגישו מבחנים – הציונים יופיעו כאן.</Empty></Card> : (
        <>
          <div className="grid md:grid-cols-[260px_1fr] gap-4">
            <Card className="p-5 text-center">
              <div className="text-sm font-bold text-slate-500">ממוצע</div>
              <div className="text-5xl font-black mt-1">{avg ?? '—'}</div>
              <div className="text-xs text-slate-400 mt-1">{rows.length} מבחנים</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm font-bold text-slate-500 mb-3">התפלגות ציונים</div>
              <div className="flex items-end gap-4 h-28">
                {[['מתחת ל-55', 'bg-st-red'], ['55–69', 'bg-st-orange'], ['70–84', 'bg-st-blue'], ['85+', 'bg-st-green']].map(([l, c], i) => (
                  <div key={l} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                    <span className="text-xs font-black">{dist[i]}</span>
                    <div className={`w-full rounded-t-lg ${c}`} style={{ height: `${Math.max(4, (dist[i] / maxD) * 100)}%` }} />
                    <span className="text-[11px] text-slate-500 font-bold">{l}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-56 max-w-sm">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field !pr-10" placeholder="חיפוש תלמיד" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field !w-auto" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">כל הנושאים</option>
              {topics.map((t) => <option key={t} value={t}>{t.replace(/\$/g, '')}</option>)}
            </select>
          </div>

          <Card className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[820px]">
              <thead><tr className="text-xs text-slate-500 border-b border-line">
                <th className="p-3 text-right">תלמיד/ה</th><th className="p-2">נושא</th><th className="p-2">מבחן</th><th className="p-2">נכונות</th><th className="p-2">משך</th><th className="p-2">תאריך</th><th className="p-2 w-24">ציון</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="p-3"><button className="font-bold hover:text-[#0073ea] cursor-pointer" onClick={() => navigate(`/admin/students/${r.user_id}`)}>{r.name}</button><div className="text-xs text-slate-400">{r.grade}</div></td>
                    <td className="p-2 text-center"><Rich text={r.topicTitle} /></td>
                    <td className="p-2 text-center text-slate-600"><Rich text={r.exam_title} /></td>
                    <td className="p-2 text-center">{r.correct}/{r.total}</td>
                    <td className="p-2 text-center text-slate-500">{Math.max(1, Math.round(r.duration_sec / 60))} דק׳</td>
                    <td className="p-2 text-center text-xs text-slate-500">{fmtDate(r.ts)}</td>
                    <td className="p-1.5"><StatusPill cell className="rounded-lg" color={scoreColor(r.score)}>{r.score}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
