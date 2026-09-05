<script setup>
defineProps({
  variant: {
    type: String,
    default: 'members',
    validator: (value) =>
      ['members', 'one-ladder', 'multiple-ladders'].includes(value),
  },
})
</script>

<template>
  <div class="member-list-art" aria-hidden="true">
    <svg
      v-if="variant === 'one-ladder'"
      viewBox="0 0 220 150"
    >
      <rect
        x="42"
        y="28"
        width="92"
        height="94"
        rx="12"
        fill="#fff"
        stroke="#dfe8e1"
      />
      <path
        d="M60 52h48M60 70h48M60 88h48M60 106h30"
        stroke="#a7b6ab"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M158 37v80M185 37v80M158 55h27M158 74h27M158 93h27"
        stroke="#29362e"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle
        cx="173"
        cy="117"
        r="15"
        fill="#eef9f0"
        stroke="#08ad2b"
        stroke-width="2"
      />
      <path
        d="m168 117 4 4 7-8"
        fill="none"
        stroke="#08ad2b"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <svg
      v-else-if="variant === 'multiple-ladders'"
      viewBox="0 0 220 150"
    >
      <rect
        x="34"
        y="31"
        width="86"
        height="90"
        rx="12"
        fill="#fff"
        stroke="#dfe8e1"
      />
      <path
        d="M52 54h46M52 72h46M52 90h34M52 108h40"
        stroke="#a7b6ab"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M141 39v73M160 39v73M141 56h19M141 74h19M141 92h19"
        stroke="#29362e"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M174 51v61M193 51v61M174 67h19M174 84h19M174 101h19"
        stroke="#08ad2b"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>

    <svg
      v-else
      viewBox="0 0 220 150"
    >
      <rect
        x="48"
        y="28"
        width="124"
        height="94"
        rx="13"
        fill="#fff"
        stroke="#dfe8e1"
      />
      <circle
        cx="76"
        cy="57"
        r="10"
        fill="#eef9f0"
        stroke="#08ad2b"
        stroke-width="2"
      />
      <circle
        cx="76"
        cy="83"
        r="10"
        fill="#f4f7f4"
        stroke="#bdc9c0"
        stroke-width="2"
      />
      <circle
        cx="76"
        cy="109"
        r="10"
        fill="#f4f7f4"
        stroke="#bdc9c0"
        stroke-width="2"
      />
      <path
        d="M97 53h49M97 61h31M97 79h49M97 87h36M97 105h49M97 113h27"
        stroke="#9faca2"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle cx="164" cy="37" r="14" fill="#08ad2b" />
      <path
        d="M164 30v14M157 37h14"
        stroke="#fff"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.member-list-art {
  width: 220px;
  height: 150px;
}

.member-list-art svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
