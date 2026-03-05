<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'  
const { userName } = useAuth()
const usernameRef = ref(userName.value || '') // 默认用户名
</script>


<template>
  <div>
    Welcome, {{ usernameRef }}!
  </div>
</template>