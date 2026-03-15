import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import ScriptEditor from './ScriptEditor.vue'

// Mock the storage module
vi.mock('../storage/db', () => ({
  getScript: vi.fn(),
  saveScript: vi.fn(() => Promise.resolve(1)),
  updateScript: vi.fn(() => Promise.resolve()),
}))

import { getScript, saveScript, updateScript } from '../storage/db'

function createTestRouter(initialRoute = '/edit') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/edit/:id?', component: ScriptEditor },
    ],
  })
  router.push(initialRoute)
  return router
}

describe('ScriptEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders new script form', async () => {
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    expect(wrapper.find('.page-title').text()).toBe('New Script')
    expect(wrapper.find('#title').exists()).toBe(true)
    expect(wrapper.find('#content').exists()).toBe(true)
  })

  it('shows validation error when saving without a title', async () => {
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    await wrapper.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-msg').text()).toBe('Please enter a title.')
    expect(saveScript).not.toHaveBeenCalled()
  })

  it('saves a new script with valid data', async () => {
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    await wrapper.find('#title').setValue('My Script')
    await wrapper.find('#content').setValue('Some content')
    await wrapper.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()

    expect(saveScript).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My Script',
        content: 'Some content',
      })
    )
  })

  it('toggles preview panel', async () => {
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    expect(wrapper.find('.preview-panel').exists()).toBe(false)

    await wrapper.find('.btn-preview').trigger('click')
    expect(wrapper.find('.preview-panel').exists()).toBe(true)

    await wrapper.find('.btn-preview').trigger('click')
    expect(wrapper.find('.preview-panel').exists()).toBe(false)
  })

  it('loads existing script in edit mode', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Existing Script',
      content: '# Hello',
      createdAt: 1000,
      updatedAt: 2000,
    })

    const router = createTestRouter('/edit/1')
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    // Wait for onMounted async to complete
    await vi.waitFor(() => {
      expect((wrapper.find('#title').element as HTMLInputElement).value).toBe('Existing Script')
    })

    expect(wrapper.find('.page-title').text()).toBe('Edit Script')
  })

  it('calls updateScript when editing existing script', async () => {
    vi.mocked(getScript).mockResolvedValue({
      id: 1,
      title: 'Old Title',
      content: 'Old content',
      createdAt: 1000,
      updatedAt: 2000,
    })

    const router = createTestRouter('/edit/1')
    await router.isReady()

    const wrapper = mount(ScriptEditor, {
      global: { plugins: [router] },
    })

    await vi.waitFor(() => {
      expect((wrapper.find('#title').element as HTMLInputElement).value).toBe('Old Title')
    })

    await wrapper.find('#title').setValue('New Title')
    await wrapper.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()

    expect(updateScript).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        title: 'New Title',
      })
    )
  })
})
