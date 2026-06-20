<script setup lang="ts">
import { useAccountSync } from './composables/useAccountSync'

useAccountSync()
</script>

<template>
  <RouterView />
</template>
