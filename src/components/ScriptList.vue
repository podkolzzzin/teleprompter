<template>
  <div class="page">
    <header class="header">
      <h1 class="logo">📺 Teleprompter</h1>
      <button class="btn-accent" @click="router.push('/edit')">+ New Script</button>
    </header>

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
          <div class="card-actions">
            <button class="btn-start" @click.stop="router.push(`/teleprompter/${script.id}`)">▶ Start</button>
            <button class="btn-edit" @click.stop="router.push(`/edit/${script.id}`)">✏ Edit</button>
            <button class="btn-danger" @click.stop="confirmDelete(script.id!)">🗑 Delete</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllScripts, deleteScript, type Script } from '../storage/db'

const router = useRouter()
const scripts = ref<Script[]>([])

async function load() {
  scripts.value = await getAllScripts()
}

onMounted(load)

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

.btn-danger {
  background: var(--danger);
  color: #fff;
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
