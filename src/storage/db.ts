import { openDB } from 'idb'

export interface Script {
  id?: number
  uuid?: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  scrollProgress?: number
}

const DB_NAME = 'teleprompter-db'
const STORE_NAME = 'scripts'
const DELETED_SCRIPTS_KEY = 'teleprompter-deleted-scripts'

export interface DeletedScript {
  uuid: string
  deletedAt: number
}

function createUuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readDeletedScripts(): DeletedScript[] {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return []
  const raw = localStorage.getItem(DELETED_SCRIPTS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as DeletedScript[]
  } catch {
    return []
  }
}

function writeDeletedScripts(deletedScripts: DeletedScript[]) {
  if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return
  localStorage.setItem(DELETED_SCRIPTS_KEY, JSON.stringify(deletedScripts))
}

function recordDeletedScript(uuid: string) {
  const existing = readDeletedScripts().filter((script) => script.uuid !== uuid)
  writeDeletedScripts([...existing, { uuid, deletedAt: Date.now() }])
}

async function getDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('uuid', 'uuid', { unique: true })
      } else {
        const store = tx.objectStore(STORE_NAME)
        if (!store.indexNames.contains('uuid')) {
          store.createIndex('uuid', 'uuid', { unique: true })
        }
      }
    }
  })
}

async function ensureScriptUuid(script: Script): Promise<Script> {
  if (script.uuid) return script
  const withUuid = { ...script, uuid: createUuid() }
  const db = await getDB()
  await db.put(STORE_NAME, withUuid)
  return withUuid
}

export async function getAllScripts(): Promise<Script[]> {
  const db = await getDB()
  const scripts = await db.getAll(STORE_NAME)
  return Promise.all(scripts.map(ensureScriptUuid))
}

export async function getScript(id: number): Promise<Script | undefined> {
  const db = await getDB()
  const script = await db.get(STORE_NAME, id)
  return script ? ensureScriptUuid(script) : undefined
}

export async function saveScript(script: Omit<Script, 'id'>): Promise<number> {
  const db = await getDB()
  const key = await db.add(STORE_NAME, { ...script, uuid: script.uuid ?? createUuid() })
  return key as number
}

export async function updateScript(script: Script): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, { ...script, uuid: script.uuid ?? createUuid() })
}

export async function deleteScript(id: number): Promise<void> {
  const db = await getDB()
  const script = await db.get(STORE_NAME, id)
  if (script?.uuid) recordDeletedScript(script.uuid)
  await db.delete(STORE_NAME, id)
}

export async function updateScrollProgress(id: number, progress: number): Promise<void> {
  const db = await getDB()
  const script = await db.get(STORE_NAME, id)
  if (script) {
    script.scrollProgress = progress
    await db.put(STORE_NAME, script)
  }
}

export async function upsertSyncedScripts(incomingScripts: Script[]): Promise<number> {
  const db = await getDB()
  const localScripts = await db.getAll(STORE_NAME)
  const byUuid = new Map(localScripts.filter((script) => script.uuid).map((script) => [script.uuid, script]))
  let changed = 0

  for (const incoming of incomingScripts) {
    const uuid = incoming.uuid ?? createUuid()
    const existing = byUuid.get(uuid)
    const nextScript = {
      ...incoming,
      uuid,
      scrollProgress: incoming.scrollProgress ?? existing?.scrollProgress,
    }

    if (!existing) {
      const { id: _id, ...scriptToAdd } = nextScript
      await db.add(STORE_NAME, scriptToAdd)
      changed++
      continue
    }

    if (incoming.updatedAt >= existing.updatedAt) {
      await db.put(STORE_NAME, { ...existing, ...nextScript, id: existing.id })
      changed++
    }
  }

  return changed
}

export function getDeletedScripts(): DeletedScript[] {
  return readDeletedScripts()
}

export async function deleteScriptsByUuid(deletedScripts: DeletedScript[]): Promise<number> {
  if (deletedScripts.length === 0) return 0
  const db = await getDB()
  const localScripts = await db.getAll(STORE_NAME)
  const deletedByUuid = new Map(deletedScripts.map((script) => [script.uuid, script]))
  let changed = 0

  for (const script of localScripts) {
    if (!script.id || !script.uuid) continue
    const deleted = deletedByUuid.get(script.uuid)
    if (deleted && deleted.deletedAt >= script.updatedAt) {
      await db.delete(STORE_NAME, script.id)
      recordDeletedScript(script.uuid)
      changed++
    }
  }

  return changed
}
