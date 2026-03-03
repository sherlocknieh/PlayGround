<script setup lang="ts">
const props = defineProps({
    msg: {
        type: String,
        default: '登录组件',
    },
})
</script>

<template>
    <div class="border rounded p-4">{{ props.msg }}</div>
</template>
