<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  standings: {
    type: Array,
    required: true,
  },
  qualifiers: {
    type: Number,
    default: 4,
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <section class="standings-table">
    <div class="standings-table__header">
      <div>
        <h3>{{ title }}</h3>
        <p>
          Top {{ qualifiers }} go through. Ties use points, sets, then games.
        </p>
      </div>
    </div>
    <div class="standings-table__scroll">
      <table class="gorra-directory-table">
        <thead>
          <tr>
            <th title="Rank">Rank</th>
            <th>Player</th>
            <th title="Matches played" class="standings-table__wide">MP</th>
            <th title="Wins" class="standings-table__wide">W</th>
            <th title="Losses" class="standings-table__wide">L</th>
            <th title="Points (1 per win)">Pts</th>
            <th title="Set difference (sets won minus sets lost)">SD</th>
            <th title="Game difference (games won minus games lost)" class="standings-table__wide">GD</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="standing in standings"
            :key="standing.playerId"
            :class="{
              'standings-table__qualified': standing.qualified,
              'standings-table__current-player': currentPlayerId === standing.playerId,
            }"
          >
            <td>#{{ standing.rank }}</td>
            <td>
              <strong>{{ standing.name }}</strong>
              <span v-if="standing.qualified">Q</span>
              <span v-if="currentPlayerId === standing.playerId" class="standings-table__you">You</span>
            </td>
            <td class="standings-table__wide">{{ standing.matchesPlayed }}</td>
            <td class="standings-table__wide">{{ standing.wins }}</td>
            <td class="standings-table__wide">{{ standing.losses }}</td>
            <td>{{ standing.points }}</td>
            <td>{{ standing.setDiff }}</td>
            <td class="standings-table__wide">{{ standing.gameDiff }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.standings-table {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.standings-table__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.standings-table h3,
.standings-table p {
  margin: 0;
}

.standings-table h3 {
  font-size: var(--type-section-title);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
}

.standings-table__scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 34rem;
}

.standings-table__qualified td:first-child {
  box-shadow: inset 3px 0 0 var(--tournament-green);
}

.standings-table__current-player td {
  border-color: color-mix(in srgb, var(--tournament-green) 24%, var(--color-border));
  background: color-mix(in srgb, var(--tournament-green) 5%, var(--color-surface));
}

td span {
  margin-left: 0.45rem;
  border-radius: 999px;
  padding: 0.1rem 0.35rem;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 0.7rem;
  font-weight: var(--font-weight-semibold);
}

td span.standings-table__you {
  background: #ffffff;
  color: var(--tournament-green-dark);
}

.standings-table p {
  margin-top: 5px;
  color: var(--tournament-muted);
  font-size: var(--type-page-description);
  line-height: 1.5;
}

@media (max-width: 480px) {
  table {
    min-width: 22rem;
  }

  .standings-table__wide {
    display: none;
  }
}
</style>
