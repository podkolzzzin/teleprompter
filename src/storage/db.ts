import { openDB } from 'idb'

export interface Script {
  id?: number
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

const DB_NAME = 'teleprompter-db'
const STORE_NAME = 'scripts'

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt')
      }
    }
  })
}

export async function getAllScripts(): Promise<Script[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function getScript(id: number): Promise<Script | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function saveScript(script: Omit<Script, 'id'>): Promise<number> {
  const db = await getDB()
  const key = await db.add(STORE_NAME, script)
  return key as number
}

export async function updateScript(script: Script): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, script)
}

export async function deleteScript(id: number): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
