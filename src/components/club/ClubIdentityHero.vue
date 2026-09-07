<script setup>
import { computed } from 'vue'
import { clubCoverStyle } from '../../utils/club/clubMedia.js'

const props = defineProps({
  name: { type: String, default: 'Your club' },
  location: { type: String, default: '' },
  roleLabel: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  coverPreset: { type: String, default: 'court-green' },
  memberCount: { type: Number, default: 0 },
  ladderCount: { type: Number, default: 0 },
  tournamentCount: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['edit-appearance'])

const initials = computed(() =>
  String(props.name || 'Club')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CL',
)

const coverStyle = computed(() =>
  props.coverUrl ? undefined : clubCoverStyle(props.coverPreset),
)
</script>

<template>
  <section
    class="club-identity-hero"
    :class="{ 'club-identity-hero--compact': compact }"
  >
    <div class="club-identity-hero__cover" :style="coverStyle">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="`${name} cover`"
      />

      <span v-else class="club-identity-hero__court" aria-hidden="true">
        <svg viewBox="0 0 440 150" fill="none">
          <rect x="52" y="18" width="336" height="114" rx="2" />
          <path d="M82 18v114M358 18v114M52 75h336M82 47h276M82 103h276M220 47v56" />
        </svg>
      </span>

      <button
        v-if="editable"
        class="club-identity-hero__edit"
        type="button"
        @click="emit('edit-appearance')"
      >
        Edit appearance
      </button>
    </div>

    <div class="club-identity-hero__body">
      <div class="club-identity-hero__identity">
        <span class="club-identity-hero__logo" aria-hidden="true">
          <img v-if="logoUrl" :src="logoUrl" alt="" />
          <span v-else>{{ initials }}</span>
        </span>

        <div class="club-identity-hero__copy">
          <h1>{{ name }}</h1>
          <p>{{ location || 'Location not added yet' }}</p>
          <small v-if="roleLabel">{{ roleLabel }}</small>
        </div>
      </div>

      <div class="club-identity-hero__stats" aria-label="Club summary">
        <span><strong>{{ memberCount }}</strong> members</span>
        <i aria-hidden="true"></i>
        <span><strong>{{ ladderCount }}</strong> ladders</span>
        <i aria-hidden="true"></i>
        <span><strong>{{ tournamentCount }}</strong> tournaments</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.club-identity-hero {
  display: grid;
  width: 100%;
  min-width: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.club-identity-hero__cover {
  position: relative;
  width: 100%;
  height: clamp(112px, 10vw, 152px);
  overflow: hidden;
  border-radius: 20px;
  background: #e8f1ea;
  isolation: isolate;
}

.club-identity-hero__cover::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(
      180deg,
      rgba(8, 36, 22, 0.02) 20%,
      rgba(8, 36, 22, 0.14) 100%
    );
  pointer-events: none;
  content: '';
}

.club-identity-hero__cover > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-identity-hero__court {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0.3;
}

.club-identity-hero__court svg {
  width: min(76%, 620px);
  height: auto;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 1.25;
}

.club-identity-hero__edit {
  position: absolute;
  z-index: 2;
  right: 12px;
  bottom: 12px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(22, 61, 43, 0.78);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition:
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}

.club-identity-hero__body {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 28px;
  padding: 0 8px 4px;
}

.club-identity-hero__identity {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  gap: 15px;
}

.club-identity-hero__logo {
  display: grid;
  width: 82px;
  height: 82px;
  flex: 0 0 82px;
  place-items: center;
  margin-top: -34px;
  overflow: hidden;
  border: 0;
  border-radius: 22px;
  background: #eef4ef;
  color: #347b49;
  box-shadow: 0 10px 28px rgba(18, 56, 34, 0.12);
  font-size: 17px;
  font-weight: 650;
}

.club-identity-hero__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-identity-hero__copy {
  min-width: 0;
  padding: 13px 0 4px;
}

.club-identity-hero__copy h1 {
  margin: 0;
  overflow: hidden;
  color: var(--g-ink, #28332c);
  font-size: 22px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.032em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-identity-hero__copy p {
  margin: 4px 0 0;
  color: var(--g-muted, #778079);
  font-size: 10.8px;
  line-height: 1.45;
}

.club-identity-hero__copy small {
  display: block;
  margin-top: 3px;
  color: #607066;
  font-size: 9.4px;
  line-height: 1.4;
}

/* Stats feel like profile data, not pills/cards. */
.club-identity-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  align-items: end;
  justify-content: end;
  gap: 26px;
  padding-bottom: 5px;
  color: #7a857d;
  font-size: 9px;
  line-height: 1.2;
  white-space: nowrap;
}

.club-identity-hero__stats span {
  display: grid;
  gap: 2px;
}

.club-identity-hero__stats strong {
  display: block;
  color: #334139;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1;
}

.club-identity-hero__stats i {
  display: none;
}

.club-identity-hero--compact .club-identity-hero__cover {
  height: 84px;
  border-radius: 17px;
}

.club-identity-hero--compact .club-identity-hero__logo {
  width: 64px;
  height: 64px;
  flex-basis: 64px;
  margin-top: -25px;
  border-radius: 18px;
  font-size: 13px;
}

.club-identity-hero--compact .club-identity-hero__body {
  gap: 18px;
}

.club-identity-hero--compact .club-identity-hero__copy {
  padding-top: 10px;
}

.club-identity-hero--compact .club-identity-hero__copy h1 {
  font-size: 17px;
}

.club-identity-hero--compact .club-identity-hero__stats {
  gap: 16px;
}

.club-identity-hero--compact .club-identity-hero__stats strong {
  font-size: 13px;
}

@media (hover: hover) and (pointer: fine) {
  .club-identity-hero__edit:hover {
    background: rgba(16, 52, 35, 0.92);
  }
}

.club-identity-hero__edit:active {
  transform: scale(0.97);
}

@media (max-width: 700px) {
  .club-identity-hero__cover {
    height: 94px;
    border-radius: 16px;
  }

  .club-identity-hero__body {
    grid-template-columns: 1fr;
    gap: 13px;
    padding: 0 4px 2px;
  }

  .club-identity-hero__identity {
    gap: 11px;
  }

  .club-identity-hero__logo {
    width: 68px;
    height: 68px;
    flex-basis: 68px;
    margin-top: -26px;
    border-radius: 18px;
  }

  .club-identity-hero__copy {
    padding-top: 10px;
  }

  .club-identity-hero__copy h1 {
    font-size: 18px;
  }

  .club-identity-hero__stats {
    justify-content: start;
    gap: 22px;
    padding: 2px 0 0 79px;
  }

  .club-identity-hero__stats strong {
    font-size: 14px;
  }

  .club-identity-hero__edit {
    right: 9px;
    bottom: 9px;
  }
}

@media (max-width: 430px) {
  .club-identity-hero__stats {
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .club-identity-hero__edit {
    transition: background-color 120ms ease;
    transform: none !important;
  }
}
</style>

