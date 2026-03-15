import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import ScriptList from './ScriptList.vue'

// Mock the storage module
vi.mock('../storage/db', () => ({
  getAllScripts: vi.fn(() => Promise.resolve([])),
  deleteScript: vi.fn(() => Promise.resolve()),
}))

import { getAllScripts, deleteScript } from '../storage/db'

function createTestRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: ScriptList },
      { path: '/edit/:id?', component: { template: '<div>Edit</div>' } },
      { path: '/teleprompter/:id', component: { template: '<div>Teleprompter</div>' } },
    ],
  })
  router.push('/')
  return router
}

describe('ScriptList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no scripts', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('No scripts yet')
    expect(wrapper.text()).toContain('Create your first script to get started.')
  })

  it('renders list of scripts', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([
      { id: 1, title: 'Script One', content: 'Content one', createdAt: 2000, updatedAt: 2000 },
      { id: 2, title: 'Script Two', content: 'Content two', createdAt: 1000, updatedAt: 1000 },
    ])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('.script-card')).toHaveLength(2)
    })

    expect(wrapper.text()).toContain('Script One')
    expect(wrapper.text()).toContain('Script Two')
  })

  it('sorts scripts by createdAt descending (newest first)', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([
      { id: 1, title: 'Older', content: '', createdAt: 1000, updatedAt: 1000 },
      { id: 2, title: 'Newer', content: '', createdAt: 2000, updatedAt: 2000 },
    ])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('.script-card')).toHaveLength(2)
    })

    const titles = wrapper.findAll('.card-title').map((el) => el.text())
    expect(titles[0]).toBe('Newer')
    expect(titles[1]).toBe('Older')
  })

  it('truncates long preview text', async () => {
    const longContent = 'a'.repeat(200)
    vi.mocked(getAllScripts).mockResolvedValue([
      { id: 1, title: 'Long', content: longContent, createdAt: 1000, updatedAt: 1000 },
    ])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.card-preview').exists()).toBe(true)
    })

    const previewText = wrapper.find('.card-preview').text()
    expect(previewText.length).toBeLessThanOrEqual(121) // 120 + ellipsis
  })

  it('deletes script after confirm', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([
      { id: 1, title: 'To Delete', content: '', createdAt: 1000, updatedAt: 1000 },
    ])

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.btn-danger').exists()).toBe(true)
    })

    await wrapper.find('.btn-danger').trigger('click')

    expect(window.confirm).toHaveBeenCalledWith('Delete this script?')
    expect(deleteScript).toHaveBeenCalledWith(1)
  })
})
