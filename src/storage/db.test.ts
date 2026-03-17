import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the idb module before importing the module under test
const mockStore = new Map<number, unknown>()
let autoId = 0

vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn((_store: string) => Promise.resolve([...mockStore.values()])),
      get: vi.fn((_store: string, id: number) => Promise.resolve(mockStore.get(id))),
      add: vi.fn((_store: string, value: unknown) => {
        autoId++
        mockStore.set(autoId, { ...(value as Record<string, unknown>), id: autoId })
        return Promise.resolve(autoId)
      }),
      put: vi.fn((_store: string, value: Record<string, unknown>) => {
        mockStore.set(value.id as number, value)
        return Promise.resolve()
      }),
      delete: vi.fn((_store: string, id: number) => {
        mockStore.delete(id)
        return Promise.resolve()
      }),
    })
  ),
}))

import { getAllScripts, getScript, saveScript, updateScript, deleteScript, updateScrollProgress } from './db'

describe('storage/db', () => {
  beforeEach(() => {
    mockStore.clear()
    autoId = 0
  })

  describe('saveScript', () => {
    it('saves a new script and returns its id', async () => {
      const id = await saveScript({
        title: 'Test Script',
        content: 'Hello **world**',
        createdAt: 1000,
        updatedAt: 1000,
      })

      expect(id).toBe(1)
      expect(mockStore.size).toBe(1)
    })

    it('assigns incrementing ids', async () => {
      const id1 = await saveScript({ title: 'A', content: '', createdAt: 1, updatedAt: 1 })
      const id2 = await saveScript({ title: 'B', content: '', createdAt: 2, updatedAt: 2 })

      expect(id1).toBe(1)
      expect(id2).toBe(2)
    })
  })

  describe('getAllScripts', () => {
    it('returns empty array when no scripts exist', async () => {
      const scripts = await getAllScripts()
      expect(scripts).toEqual([])
    })

    it('returns all saved scripts', async () => {
      await saveScript({ title: 'A', content: 'a', createdAt: 1, updatedAt: 1 })
      await saveScript({ title: 'B', content: 'b', createdAt: 2, updatedAt: 2 })

      const scripts = await getAllScripts()
      expect(scripts).toHaveLength(2)
    })
  })

  describe('getScript', () => {
    it('returns a script by id', async () => {
      const id = await saveScript({ title: 'My Script', content: '# Hi', createdAt: 100, updatedAt: 100 })
      const script = await getScript(id)

      expect(script).toBeDefined()
      expect(script!.title).toBe('My Script')
      expect(script!.content).toBe('# Hi')
    })

    it('returns undefined for non-existent id', async () => {
      const script = await getScript(999)
      expect(script).toBeUndefined()
    })
  })

  describe('updateScript', () => {
    it('updates an existing script', async () => {
      const id = await saveScript({ title: 'Original', content: 'old', createdAt: 1, updatedAt: 1 })
      await updateScript({ id, title: 'Updated', content: 'new', createdAt: 1, updatedAt: 2 })

      const script = await getScript(id)
      expect(script!.title).toBe('Updated')
      expect(script!.content).toBe('new')
      expect(script!.updatedAt).toBe(2)
    })
  })

  describe('deleteScript', () => {
    it('removes a script by id', async () => {
      const id = await saveScript({ title: 'To Delete', content: '', createdAt: 1, updatedAt: 1 })
      expect(mockStore.size).toBe(1)

      await deleteScript(id)
      expect(mockStore.size).toBe(0)
    })
  })

  describe('updateScrollProgress', () => {
    it('updates scrollProgress on an existing script', async () => {
      const id = await saveScript({ title: 'Test', content: 'hello', createdAt: 1, updatedAt: 1 })
      await updateScrollProgress(id, 0.5)

      const script = await getScript(id)
      expect(script!.scrollProgress).toBe(0.5)
    })

    it('does nothing for a non-existent script', async () => {
      await updateScrollProgress(999, 0.5)
      expect(mockStore.size).toBe(0)
    })

    it('preserves other script fields when updating progress', async () => {
      const id = await saveScript({ title: 'Keep Me', content: '# Content', createdAt: 100, updatedAt: 200 })
      await updateScrollProgress(id, 0.75)

      const script = await getScript(id)
      expect(script!.title).toBe('Keep Me')
      expect(script!.content).toBe('# Content')
      expect(script!.createdAt).toBe(100)
      expect(script!.updatedAt).toBe(200)
      expect(script!.scrollProgress).toBe(0.75)
    })
  })
})
