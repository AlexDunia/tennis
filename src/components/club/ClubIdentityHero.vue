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
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 14px;
  background: #fff;
}

.club-identity-hero__cover {
  position: relative;
  width: 100%;
  height: clamp(90px, 9vw, 118px);
  overflow: hidden;
  background: #eef4ef;
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
  opacity: 0.24;
}

.club-identity-hero__court svg {
  width: min(78%, 560px);
  height: auto;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 1.35;
}

.club-identity-hero__edit {
  position: absolute;
  right: 14px;
  bottom: 14px;
  min-height: 36px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.92);
  color: #3d4a41;
  font-size: 10.5px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.club-identity-hero__body {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: 26px;
  padding: 0 22px 22px;
}

.club-identity-hero__identity {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  gap: 16px;
}

.club-identity-hero__logo {
  display: grid;
  width: 92px;
  height: 92px;
  flex: 0 0 92px;
  place-items: center;
  margin-top: -36px;
  overflow: hidden;
  border: 5px solid #fff;
  border-radius: 24px;
  background: #eef4ef;
  color: #377c48;
  box-shadow: 0 8px 24px rgba(25, 43, 31, 0.08);
  font-size: 18px;
  font-weight: 600;
}

.club-identity-hero__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-identity-hero__copy {
  min-width: 0;
  padding-top: 15px;
}

.club-identity-hero__copy h1 {
  margin: 0;
  overflow: hidden;
  color: var(--g-ink, #28332c);
  font-size: 23px;
  font-weight: 600;
  line-height: 1.22;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-identity-hero__copy p {
  margin: 5px 0 0;
  color: var(--g-muted, #7d8780);
  font-size: 12px;
  line-height: 1.45;
}

.club-identity-hero__copy small {
  display: block;
  margin-top: 3px;
  color: #68756c;
  font-size: 10px;
  line-height: 1.4;
}

.club-identity-hero__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  padding-bottom: 4px;
  color: #758078;
  font-size: 10.8px;
  white-space: nowrap;
}

.club-identity-hero__stats strong {
  color: #465149;
  font-size: 11.5px;
  font-weight: 600;
}

.club-identity-hero__stats i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #bdc5bf;
}

.club-identity-hero--compact .club-identity-hero__cover {
  height: 69px;
}

.club-identity-hero--compact .club-identity-hero__logo {
  width: 68px;
  height: 68px;
  flex-basis: 68px;
  margin-top: -27px;
  border-width: 4px;
  border-radius: 18px;
  font-size: 13px;
}

.club-identity-hero--compact .club-identity-hero__body {
  display: grid;
  gap: 14px;
  padding: 0 17px 17px;
}

.club-identity-hero--compact .club-identity-hero__copy {
  padding-top: 11px;
}

.club-identity-hero--compact .club-identity-hero__copy h1 {
  font-size: 15px;
}

.club-identity-hero--compact .club-identity-hero__stats {
  justify-content: flex-start;
  padding: 0;
  font-size: 9.5px;
}

@media (max-width: 700px) {
  .club-identity-hero__cover {
    height: 76px;
  }

  .club-identity-hero__body {
    display: grid;
    gap: 18px;
    padding: 0 16px 18px;
  }

  .club-identity-hero__identity {
    align-items: flex-end;
    gap: 12px;
  }

  .club-identity-hero__logo {
    width: 78px;
    height: 78px;
    flex-basis: 78px;
    margin-top: -30px;
    border-width: 4px;
    border-radius: 20px;
  }

  .club-identity-hero__copy h1 {
    font-size: 19px;
  }

  .club-identity-hero__stats {
    justify-content: flex-start;
    padding-bottom: 0;
    white-space: normal;
  }

  .club-identity-hero__edit {
    right: 10px;
    bottom: 10px;
  }
}
</style>

