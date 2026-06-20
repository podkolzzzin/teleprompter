<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccountSync } from '../composables/useAccountSync'

const route = useRoute()
const router = useRouter()
const { connectedDeviceIds, error, status, start, connectToDevice } = useAccountSync()

const deviceId = computed(() => route.params.deviceId as string)
const connected = computed(() => connectedDeviceIds.value.includes(deviceId.value))

onMounted(() => {
  if (!deviceId.value) {
    router.push('/')
    return
  }
  start()
  connectToDevice(deviceId.value)
})

watch(connected, (isConnected) => {
  if (isConnected) {
    setTimeout(() => router.push('/'), 800)
  }
})
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="logo">Teleprompter</h1>
    </header>

    <main class="content">
      <div class="state-box">
        <template v-if="connected">
          <p class="state-title">Account connected</p>
          <p class="state-sub">Scripts and active sessions will stay in sync while both devices are online.</p>
          <button class="btn-accent" @click="router.push('/')">Open Library</button>
        </template>

        <template v-else-if="status === 'error'">
          <p class="state-title">Connection failed</p>
          <p class="state-sub">{{ error }}</p>
          <button class="btn-back" @click="router.push('/')">Back</button>
        </template>

        <template v-else>
          <p class="state-title">Connecting account</p>
          <p class="state-sub">Keep the device with the QR code open until this completes.</p>
        </template>
      </div>
    </main>
  </div>
</template>

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
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
}

.state-box {
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.state-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.state-sub {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.btn-accent {
  background: var(--accent);
  color: #111;
  font-weight: 600;
}

.btn-back {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}
</style>
