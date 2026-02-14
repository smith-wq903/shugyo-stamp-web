import { useState } from "react";
import type { Subject } from "./db";

const STAMPS = ["⭐", "🌟", "💮", "🎉", "💯"];

interface Props {
  date: string;
  subjects: Subject[];
  stampsBySubject: Map<number, string>;
  onSelect: (subjectId: number, stamp: string) => void;
  onRemove: (subjectId: number) => void;
  onClose: () => void;
}

export default function StampPicker({
  date,
  subjects,
  stampsBySubject,
  onSelect,
  onRemove,
  onClose,
}: Props) {
  const [selections, setSelections] = useState<Map<number, string>>(() => {
    return new Map(stampsBySubject);
  });

  const dayLabel = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  })();

  const toggleStamp = (subjectId: number, stamp: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(subjectId) === stamp) {
        next.delete(subjectId);
      } else {
        next.set(subjectId, stamp);
      }
      return next;
    });
  };

  const handleSave = () => {
    for (const [subjectId, stamp] of selections) {
      if (stampsBySubject.get(subjectId) !== stamp) {
        onSelect(subjectId, stamp);
      }
    }
    for (const [subjectId] of stampsBySubject) {
      if (!selections.has(subjectId)) {
        onRemove(subjectId);
      }
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-subjects" onClick={(e) => e.stopPropagation()}>
        <h2>{dayLabel}</h2>
        <div className="subject-list">
          {subjects.map((sub) => (
            <div key={sub.id} className="subject-row">
              <span className="subject-name">{sub.name}</span>
              <div className="stamp-grid-inline">
                {STAMPS.map((s) => (
                  <button
                    key={s}
                    className={`stamp-btn-sm ${selections.get(sub.id) === s ? "selected" : ""}`}
                    onClick={() => toggleStamp(sub.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            もどる
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            ほぞん
          </button>
        </div>
      </div>
    </div>
  );
}
