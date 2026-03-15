<template>
  <div class="page">
    <header class="header">
      <button class="btn-ghost" @click="router.push('/')">← Back</button>
      <h1 class="page-title">{{ isEdit ? 'Edit Script' : 'New Script' }}</h1>
      <div class="header-actions">
        <button class="btn-preview" @click="showPreview = !showPreview">
          {{ showPreview ? 'Hide Preview' : 'Preview' }}
        </button>
        <button class="btn-accent" @click="save">Save</button>
      </div>
    </header>

    <main class="content">
      <div class="editor-layout" :class="{ 'has-preview': showPreview }">
        <section class="editor-panel">
          <div class="field">
            <label class="label" for="title">Title</label>
            <input
              id="title"
              v-model="title"
              type="text"
              class="input"
              placeholder="Script title…"
              maxlength="200"
            />
          </div>
          <div class="field grow">
            <label class="label" for="content">Content (Markdown)</label>
            <textarea
              id="content"
              v-model="content"
              class="textarea"
              placeholder="Write your script in Markdown…"
              spellcheck="true"
            ></textarea>
          </div>
        </section>

        <section v-if="showPreview" class="preview-panel">
          <p class="preview-label">Preview</p>
          <div class="preview-body prose" v-html="renderedPreview"></div>
        </section>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { getScript, saveScript, updateScript } from '../storage/db'

const router = useRouter()
const route = useRoute()

const title = ref('')
const content = ref('')
const error = ref('')
const showPreview = ref(false)
const originalCreatedAt = ref<number>(0)

const isEdit = computed(() => !!route.params.id)

onMounted(async () => {
  const id = Number(route.params.id)
  if (id) {
    const script = await getScript(id)
    if (script) {
      title.value = script.title
      content.value = script.content
      originalCreatedAt.value = script.createdAt
    }
  }
})

const renderedPreview = computed(() => {
  const result = marked(content.value || '')
  return typeof result === 'string' ? result : ''
})

async function save() {
  error.value = ''
  if (!title.value.trim()) {
    error.value = 'Please enter a title.'
    return
  }
  const now = Date.now()
  const id = Number(route.params.id)
  if (id) {
    await updateScript({
      id,
      title: title.value.trim(),
      content: content.value,
      createdAt: originalCreatedAt.value,
      updatedAt: now,
    })
  } else {
    await saveScript({ title: title.value.trim(), content: content.value, createdAt: now, updatedAt: now })
  }
  router.push('/')
}
</script>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.editor-layout {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.preview-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field.grow {
  flex: 1;
  overflow: hidden;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
  color: var(--text);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--accent);
}

.textarea {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  color: var(--text);
  font-size: 15px;
  font-family: 'Menlo', 'Consolas', monospace;
  line-height: 1.6;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  min-height: 300px;
  height: 100%;
}

.textarea:focus {
  border-color: var(--accent);
}

.error-msg {
  color: var(--danger);
  font-size: 14px;
  margin-top: 12px;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 14px;
  white-space: nowrap;
}

.btn-ghost:hover {
  border-color: var(--text-muted);
}

.btn-accent {
  background: var(--accent);
  color: #111;
  font-weight: 600;
}

.btn-preview {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

/* Prose styles for markdown preview */
.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3) {
  color: var(--text);
  margin: 16px 0 8px;
  line-height: 1.3;
}
.prose :deep(h1) { font-size: 24px; }
.prose :deep(h2) { font-size: 20px; }
.prose :deep(h3) { font-size: 17px; }
.prose :deep(p) { color: var(--text); line-height: 1.6; margin-bottom: 12px; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 20px; margin-bottom: 12px; }
.prose :deep(li) { color: var(--text); line-height: 1.6; margin-bottom: 4px; }
.prose :deep(code) {
  background: #2a2a2a;
  color: var(--accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.prose :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  color: var(--text-muted);
  margin: 12px 0;
}

@media (max-width: 640px) {
  .header {
    padding: 10px 16px;
  }
  .content {
    padding: 16px;
  }
  .editor-layout.has-preview {
    flex-direction: column;
  }
  .page-title {
    font-size: 15px;
  }
}
</style>
