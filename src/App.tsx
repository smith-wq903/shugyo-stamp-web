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
  exportData,
  importData,
  Subject,
  ExportData,
} from "./db";

export default function App() {
  const [ready, setReady] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isHomeworkTime, setIsHomeworkTime] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");

  // 教科管理
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [subjectsVersion, setSubjectsVersion] = useState(0);

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
      setReady(true);
    });
  }, []);

  const loadSubjects = async () => {
    const subs = await getSubjects();
    setSubjects(subs);
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
      // 再読み込み
      const s = await getSettings();
      setStartTime(s.homework_start || "16:00");
      setEndTime(s.homework_end || "18:00");
      checkHomeworkTime(s.homework_start || "16:00", s.homework_end || "18:00");
      await loadSubjects();
      setSubjectsVersion((v) => v + 1);
      alert("インポートしました！");
    } catch {
      alert("ファイルの読み込みに失敗しました。正しいファイルか確認してください。");
    }
    // ファイル選択をリセット
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
