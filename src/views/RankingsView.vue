<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

const router = useRouter()
const playerStore = usePlayerStore()

const sortedPlayers = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)

const winRate = computed(() => {
  const p = currentPlayer.value
  if (!p) return '—'
  const total = p.wins + p.losses
  if (total === 0) return '—'
  return `${Math.round((p.wins / total) * 100)}%`
})

const initials = computed(() => {
  if (!currentPlayer.value?.name) return '??'
  const parts = currentPlayer.value.name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return currentPlayer.value.name.slice(0, 2).toUpperCase()
})

const challengeablePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'challengeable'),
)

const selfPlayer = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'self'),
)

const outOfRangePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'out-of-range'),
)

const handleChallenge = (playerId) => {
  router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
}

const getInitials = (name) => {
  const parts = (name ?? '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

const calcWinRate = (player) => {
  const total = player.wins + player.losses
  if (total === 0) return '—'
  return `${Math.round((player.wins / total) * 100)}%`
}

const loadRankings = async () => {
  try {
    await playerStore.loadPlayers()
  } catch {
    // error already stored in playerStore.error
  }
}

onMounted(() => loadRankings())

/* search & share */
const searchQuery = ref('')
const showShareMenu = ref(false)
const showShareCard = ref(false)
const isGeneratingImage = ref(false)

const filteredPlayers = (players) => {
  if (!searchQuery.value.trim()) return players
  const q = searchQuery.value.trim().toLowerCase()
  return players.filter((p) => p.name.toLowerCase().includes(q))
}

const toggleShareMenu = () => {
  showShareMenu.value = !showShareMenu.value
  showShareCard.value = false
}

const closeShareMenu = () => {
  showShareMenu.value = false
}

const openShareCard = () => {
  showShareMenu.value = false
  showShareCard.value = true
}

const closeShareCard = () => {
  showShareCard.value = false
}

const top5 = computed(() => sortedPlayers.value.slice(0, 5))

const shareToWhatsApp = () => {
  const rank = currentPlayer.value?.rank ?? '—'
  const name = currentPlayer.value?.name ?? ''
  const text = encodeURIComponent(
    `Check out the ShellTennis leaderboard! Current rank #${rank} — ${name}. ${window.location.href}`,
  )
  window.open(`https://wa.me/?text=${text}`, '_blank')
  closeShareMenu()
}

const shareToFacebook = () => {
  const url = encodeURIComponent(window.location.href)
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank')
  closeShareMenu()
}

const shareToInstagram = () => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      alert('Link copied to clipboard! Paste it in your Instagram story or bio.')
    })
    .catch(() => {
      alert('Copy this link to share on Instagram: ' + window.location.href)
    })
  closeShareMenu()
}

const downloadShareCard = async () => {
  isGeneratingImage.value = true
  try {
    const { default: html2canvas } =
      await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js')
    const el = document.getElementById('shareable-card')
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0a1018',
    })
    const link = document.createElement('a')
    link.download = 'shelltennis-ranking.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch {
    const el = document.getElementById('shareable-card')
    if (el) {
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(
          `<!DOCTYPE html><html><body style="margin:0;background:#0a1018">${el.outerHTML}</body></html>`,
        )
        win.document.close()
      }
    }
  } finally {
    isGeneratingImage.value = false
  }
}

const shareLinks = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    action: shareToWhatsApp,
    icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    action: shareToFacebook,
    icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    action: shareToInstagram,
    icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  },
]
</script>

<template>
  <section class="rankings">
    <!-- Loading -->
    <div v-if="playerStore.isLoading" class="rankings__loading">
      <p>Loading ladder…</p>
    </div>

    <!-- Error -->
    <div v-else-if="playerStore.error" class="rankings__error">
      <p class="rankings__error-title">Failed to load rankings</p>
      <p class="rankings__error-copy">{{ playerStore.error }}</p>
      <button class="rankings__retry" @click="loadRankings">Retry</button>
    </div>

    <template v-else>
      <!-- Your Position — full width -->
      <div v-if="currentPlayer" class="card primary full-width-card">
        <img
          class="ball"
          src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776969016/ujk_nf7ts1.png"
          alt=""
        />

        <div class="section-title">Your Position</div>

        <div class="position-body">
          <div class="identity">
            <div class="avatar large-avatar">{{ initials }}</div>
            <div>
              <div class="name large-name">{{ currentPlayer.name }}</div>
              <div class="rank-sub">Rank #{{ currentPlayer.rank }}</div>
            </div>
          </div>

          <div class="expanded-stats">
            <div class="stat">
              <strong>{{ currentPlayer.wins }}</strong>
              <span>Wins</span>
            </div>
            <div class="stat">
              <strong>{{ currentPlayer.losses }}</strong>
              <span>Losses</span>
            </div>
            <div class="stat">
              <strong>{{ winRate }}</strong>
              <span>Win Rate</span>
            </div>
            <div class="stat">
              <strong>{{ currentPlayer.matchesPlayed }}</strong>
              <span>Played</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div v-if="sortedPlayers.length > 0" class="leaderboard-container">
        <!-- Header -->
        <div class="leaderboard-top">
          <div class="leaderboard-title">Leaderboard</div>

          <div class="leaderboard-controls">
            <div class="search-wrap">
              <svg class="search-icon" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M13.5 13.5L17 17"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              <input
                v-model="searchQuery"
                class="search-input"
                type="text"
                placeholder="Search for users"
              />
            </div>

            <div class="share-wrap">
              <button class="share-btn" @click.stop="toggleShareMenu">
                <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <circle cx="15" cy="4" r="2" stroke="currentColor" stroke-width="1.5" />
                  <circle cx="5" cy="10" r="2" stroke="currentColor" stroke-width="1.5" />
                  <circle cx="15" cy="16" r="2" stroke="currentColor" stroke-width="1.5" />
                  <path
                    d="M7 8.8L13 5.2M7 11.2L13 14.8"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                Share
              </button>

              <div v-if="showShareMenu" class="share-dropdown" @click.stop>
                <p class="share-dropdown-label">Share leaderboard</p>
                <ul class="share-options">
                  <li v-for="s in shareLinks" :key="s.id" class="share-option" @click="s.action()">
                    <span class="share-platform-icon" :style="{ color: s.color }" v-html="s.icon" />
                    <span>{{ s.label }}</span>
                  </li>
                  <li class="share-option share-option--save" @click="openShareCard">
                    <span class="share-platform-icon save-icon">
                      <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                        <rect
                          x="3"
                          y="3"
                          width="14"
                          height="14"
                          rx="3"
                          stroke="currentColor"
                          stroke-width="1.5"
                        />
                        <path
                          d="M10 7v6M7 10l3 3 3-3"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>
                    <span>Save as Image</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="leaderboard-inner">
          <div class="leaderboard-header">
            <div>Rank</div>
            <div>Player</div>
            <div>W</div>
            <div>L</div>
            <div>WR</div>
            <div></div>
          </div>

          <!-- Challengeable -->
          <template v-if="filteredPlayers(challengeablePlayers).length > 0">
            <div class="zone-bar zone-bar--green">
              <span class="zone-dot zone-dot--green" />
              <span class="zone-label zone-label--green">
                Challenge window —
                {{ filteredPlayers(challengeablePlayers).length }}
                {{
                  filteredPlayers(challengeablePlayers).length === 1 ? 'player' : 'players'
                }}
                above you
              </span>
            </div>
            <div
              v-for="player in filteredPlayers(challengeablePlayers)"
              :key="player.id"
              class="leaderboard-row challengeable"
            >
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar row-avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div class="action">
                <button class="btn" @click="handleChallenge(player.id)">Challenge</button>
              </div>
            </div>
          </template>

          <!-- Self -->
          <template v-if="filteredPlayers(selfPlayer).length > 0">
            <div class="zone-bar zone-bar--amber">
              <span class="zone-dot zone-dot--amber" />
              <span class="zone-label zone-label--amber">Your position</span>
            </div>
            <div
              v-for="player in filteredPlayers(selfPlayer)"
              :key="player.id"
              class="leaderboard-row you"
            >
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar row-avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
                <span class="tag">YOU</span>
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div></div>
            </div>
          </template>

          <!-- Out of range -->
          <template v-if="filteredPlayers(outOfRangePlayers).length > 0">
            <div class="zone-bar">
              <span class="zone-dot" />
              <span class="zone-label">Out of challenge range</span>
            </div>
            <div
              v-for="player in filteredPlayers(outOfRangePlayers)"
              :key="player.id"
              class="leaderboard-row"
            >
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar row-avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div></div>
            </div>
          </template>

          <!-- No results -->
          <div
            v-if="
              searchQuery.trim() &&
              filteredPlayers(challengeablePlayers).length === 0 &&
              filteredPlayers(selfPlayer).length === 0 &&
              filteredPlayers(outOfRangePlayers).length === 0
            "
            class="no-search-results"
          >
            No players found for "{{ searchQuery }}"
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="rankings__empty">
        <p class="rankings__empty-title">No players on the ladder yet.</p>
        <p class="rankings__empty-copy">Check back once players have been added.</p>
      </div>
    </template>

    <!-- Backdrop to close share dropdown -->
    <div v-if="showShareMenu" class="share-overlay" @click="closeShareMenu" />

    <!-- Share Card Modal -->
    <teleport to="body">
      <div v-if="showShareCard" class="share-card-overlay" @click.self="closeShareCard">
        <div class="share-card-wrapper">
          <!-- Exportable card -->
          <div class="share-card-inner" id="shareable-card">
            <div class="sc-accent" />

            <div class="sc-header">
              <img
                class="sc-logo-img"
                src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776503502/RENAISSANCE-AFRICA-ENERGY-LOGO-update_s4eb9u.png"
                alt="Renaissance Africa Energy"
                crossorigin="anonymous"
              />
              <div class="sc-header-right">
                <div class="sc-event-label">TENNIS LADDER</div>
                <div class="sc-season-label">Rankings</div>
              </div>
            </div>

            <div v-if="currentPlayer" class="sc-hero">
              <div class="sc-hero-rank-col">
                <div class="sc-rank-number">#{{ currentPlayer.rank }}</div>
                <div class="sc-rank-label">YOUR RANK</div>
              </div>
              <div class="sc-hero-divider" />
              <div class="sc-hero-info">
                <div class="sc-hero-name">{{ currentPlayer.name }}</div>
                <div class="sc-hero-stats">
                  <span>{{ currentPlayer.wins }}W</span>
                  <span class="sc-dot">·</span>
                  <span>{{ currentPlayer.losses }}L</span>
                  <span class="sc-dot">·</span>
                  <span>{{ winRate }} WR</span>
                </div>
              </div>
            </div>

            <div class="sc-section-header">
              <span class="sc-section-line" />
              <span class="sc-section-text">TOP 5 PLAYERS</span>
              <span class="sc-section-line" />
            </div>

            <ul class="sc-list">
              <li
                v-for="(player, index) in top5"
                :key="player.id"
                class="sc-list-row"
                :class="{ 'sc-list-row--you': currentPlayer && player.id === currentPlayer.id }"
              >
                <span class="sc-list-num">{{ index + 1 }}</span>
                <span class="sc-list-name">{{ player.name }}</span>
                <span class="sc-list-wr">{{ calcWinRate(player) }}</span>
                <span v-if="currentPlayer && player.id === currentPlayer.id" class="sc-you-tag"
                  >YOU</span
                >
              </li>
            </ul>

            <div class="sc-footer">Renaissance Africa Energy Company Limited</div>
          </div>

          <!-- Actions -->
          <div class="share-card-actions">
            <button class="share-card-close-btn" @click="closeShareCard">Close</button>
            <button
              class="share-card-download-btn"
              :disabled="isGeneratingImage"
              @click="downloadShareCard"
            >
              <svg v-if="!isGeneratingImage" viewBox="0 0 20 20" fill="none" width="15" height="15">
                <path
                  d="M10 3v10M6 9l4 4 4-4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M4 16h12"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              {{ isGeneratingImage ? 'Generating…' : 'Download Image' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </section>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

.rankings {
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: grid;
  gap: 32px;
  width: 100%;
  box-sizing: border-box;
}

.rankings__loading {
  padding: 3rem 1rem;
  text-align: center;
  color: #7b8794;
  font-size: 14px;
}

.rankings__error {
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  display: grid;
  gap: 8px;
}
.rankings__error-title {
  font-weight: 600;
  font-size: 14px;
  color: #0f1720;
}
.rankings__error-copy {
  color: #7b8794;
  font-size: 13px;
}
.rankings__retry {
  justify-self: start;
  background: #00c853;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
}

/* FULL WIDTH POSITION CARD */
.card {
  padding: 22px 24px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.full-width-card {
  width: 100%;
}

.card.primary {
  position: relative;
  overflow: hidden;
  color: #f4fff7;
  border: none;
  box-shadow: 0 10px 24px rgba(0, 200, 83, 0.1);
}
.card.primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #00b84a 0%, #4cd964 50%, #c6f300 100%);
  opacity: 0.85;
  z-index: 0;
}
.card.primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.07);
  z-index: 0;
}
.card.primary .ball {
  position: absolute;
  right: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 260px;
  opacity: 0.22;
  filter: blur(1px);
  z-index: 1;
}
.card.primary > * {
  position: relative;
  z-index: 2;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7b8794;
  margin-bottom: 16px;
}
.card.primary .section-title {
  color: rgba(255, 255, 255, 0.65);
}

.position-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.identity {
  display: flex;
  gap: 14px;
  align-items: center;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eef2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}
.large-avatar {
  width: 58px;
  height: 58px;
  font-size: 17px;
}
.card.primary .avatar {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.name {
  font-size: 14px;
  font-weight: 500;
}
.large-name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.rank-sub {
  font-size: 12px;
  color: #7b8794;
  margin-top: 3px;
}
.card.primary .rank-sub {
  color: rgba(255, 255, 255, 0.72);
}

.expanded-stats {
  display: flex;
  flex: 1;
  max-width: 520px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  padding-left: 24px;
}

.stat {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  position: relative;
}
.stat:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.22);
}
.stat strong {
  display: block;
  font-size: 22px;
  font-weight: 700;
}
.stat span {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

.btn {
  background: #00c853;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  cursor: pointer;
}
.btn--sm {
  padding: 4px 10px;
  font-size: 12px;
}

/* LEADERBOARD */
.leaderboard-container {
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.leaderboard-top {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
}

.leaderboard-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #0f1720;
  flex-shrink: 0;
}

.leaderboard-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

/* Search — fixed width so it never shifts layout */
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 196px;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: #7b8794;
  pointer-events: none;
  z-index: 1;
}

.search-input {
  height: 34px;
  padding: 0 12px 0 32px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  background: #f7f9fb;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  transition:
    border-color 0.15s,
    background 0.15s;
  display: block;
}
.search-input::placeholder {
  color: #aab2ba;
}
.search-input:focus {
  border-color: #00c853;
  background: #fff;
}

/* Share */
.share-wrap {
  position: relative;
  flex-shrink: 0;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  color: #0f1720;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
  white-space: nowrap;
}
.share-btn:hover {
  border-color: #00c853;
  background: rgba(0, 200, 83, 0.04);
}

.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.share-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}
.share-dropdown-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aab2ba;
  padding: 12px 14px 6px;
}
.share-options {
  list-style: none;
  padding: 0 0 8px;
  margin: 0;
}

.share-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  font-size: 13px;
  color: #0f1720;
  cursor: pointer;
  transition: background 0.1s;
}
.share-option:hover {
  background: #f7f9fb;
}

.share-platform-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.share-platform-icon svg {
  width: 18px;
  height: 18px;
}

.share-option--save {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  margin-top: 4px;
  padding-top: 13px;
  color: #00843a;
  font-weight: 500;
}
.save-icon {
  color: #00c853;
}

.no-search-results {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: #7b8794;
}

.leaderboard-inner {
  padding: 12px 20px 10px;
}

.leaderboard-header {
  display: grid;
  grid-template-columns: 60px 1fr 60px 60px 80px 120px;
  font-size: 12px;
  color: #7b8794;
  padding-bottom: 6px;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 60px 1fr 60px 60px 80px 120px;
  align-items: center;
  padding: 13px 0;
}
.leaderboard-row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.leaderboard-row.you {
  background: rgba(255, 211, 61, 0.08);
  border-radius: 8px;
  padding: 13px 8px;
  margin: 0 -8px;
}
.leaderboard-row.challengeable {
  background: rgba(0, 200, 83, 0.04);
  border-radius: 8px;
  padding: 13px 8px;
  margin: 0 -8px;
}

.player {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.row-avatar {
  width: 32px;
  height: 32px;
  font-size: 11px;
  flex-shrink: 0;
}
.tag {
  font-size: 10px;
  background: #ffd33d;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.winrate {
  color: #00c853;
  font-size: 13px;
  font-weight: 500;
}
.action {
  display: flex;
  justify-content: flex-end;
}

.zone-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin: 4px -8px;
  border-radius: 6px;
}
.zone-bar--green {
  background: rgba(0, 200, 83, 0.05);
}
.zone-bar--amber {
  background: rgba(255, 211, 61, 0.08);
}

.zone-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.zone-dot--green {
  background: #00c853;
}
.zone-dot--amber {
  background: #f5a623;
}

.zone-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #7b8794;
}
.zone-label--green {
  color: #00843a;
}
.zone-label--amber {
  color: #845f00;
}

.rankings__empty {
  padding: 2rem 1.5rem;
  text-align: center;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.rankings__empty-title {
  font-weight: 600;
  font-size: 14px;
  color: #0f1720;
}
.rankings__empty-copy {
  margin-top: 0.4rem;
  color: #7b8794;
  font-size: 13px;
}

/* ═══════════════════════════════
   SHARE CARD MODAL — FIFA / UCL style
═══════════════════════════════ */
.share-card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 14, 22, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.share-card-wrapper {
  width: 100%;
  max-width: 400px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);
}

.share-card-inner {
  position: relative;
  background: #0a1018;
  font-family: 'Poppins', sans-serif;
  overflow: hidden;
}

/* glowing circle accent top-right */
.sc-accent {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(0, 200, 83, 0.28) 0%, transparent 70%);
  z-index: 0;
  pointer-events: none;
}

.sc-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sc-logo-img {
  height: 38px;
  width: auto;
  object-fit: contain;
  display: block;
}

.sc-header-right {
  text-align: right;
}

.sc-event-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #00c853;
  text-transform: uppercase;
}

.sc-season-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.02em;
  margin-top: 1px;
}

.sc-hero {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 24px 22px;
  background: linear-gradient(90deg, rgba(0, 200, 83, 0.14) 0%, rgba(0, 200, 83, 0.02) 100%);
  border-bottom: 1px solid rgba(0, 200, 83, 0.12);
  gap: 0;
}

.sc-hero-rank-col {
  text-align: center;
  padding-right: 22px;
  min-width: 78px;
}

.sc-rank-number {
  font-size: 52px;
  font-weight: 700;
  color: #00c853;
  line-height: 1;
  letter-spacing: -2px;
}

.sc-rank-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 4px;
}

.sc-hero-divider {
  width: 1px;
  height: 52px;
  background: rgba(0, 200, 83, 0.28);
  flex-shrink: 0;
  margin-right: 22px;
}

.sc-hero-info {
  flex: 1;
}

.sc-hero-name {
  font-size: 19px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.sc-hero-stats {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
}
.sc-dot {
  color: rgba(255, 255, 255, 0.2);
}

.sc-section-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 22px 8px;
}
.sc-section-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
}
.sc-section-text {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  white-space: nowrap;
}

.sc-list {
  position: relative;
  z-index: 1;
  list-style: none;
  padding: 0 22px 10px;
  margin: 0;
}

.sc-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 8px;
}

.sc-list-row--you {
  background: rgba(0, 200, 83, 0.11);
  border: 1px solid rgba(0, 200, 83, 0.22);
}

.sc-list-num {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.28);
  min-width: 18px;
  text-align: center;
}
.sc-list-row--you .sc-list-num {
  color: #00c853;
}

.sc-list-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}
.sc-list-row--you .sc-list-name {
  color: #fff;
  font-weight: 600;
}

.sc-list-wr {
  font-size: 12px;
  font-weight: 600;
  color: #00c853;
}

.sc-you-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: #00c853;
  color: #0a1018;
  padding: 2px 7px;
  border-radius: 4px;
}

.sc-footer {
  position: relative;
  z-index: 1;
  padding: 14px 22px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 0.05em;
  text-align: center;
}

.share-card-actions {
  display: flex;
  background: #111820;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.share-card-close-btn {
  flex: 1;
  padding: 15px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  cursor: pointer;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.15s;
}
.share-card-close-btn:hover {
  background: rgba(255, 255, 255, 0.04);
}

.share-card-download-btn {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 15px;
  border: none;
  background: #00c853;
  color: #fff;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.share-card-download-btn:hover {
  background: #00b048;
}
.share-card-download-btn:disabled {
  background: #4d9966;
  cursor: not-allowed;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .position-body {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  .expanded-stats {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-left: 0;
    padding-top: 16px;
    width: 100%;
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .leaderboard-top {
    flex-wrap: wrap;
    gap: 10px;
  }
  .leaderboard-controls {
    width: 100%;
    margin-left: 0;
  }
  .search-wrap {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}

@media (max-width: 600px) {
  .leaderboard-header {
    display: none;
  }
}
</style>
