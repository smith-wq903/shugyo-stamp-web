import type { StampEntry, Subject } from "./db";

interface Props {
  year: number;
  month: number;
  stamps: StampEntry[];
  subjects: Subject[];
}

export default function Stats({ year, month, stamps, subjects }: Props) {
  // 週ごとにグループ化
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const weeks: Array<{ label: string; startDate: string; endDate: string }> = [];
  let d = 1;
  while (d <= daysInMonth) {
    const weekStart = d;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    // 週末（土曜日）まで or 月末まで
    const daysUntilSat = 6 - dayOfWeek;
    const weekEnd = Math.min(d + daysUntilSat, daysInMonth);
    weeks.push({
      label: `${month}/${weekStart}〜${month}/${weekEnd}`,
      startDate: `${year}-${String(month).padStart(2, "0")}-${String(weekStart).padStart(2, "0")}`,
      endDate: `${year}-${String(month).padStart(2, "0")}-${String(weekEnd).padStart(2, "0")}`,
    });
    d = weekEnd + 1;
  }

  const countInRange = (start: string, end: string) => {
    return stamps.filter((s) => s.date >= start && s.date <= end).length;
  };

  const monthTotal = stamps.length;

  return (
    <div className="stats">
      <h3 className="stats-title">しゅうけい</h3>
      <div className="stats-grid">
        {weeks.map((w, i) => (
          <div key={i} className="stats-row">
            <span className="stats-label">{w.label}</span>
            <span className="stats-value">{countInRange(w.startDate, w.endDate)}</span>
          </div>
        ))}
        <div className="stats-row stats-total">
          <span className="stats-label">{month}月 ごうけい</span>
          <span className="stats-value">{monthTotal}</span>
        </div>
      </div>
    </div>
  );
}
