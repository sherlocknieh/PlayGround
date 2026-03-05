<script setup lang="ts">
const props = defineProps({
    msg: {
        type: String,
        default: 'Hello, World!',
    },
})
</script>

<template>
    <div class="border rounded p-4">{{ props.msg }}</div>
</template>
