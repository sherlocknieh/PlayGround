<!-- 设置面板 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = useAuthStore()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const deleteMessage = ref('')
const deleteInput = ref('')

const canDelete = computed(() => deleteInput.value === '删除')

const close = () => emit('update:modelValue', false)

const handleDeleteAccount = async () => {
  if (!canDelete.value) return
  deleteLoading.value = true
  deleteMessage.value = ''
  try {
    await auth.deleteAccount()
    deleteMessage.value = '账户已删除'
    setTimeout(() => router.push({ name: 'home' }), 1500)
  } catch (error: any) {
    deleteMessage.value = error?.message || '删除失败，请重试'
  } finally {
    deleteLoading.value = false
    // 刷新页面
    window.location.reload()
    // 登出
    await auth.signOut()
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
          <button @click="close" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-bold">设置</h2>
          </div>

          <div class="border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/20">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-red-600 dark:text-red-400 font-semibold">危险区域</h3>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">删除账户后，你的所有数据将被永久清除，此操作不可恢复。</p>

            <div v-if="!showDeleteConfirm">
              <button @click="showDeleteConfirm = true" class="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 font-medium">删除账户</button>
            </div>

            <div v-else class="space-y-3">
              <p class="font-medium text-gray-700 dark:text-gray-300">确定要删除账户吗？请输入"删除"以确认。</p>
              <input v-model="deleteInput" type="text" name="delete-input" placeholder="删除" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
              <div class="flex gap-3">
                <button @click="handleDeleteAccount" :disabled="deleteLoading || !canDelete" class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg disabled:opacity-50">{{ deleteLoading ? '删除中...' : '确认删除' }}</button>
                <button @click="showDeleteConfirm = false; deleteInput = ''" :disabled="deleteLoading" class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg">取消</button>
              </div>
              <p v-if="deleteMessage" class="text-sm font-medium" :class="deleteMessage.includes('已删除') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ deleteMessage }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
