<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const username = ref(auth.user?.email || '') // 默认用户名
</script>

<template>
  <div>
    Welcome, {{ username }}!
  </div>
</template>