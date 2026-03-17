<template>
  <div class="page">
    <header class="header">
      <h1 class="logo">📺 Teleprompter</h1>
      <div class="header-actions">
        <button class="btn-import" @click="fileInput?.click()">📄 Import</button>
        <button class="btn-transfer" @click="openTransfer" :disabled="scripts.length === 0" title="Transfer all scripts to another device">📲 Transfer</button>
        <button class="btn-accent" @click="router.push('/edit')">+ New Script</button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".docx,.pdf"
        class="sr-only"
        @change="handleFileImport"
      />
    </header>
    <p v-if="importError" class="import-error">{{ importError }}</p>

    <!-- Transfer modal -->
    <SessionModal
      v-if="transferModalOpen"
      :url="transferUrl"
      :status="transferStatus"
      :error-message="transferError"
      @close="closeTransfer"
    >
      <template #title>
        <h2 class="modal-title">📲 Transfer Scripts</h2>
        <p class="modal-desc">Scan the QR code or open the link on your other device to transfer all {{ scripts.length }} script{{ scripts.length !== 1 ? 's' : '' }}.</p>
      </template>
    </SessionModal>

    <!-- Share single script modal -->
    <SessionModal
      v-if="scriptShareOpen"
      :url="scriptShareUrl"
      :status="scriptShareStatus"
      :error-message="scriptShareError"
      @close="closeScriptShare"
    >
      <template #title>
        <h2 class="modal-title">📤 Share Script</h2>
        <p class="modal-desc">Scan the QR code or open the link on another device to share "{{ sharingScriptTitle }}".</p>
      </template>
    </SessionModal>

    <main class="content">
      <div v-if="scripts.length === 0" class="empty-state">
        <p class="empty-icon">📝</p>
        <p class="empty-title">No scripts yet</p>
        <p class="empty-sub">Create your first script to get started.</p>
        <button class="btn-accent" @click="router.push('/edit')">Create Script</button>
      </div>

      <ul v-else class="script-list">
        <li v-for="script in sortedScripts" :key="script.id" class="script-card">
          <div class="card-body" @click="router.push(`/teleprompter/${script.id}`)">
            <h2 class="card-title">{{ script.title || 'Untitled' }}</h2>
            <p class="card-preview">{{ preview(script.content) }}</p>
            <p class="card-date">{{ formatDate(script.createdAt) }}</p>
          </div>
          <div v-if="script.scrollProgress && script.scrollProgress > 0" class="progress-bar">
            <div class="progress-fill" :style="{ width: (script.scrollProgress * 100) + '%' }"></div>
          </div>
          <div class="card-actions">
            <button class="btn-start" @click.stop="router.push(`/teleprompter/${script.id}`)">▶ Start</button>
            <button class="btn-edit" @click.stop="router.push(`/edit/${script.id}`)">✏ Edit</button>
            <button class="btn-share" @click.stop="openScriptShare(script)" title="Share this script">📤 Share</button>
            <button class="btn-danger" @click.stop="confirmDelete(script.id!)">🗑 Delete</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAllScripts, deleteScript, saveScript, type Script } from '../storage/db'
import { convertFileToMarkdown, isSupportedFile } from '../utils/fileConverter'
import { useShareHost } from '../composables/useRemoteControl'
import SessionModal from './SessionModal.vue'

const router = useRouter()
const scripts = ref<Script[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref('')

// Transfer feature
const transferModalOpen = ref(false)
const { peerId: transferPeerId, status: transferHostStatus, error: transferHostError, start: startTransferHost, send: sendTransfer, stop: stopTransferHost } = useShareHost()
const transferUrl = ref('')
const transferStatus = computed(() => transferHostStatus.value)
const transferError = computed(() => transferHostError.value)

// Share single script feature
const scriptShareOpen = ref(false)
const sharingScriptTitle = ref('')
const sharingScript = ref<Script | null>(null)
const { peerId: scriptSharePeerId, status: scriptShareHostStatus, error: scriptShareHostError, start: startScriptShareHost, send: sendScriptShare, stop: stopScriptShareHost } = useShareHost()
const scriptShareUrl = ref('')
const scriptShareStatus = computed(() => scriptShareHostStatus.value)
const scriptShareError = computed(() => scriptShareHostError.value)

async function openTransfer() {
  transferModalOpen.value = true
  try {
    await startTransferHost()
    transferUrl.value = `${window.location.origin}/transfer/${transferPeerId.value}`
  } catch {
    // error state is set in the composable
  }
}

watch(transferHostStatus, (newStatus) => {
  if (newStatus === 'connected') {
    sendTransfer({
      type: 'transfer',
      scripts: scripts.value.map(({ title, content, createdAt, updatedAt }) => ({
        title,
        content,
        createdAt,
        updatedAt,
      })),
    })
  }
})

function closeTransfer() {
  transferModalOpen.value = false
  stopTransferHost()
  transferUrl.value = ''
}

async function openScriptShare(script: Script) {
  sharingScript.value = script
  sharingScriptTitle.value = script.title || 'Untitled'
  scriptShareOpen.value = true
  try {
    await startScriptShareHost()
    scriptShareUrl.value = `${window.location.origin}/transfer/${scriptSharePeerId.value}`
  } catch {
    // error state is set in the composable
  }
}

watch(scriptShareHostStatus, (newStatus) => {
  if (newStatus === 'connected' && sharingScript.value) {
    const s = sharingScript.value
    sendScriptShare({
      type: 'transfer',
      scripts: [{
        title: s.title,
        content: s.content,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }],
    })
  }
})

function closeScriptShare() {
  scriptShareOpen.value = false
  stopScriptShareHost()
  scriptShareUrl.value = ''
  sharingScript.value = null
  sharingScriptTitle.value = ''
}

async function load() {
  scripts.value = await getAllScripts()
}

onMounted(load)

async function handleFileImport(event: Event) {
  importError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!isSupportedFile(file)) {
    importError.value = 'Unsupported file type. Please use .docx or .pdf files.'
    input.value = ''
    return
  }

  try {
    const { title, content } = await convertFileToMarkdown(file)
    const now = Date.now()
    const id = await saveScript({ title, content, createdAt: now, updatedAt: now })
    input.value = ''
    router.push(`/edit/${id}`)
  } catch {
    importError.value = 'Failed to import file. Please try a different file.'
    input.value = ''
  }
}

const sortedScripts = computed(() =>
  [...scripts.value].sort((a, b) => b.createdAt - a.createdAt)
)

function preview(content: string): string {
  const plain = content.replace(/[#*`>_~\[\]]/g, '').trim()
  return plain.length > 120 ? plain.slice(0, 120) + '…' : plain
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function confirmDelete(id: number) {
  if (confirm('Delete this script?')) {
    await deleteScript(id)
    await load()
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.import-error {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
  padding: 8px 24px;
  background: var(--surface);
}

.btn-import {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 600;
}

.logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.5px;
}

.content {
  flex: 1;
  padding: 24px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 56px;
}

.empty-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.empty-sub {
  color: var(--text-muted);
  margin-bottom: 8px;
}

.script-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.script-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.2s;
}

.script-card:hover {
  border-color: var(--accent);
}

.card-body {
  padding: 16px 20px 12px;
  cursor: pointer;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text);
}

.card-preview {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 8px;
}

.card-date {
  font-size: 12px;
  color: var(--text-muted);
}

.progress-bar {
  height: 3px;
  background: var(--border);
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 0 1px 1px 0;
  transition: width 0.3s;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding: 10px 20px 14px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.btn-accent {
  background: var(--accent);
  color: #111;
  font-weight: 600;
}

.btn-start {
  background: var(--accent);
  color: #111;
  font-weight: 600;
}

.btn-edit {
  background: #3b82f6;
  color: #fff;
}

.btn-share {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 500;
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.btn-transfer {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 500;
}

.btn-transfer:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.modal-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

@media (max-width: 480px) {
  .header {
    padding: 12px 16px;
  }
  .content {
    padding: 16px;
  }
  .card-actions {
    gap: 6px;
  }
  .card-actions button {
    font-size: 13px;
    padding: 6px 12px;
  }
}
</style>
