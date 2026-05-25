<script setup>
const props = defineProps({
  status: {
    type: String,
    required: true,
  },
})

const labels = {
  'round-robin': 'Group Stage',
  knockout: 'Knockout',
  completed: 'Completed',
  active: 'Active',
  upcoming: 'Upcoming',
  pending: 'Pending',
  waiting: 'Waiting',
  walkover: 'Walkover',
}
</script>

<template>
  <span class="category-status-badge" :class="`category-status-badge--${props.status}`">
    {{ labels[props.status] || props.status }}
  </span>
</template>

<style scoped>
.category-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.category-status-badge--completed {
  background: rgba(0, 181, 26, 0.08);
  color: #087524;
}

.category-status-badge--round-robin,
.category-status-badge--pending {
  background: #fef3c7;
  color: #d97706;
}

.category-status-badge--knockout,
.category-status-badge--active,
.category-status-badge--upcoming {
  background: #e8f0fb;
  color: #1d6fb5;
}

.category-status-badge--waiting {
  background: #f3f4f6;
  color: #6b7280;
}

.category-status-badge--walkover {
  background: #fdecea;
  color: #c0392b;
}
</style>
