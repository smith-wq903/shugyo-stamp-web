import { useState } from "react";
import type { Subject, CustomStamp } from "./db";

const EMOJI_STAMPS = ["⭐", "🌟", "💮", "🎉", "💯", "🔥", "💪", "👏", "🏅", "💎"];

interface Props {
  date: string;
  subjects: Subject[];
  stampsBySubject: Map<number, string>;
  customStamps: CustomStamp[];
  onSelect: (subjectId: number, stamp: string) => void;
  onRemove: (subjectId: number) => void;
  onClose: () => void;
}

export default function StampPicker({
  date,
  subjects,
  stampsBySubject,
  customStamps,
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

  // カスタムスタンプの識別子: "custom:ID"
  const allStamps: Array<{ key: string; display: string | { image: string } }> = [
    ...EMOJI_STAMPS.map((e) => ({ key: e, display: e as string | { image: string } })),
    ...customStamps.map((cs) => ({
      key: `custom:${cs.id}`,
      display: { image: cs.image } as string | { image: string },
    })),
  ];

  const toggleStamp = (subjectId: number, stampKey: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(subjectId) === stampKey) {
        next.delete(subjectId);
      } else {
        next.set(subjectId, stampKey);
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

  const renderStamp = (s: { key: string; display: string | { image: string } }, size: "sm" | "lg") => {
    if (typeof s.display === "string") {
      return <span>{s.display}</span>;
    }
    const px = size === "sm" ? 24 : 32;
    return <img src={s.display.image} alt="" width={px} height={px} className="stamp-img" />;
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
                {allStamps.map((s) => (
                  <button
                    key={s.key}
                    className={`stamp-btn-sm ${selections.get(sub.id) === s.key ? "selected" : ""}`}
                    onClick={() => toggleStamp(sub.id, s.key)}
                  >
                    {renderStamp(s, "sm")}
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
