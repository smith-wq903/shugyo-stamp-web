// IndexedDB を使ったデータ層
// DB バージョンを上げることでスキーマ移行が自動で行われる

export interface Subject {
  id: number;
  name: string;
  sort_order: number;
}

export interface StampEntry {
  date: string;
  subject_id: number;
  stamp: string;
  subject_name: string;
}

export interface StampsResponse {
  stamps: StampEntry[];
  streak: number;
}

export interface ExportData {
  version: 1;
  exported_at: string;
  subjects: Subject[];
  stamps: Array<{ date: string; subject_id: number; stamp: string }>;
  settings: Record<string, string>;
}

const DB_NAME = "shugyo-stamp";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("subjects")) {
        const store = db.createObjectStore("subjects", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("sort_order", "sort_order");
      }

      if (!db.objectStoreNames.contains("stamps")) {
        const store = db.createObjectStore("stamps", {
          keyPath: ["date", "subject_id"],
        });
        store.createIndex("date", "date");
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

// --- ヘルパー ---

function tx(
  storeNames: string | string[],
  mode: IDBTransactionMode
): Promise<IDBTransaction> {
  return openDb().then(
    (db) => db.transaction(storeNames, mode)
  );
}

function getAll<T>(storeName: string): Promise<T[]> {
  return tx(storeName, "readonly").then(
    (t) =>
      new Promise((resolve, reject) => {
        const req = t.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function put<T>(storeName: string, value: T): Promise<IDBValidKey> {
  return tx(storeName, "readwrite").then(
    (t) =>
      new Promise((resolve, reject) => {
        const req = t.objectStore(storeName).put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function del(storeName: string, key: IDBValidKey | IDBKeyRange): Promise<void> {
  return tx(storeName, "readwrite").then(
    (t) =>
      new Promise((resolve, reject) => {
        const req = t.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

// --- 初期化 ---

export async function initDb(): Promise<void> {
  await openDb();
  const subjects = await getSubjects();
  if (subjects.length === 0) {
    await addSubject("こくご");
    await addSubject("さんすう");
  }
  const settings = await getSettings();
  if (!settings.homework_start) {
    await saveSetting("homework_start", "16:00");
    await saveSetting("homework_end", "18:00");
  }
}

// --- Subjects ---

export async function getSubjects(): Promise<Subject[]> {
  const all = await getAll<Subject>("subjects");
  return all.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function addSubject(name: string): Promise<Subject> {
  const all = await getSubjects();
  const maxOrder = all.reduce((m, s) => Math.max(m, s.sort_order), 0);
  const id = await put("subjects", {
    name,
    sort_order: maxOrder + 1,
  });
  return { id: id as number, name, sort_order: maxOrder + 1 };
}

export async function renameSubject(
  id: number,
  name: string
): Promise<void> {
  const all = await getSubjects();
  const subject = all.find((s) => s.id === id);
  if (subject) {
    await put("subjects", { ...subject, name });
  }
}

export async function deleteSubject(id: number): Promise<void> {
  // 関連スタンプを削除
  const allStamps = await getAll<{
    date: string;
    subject_id: number;
    stamp: string;
  }>("stamps");
  const toDelete = allStamps.filter((s) => s.subject_id === id);
  for (const s of toDelete) {
    await del("stamps", [s.date, s.subject_id]);
  }
  await del("subjects", id);
}

// --- Stamps ---

export async function fetchStamps(
  year: number,
  month: number
): Promise<StampsResponse> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const allStamps = await getAll<{
    date: string;
    subject_id: number;
    stamp: string;
  }>("stamps");
  const subjects = await getSubjects();
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  const filtered = allStamps
    .filter((s) => s.date.startsWith(prefix))
    .map((s) => ({
      ...s,
      subject_name: subjectMap.get(s.subject_id) || "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const streak = await calcStreak(subjects, allStamps);

  return { stamps: filtered, streak };
}

export async function postStamp(
  date: string,
  subjectId: number,
  stamp: string
): Promise<void> {
  await put("stamps", { date, subject_id: subjectId, stamp });
}

export async function removeStamp(
  date: string,
  subjectId: number
): Promise<void> {
  await del("stamps", [date, subjectId]);
}

// --- Settings ---

export async function getSettings(): Promise<Record<string, string>> {
  const all = await getAll<{ key: string; value: string }>("settings");
  const result: Record<string, string> = {};
  for (const row of all) {
    result[row.key] = row.value;
  }
  return result;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await put("settings", { key, value });
}

export async function saveSettings(
  settings: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await saveSetting(key, value);
  }
}

// --- Streak ---

async function calcStreak(
  subjects: Subject[],
  allStamps: Array<{ date: string; subject_id: number; stamp: string }>
): Promise<number> {
  if (subjects.length === 0) return 0;

  // 全教科にスタンプがある日を集める
  const dateCount = new Map<string, Set<number>>();
  for (const s of allStamps) {
    if (!dateCount.has(s.date)) dateCount.set(s.date, new Set());
    dateCount.get(s.date)!.add(s.subject_id);
  }

  const completeDates = Array.from(dateCount.entries())
    .filter(([, ids]) => subjects.every((sub) => ids.has(sub.id)))
    .map(([d]) => d)
    .sort()
    .reverse();

  if (completeDates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < completeDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (completeDates[i] === expectedStr) {
      streak++;
    } else if (i === 0) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (completeDates[i] === yesterdayStr) {
        streak++;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

// --- エクスポート / インポート ---

export async function exportData(): Promise<ExportData> {
  const subjects = await getSubjects();
  const stamps = await getAll<{
    date: string;
    subject_id: number;
    stamp: string;
  }>("stamps");
  const settings = await getSettings();

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    subjects,
    stamps: stamps.map((s) => ({
      date: s.date,
      subject_id: s.subject_id,
      stamp: s.stamp,
    })),
    settings,
  };
}

export async function importData(data: ExportData): Promise<void> {
  if (data.version !== 1) {
    throw new Error("サポートされていないデータ形式です");
  }

  const db = await openDb();

  // 全ストアをクリア
  const clearStore = (name: string) =>
    new Promise<void>((resolve, reject) => {
      const t = db.transaction(name, "readwrite");
      const req = t.objectStore(name).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

  await clearStore("subjects");
  await clearStore("stamps");
  await clearStore("settings");

  // 教科をインポート
  for (const sub of data.subjects) {
    await put("subjects", sub);
  }

  // スタンプをインポート
  for (const s of data.stamps) {
    await put("stamps", {
      date: s.date,
      subject_id: s.subject_id,
      stamp: s.stamp,
    });
  }

  // 設定をインポート
  for (const [key, value] of Object.entries(data.settings)) {
    await put("settings", { key, value });
  }
}
