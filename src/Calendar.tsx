import { useState, useEffect, useCallback, Fragment } from "react";
import {
  fetchStamps,
  getSubjects,
  postStamp,
  removeStamp,
  Subject,
} from "./db";
import StampPicker from "./StampPicker";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface Props {
  onStreakChange: (streak: number) => void;
  subjectsVersion: number;
}

// date -> Map<subjectId, stamp>
type StampMap = Map<string, Map<number, string>>;

export default function Calendar({ onStreakChange, subjectsVersion }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stamps, setStamps] = useState<StampMap>(new Map());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [data, subs] = await Promise.all([
      fetchStamps(year, month),
      getSubjects(),
    ]);
    const map: StampMap = new Map();
    for (const s of data.stamps) {
      if (!map.has(s.date)) map.set(s.date, new Map());
      map.get(s.date)!.set(s.subject_id, s.stamp);
    }
    setStamps(map);
    setSubjects(subs);
    onStreakChange(data.streak);
  }, [year, month, onStreakChange, subjectsVersion]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number; dateStr: string } | null> = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  // 週ごとにグループ化
  const weeks: Array<Array<{ day: number; dateStr: string } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const allDone = (dateStr: string) => {
    const dayStamps = stamps.get(dateStr);
    if (!dayStamps || subjects.length === 0) return false;
    return subjects.every((s) => dayStamps.has(s.id));
  };

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button className="nav-btn" onClick={prevMonth}>
          ◀
        </button>
        <h2>
          {year}年 {month}月
        </h2>
        <button className="nav-btn" onClick={nextMonth}>
          ▶
        </button>
      </div>

      <div className="calendar-grid">
        {/* 曜日ヘッダー */}
        <div className="grid-label" />
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`weekday ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}
          >
            {w}
          </div>
        ))}

        {/* 週ごとの表示 */}
        {weeks.map((week, wi) => (
          <Fragment key={wi}>
            {/* 日付行 */}
            <div className="grid-label" />
            {week.map((cell, di) => (
              <div
                key={cell ? cell.dateStr : `empty-${wi}-${di}`}
                className={`day-number-cell${cell ? "" : " empty"}${cell && cell.dateStr === todayStr ? " today" : ""}${cell && allDone(cell.dateStr) ? " all-done" : ""}`}
                onClick={() => cell && setPickerDate(cell.dateStr)}
              >
                {cell?.day}
              </div>
            ))}

            {/* 項目ごとのスタンプ行 */}
            {subjects.map((sub, si) => (
              <Fragment key={`${wi}-${sub.id}`}>
                <div className={`grid-label subject-row-label${si === subjects.length - 1 ? " last-subject" : ""}`}>
                  {sub.name}
                </div>
                {week.map((cell, di) => (
                  <div
                    key={cell ? `${cell.dateStr}-${sub.id}` : `empty-${wi}-${di}-${sub.id}`}
                    className={`stamp-cell${cell ? "" : " empty"}${si === subjects.length - 1 ? " last-subject" : ""}`}
                    onClick={() => cell && setPickerDate(cell.dateStr)}
                  >
                    {cell ? (stamps.get(cell.dateStr)?.get(sub.id) ?? "") : ""}
                  </div>
                ))}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>

      {pickerDate && (
        <StampPicker
          date={pickerDate}
          subjects={subjects}
          stampsBySubject={stamps.get(pickerDate) || new Map()}
          onSelect={async (subjectId, stamp) => {
            await postStamp(pickerDate, subjectId, stamp);
            load();
          }}
          onRemove={async (subjectId) => {
            await removeStamp(pickerDate, subjectId);
            load();
          }}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  );
}
