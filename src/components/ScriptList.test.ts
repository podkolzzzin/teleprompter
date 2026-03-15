import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import ScriptList from './ScriptList.vue'

// Mock the storage module
vi.mock('../storage/db', () => ({
  getAllScripts: vi.fn(() => Promise.resolve([])),
  deleteScript: vi.fn(() => Promise.resolve()),
  saveScript: vi.fn(() => Promise.resolve(1)),
}))

// Mock the file converter module
vi.mock('../utils/fileConverter', () => ({
  convertFileToMarkdown: vi.fn(() => Promise.resolve({ title: 'Imported', content: '# Imported content' })),
  isSupportedFile: vi.fn((file: File) => file.name.endsWith('.docx') || file.name.endsWith('.pdf')),
}))

import { getAllScripts, deleteScript, saveScript } from '../storage/db'
import { convertFileToMarkdown, isSupportedFile } from '../utils/fileConverter'

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

  it('renders import button', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    expect(wrapper.find('.btn-import').exists()).toBe(true)
    expect(wrapper.find('.btn-import').text()).toContain('Import')
  })

  it('has hidden file input for import', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([])

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
    expect(fileInput.attributes('accept')).toBe('.docx,.pdf')
  })

  it('shows error for unsupported file type on import', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([])
    vi.mocked(isSupportedFile).mockReturnValue(false)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    const fileInput = wrapper.find('input[type="file"]')

    // Create a mock file and trigger change event
    const mockFile = new File(['test'], 'file.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput.element, 'files', { value: [mockFile] })

    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.import-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Unsupported file type')
  })

  it('imports a supported file and navigates to edit', async () => {
    vi.mocked(getAllScripts).mockResolvedValue([])
    vi.mocked(isSupportedFile).mockReturnValue(true)
    vi.mocked(convertFileToMarkdown).mockResolvedValue({ title: 'My Doc', content: '# Hello' })
    vi.mocked(saveScript).mockResolvedValue(42)

    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptList, {
      global: { plugins: [router] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const mockFile = new File(['test'], 'My Doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    Object.defineProperty(fileInput.element, 'files', { value: [mockFile] })

    await fileInput.trigger('change')

    await vi.waitFor(() => {
      expect(saveScript).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Doc',
          content: '# Hello',
        }),
      )
    })
  })
})
