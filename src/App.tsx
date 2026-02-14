import { useState, useEffect, useRef } from "react";
import Calendar from "./Calendar";
import {
  initDb,
  getSettings,
  saveSettings,
  getSubjects,
  addSubject,
  renameSubject,
  deleteSubject,
  getCustomStamps,
  addCustomStamp,
  deleteCustomStamp,
  exportData,
  importData,
  Subject,
  CustomStamp,
  ExportData,
} from "./db";

// 画像を64x64に縮小してBase64に変換（メモリ節約）
function resizeImage(file: File, maxSize: number = 64): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/png", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isHomeworkTime, setIsHomeworkTime] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [subjectsVersion, setSubjectsVersion] = useState(0);

  // カスタムスタンプ
  const [customStamps, setCustomStamps] = useState<CustomStamp[]>([]);
  const stampFileRef = useRef<HTMLInputElement>(null);

  // インポート用
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initDb().then(async () => {
      const s = await getSettings();
      const start = s.homework_start || "16:00";
      const end = s.homework_end || "18:00";
      setStartTime(start);
      setEndTime(end);
      checkHomeworkTime(start, end);
      await loadSubjects();
      await loadCustomStamps();
      setReady(true);
    });
  }, []);

  const loadSubjects = async () => {
    const subs = await getSubjects();
    setSubjects(subs);
  };

  const loadCustomStamps = async () => {
    const cs = await getCustomStamps();
    setCustomStamps(cs);
  };

  const checkHomeworkTime = (start: string, end: string) => {
    const now = new Date();
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    setIsHomeworkTime(nowMin >= startMin && nowMin < endMin);
  };

  useEffect(() => {
    const timer = setInterval(
      () => checkHomeworkTime(startTime, endTime),
      60000
    );
    return () => clearInterval(timer);
  }, [startTime, endTime]);

  const handleSaveSettings = async () => {
    await saveSettings({ homework_start: startTime, homework_end: endTime });
    checkHomeworkTime(startTime, endTime);
    setShowSettings(false);
  };

  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) return;
    await addSubject(name);
    setNewSubjectName("");
    await loadSubjects();
    setSubjectsVersion((v) => v + 1);
  };

  const handleRename = async (id: number) => {
    const name = editingName.trim();
    if (!name) return;
    await renameSubject(id, name);
    setEditingId(null);
    setEditingName("");
    await loadSubjects();
    setSubjectsVersion((v) => v + 1);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこの項目のスタンプも全て消えます。`))
      return;
    await deleteSubject(id);
    await loadSubjects();
    setSubjectsVersion((v) => v + 1);
  };

  // --- カスタムスタンプ ---
  const handleAddStampImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const image = await resizeImage(file, 64);
      const name = file.name.replace(/\.[^.]+$/, "").substring(0, 10);
      await addCustomStamp(name, image);
      await loadCustomStamps();
      setSubjectsVersion((v) => v + 1);
    } catch {
      alert("画像の読み込みに失敗しました。");
    }
    e.target.value = "";
  };

  const handleDeleteStamp = async (id: number, name: string) => {
    if (!confirm(`スタンプ「${name}」を削除しますか？`)) return;
    await deleteCustomStamp(id);
    await loadCustomStamps();
    setSubjectsVersion((v) => v + 1);
  };

  // --- エクスポート ---
  const handleExport = async () => {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shugyo-stamp-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- インポート ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);
      if (
        !confirm(
          "データをインポートすると、現在のデータは全て上書きされます。よろしいですか？"
        )
      ) {
        return;
      }
      await importData(data);
      const s = await getSettings();
      setStartTime(s.homework_start || "16:00");
      setEndTime(s.homework_end || "18:00");
      checkHomeworkTime(s.homework_start || "16:00", s.homework_end || "18:00");
      await loadSubjects();
      await loadCustomStamps();
      setSubjectsVersion((v) => v + 1);
      alert("インポートしました！");
    } catch {
      alert("ファイルの読み込みに失敗しました。正しいファイルか確認してください。");
    }
    e.target.value = "";
  };

  if (!ready) {
    return (
      <div className="app">
        <p style={{ textAlign: "center", padding: 40 }}>よみこみ中...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>修行（しゅぎょう）スタンプ</h1>
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️
        </button>
      </header>

      {isHomeworkTime && (
        <div className="reminder-banner">
          📚 修行（しゅぎょう）の じかんだよ！がんばろう！
        </div>
      )}

      {streak > 0 && (
        <div className="streak-banner">
          🔥 {streak}日れんぞく がんばってるよ！すごい！
        </div>
      )}

      {showSettings && (
        <div className="settings-panel">
          <h3>修行（しゅぎょう）の時間</h3>
          <div className="settings-row">
            <label>
              開始:
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              終了:
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={handleSaveSettings}>
              ほぞん
            </button>
          </div>

          <h3 className="section-title">しゅぎょうないよう</h3>
          <div className="subject-manage-list">
            {subjects.map((sub) => (
              <div key={sub.id} className="subject-manage-row">
                {editingId === sub.id ? (
                  <>
                    <input
                      className="subject-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleRename(sub.id)
                      }
                      autoFocus
                    />
                    <button
                      className="btn-icon"
                      onClick={() => handleRename(sub.id)}
                    >
                      ✓
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => setEditingId(null)}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="subject-manage-name">{sub.name}</span>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setEditingId(sub.id);
                        setEditingName(sub.name);
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(sub.id, sub.name)}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="subject-add-row">
            <input
              className="subject-input"
              placeholder="ないよう名をにゅうりょく"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddSubject}
              disabled={!newSubjectName.trim()}
            >
              ついか
            </button>
          </div>

          <h3 className="section-title">スタンプ画像</h3>
          <div className="custom-stamp-list">
            {customStamps.map((cs) => (
              <div key={cs.id} className="custom-stamp-item">
                <img src={cs.image} alt={cs.name} width={40} height={40} />
                <span className="custom-stamp-name">{cs.name}</span>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => handleDeleteStamp(cs.id, cs.name)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => stampFileRef.current?.click()}
          >
            🖼️ 画像をついか
          </button>
          <input
            ref={stampFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAddStampImage}
          />

          <h3 className="section-title">データ</h3>
          <div className="data-actions">
            <button className="btn btn-secondary" onClick={handleExport}>
              📤 エクスポート
            </button>
            <button className="btn btn-secondary" onClick={handleImportClick}>
              📥 インポート
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>
        </div>
      )}

      <Calendar onStreakChange={setStreak} subjectsVersion={subjectsVersion} />
    </div>
  );
}
