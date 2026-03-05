<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'  
const { user } = useAuth()
const usernameRef = ref(user.value?.email || '') // 默认用户名
</script>


<template>
  <div>
    Welcome, {{ usernameRef }}!
  </div>
</template>