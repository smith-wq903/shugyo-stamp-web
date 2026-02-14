import { useState, useEffect, useCallback, Fragment } from "react";
import {
  fetchStamps,
  getSubjects,
  getCustomStamps,
  postStamp,
  removeStamp,
  Subject,
  CustomStamp,
  StampEntry,
} from "./db";
import StampPicker from "./StampPicker";
import Stats from "./Stats";

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
  const [rawStamps, setRawStamps] = useState<StampEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [customStamps, setCustomStamps] = useState<CustomStamp[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [data, subs, cs] = await Promise.all([
      fetchStamps(year, month),
      getSubjects(),
      getCustomStamps(),
    ]);
    const map: StampMap = new Map();
    for (const s of data.stamps) {
      if (!map.has(s.date)) map.set(s.date, new Map());
      map.get(s.date)!.set(s.subject_id, s.stamp);
    }
    setStamps(map);
    setRawStamps(data.stamps);
    setSubjects(subs);
    setCustomStamps(cs);
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

  // カスタムスタンプの画像をカレンダーセルに表示するヘルパー
  const customStampMap = new Map(customStamps.map((cs) => [`custom:${cs.id}`, cs.image]));

  const renderCellStamp = (stampKey: string) => {
    if (stampKey.startsWith("custom:")) {
      const img = customStampMap.get(stampKey);
      if (img) return <img src={img} alt="" width={14} height={14} className="stamp-img-cell" />;
    }
    return <>{stampKey}</>;
  };

  return (
    <>
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
          <div className="grid-label" />
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`weekday ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}
            >
              {w}
            </div>
          ))}

          {weeks.map((week, wi) => (
            <Fragment key={wi}>
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

              {subjects.map((sub, si) => (
                <Fragment key={`${wi}-${sub.id}`}>
                  <div className={`grid-label subject-row-label${si === subjects.length - 1 ? " last-subject" : ""}`}>
                    {sub.name}
                  </div>
                  {week.map((cell, di) => {
                    const stampKey = cell ? stamps.get(cell.dateStr)?.get(sub.id) : undefined;
                    return (
                      <div
                        key={cell ? `${cell.dateStr}-${sub.id}` : `empty-${wi}-${di}-${sub.id}`}
                        className={`stamp-cell${cell ? "" : " empty"}${si === subjects.length - 1 ? " last-subject" : ""}`}
                        onClick={() => cell && setPickerDate(cell.dateStr)}
                      >
                        {stampKey ? renderCellStamp(stampKey) : ""}
                      </div>
                    );
                  })}
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
            customStamps={customStamps}
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

      <Stats year={year} month={month} stamps={rawStamps} subjects={subjects} />
    </>
  );
}
