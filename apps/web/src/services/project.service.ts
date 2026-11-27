import type {
  ProjectMeta,
  ProjectPayload,
  ProjectRecord,
} from '../models/project';

const DB_NAME = 'pixora-projects';
const DB_VERSION = 1;
const META_STORE = 'meta';
const PAYLOAD_STORE = 'payloads';
const DRAFT_ID = 'pixora-draft';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
        db.createObjectStore(PAYLOAD_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('无法打开项目数据库'));
  });

  return dbPromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('项目事务失败'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('项目事务被中止'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('读取项目数据失败'));
  });
}

export async function saveProjectRecord(
  meta: ProjectMeta,
  payload: ProjectPayload,
): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(
    [META_STORE, PAYLOAD_STORE],
    'readwrite',
  );
  transaction.objectStore(META_STORE).put(meta);
  transaction.objectStore(PAYLOAD_STORE).put(payload);
  await transactionDone(transaction);
}

export async function listProjectMeta(): Promise<ProjectMeta[]> {
  const db = await getDatabase();
  const transaction = db.transaction(META_STORE, 'readonly');
  const request = transaction
    .objectStore(META_STORE)
    .getAll() as IDBRequest<ProjectMeta[]>;
  const metas = await requestResult(request);
  return metas
    .filter((meta) => !meta.isDraft)
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function loadProjectRecord(
  id: string,
): Promise<ProjectRecord | null> {
  const db = await getDatabase();
  const transaction = db.transaction(
    [META_STORE, PAYLOAD_STORE],
    'readonly',
  );
  const metaRequest = transaction
    .objectStore(META_STORE)
    .get(id) as IDBRequest<ProjectMeta | undefined>;
  const payloadRequest = transaction
    .objectStore(PAYLOAD_STORE)
    .get(id) as IDBRequest<ProjectPayload | undefined>;
  const [meta, payload] = await Promise.all([
    requestResult(metaRequest),
    requestResult(payloadRequest),
  ]);

  if (!meta || !payload) return null;
  return { meta, payload };
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(
    [META_STORE, PAYLOAD_STORE],
    'readwrite',
  );
  transaction.objectStore(META_STORE).delete(id);
  transaction.objectStore(PAYLOAD_STORE).delete(id);
  await transactionDone(transaction);
}

export async function saveDraft(payload: ProjectPayload): Promise<void> {
  const now = Date.now();
  const existing = await loadProjectMeta(DRAFT_ID);
  const meta: ProjectMeta = {
    id: DRAFT_ID,
    name: '上次会话',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    itemCount: payload.items.length,
    isDraft: true,
    thumbnail: existing?.thumbnail ?? null,
    mode: payload.mode,
    category: payload.assetCategory,
  };
  await saveProjectRecord(meta, payload);
}

export async function loadProjectMeta(
  id: string,
): Promise<ProjectMeta | null> {
  const db = await getDatabase();
  const transaction = db.transaction(META_STORE, 'readonly');
  const request = transaction
    .objectStore(META_STORE)
    .get(id) as IDBRequest<ProjectMeta | undefined>;
  const meta = await requestResult(request);
  return meta ?? null;
}

export async function loadDraft(): Promise<ProjectRecord | null> {
  return loadProjectRecord(DRAFT_ID);
}

export async function deleteDraft(): Promise<void> {
  await deleteProjectRecord(DRAFT_ID);
}
