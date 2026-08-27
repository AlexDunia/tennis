export const dashboardFixture = Object.freeze({
  currentUser: {
    id: 'player-alex-dunia',
    firstName: 'Alex',
    lastName: 'Dunia',
  },
  activeClub: {
    id: 'greenview-tennis-club',
    name: 'Greenview Tennis Club',
  },
  priorityCandidates: [
    {
      id: 'ready-match-james',
      family: 'V1-B',
      priority: 700,
      sortAt: 1748107800000,
      eyebrow: 'Your match is ready',
      title: 'You vs James',
      supportingText: 'Your scheduled singles match is ready to open.',
      category: "Men's Singles",
      court: 'Court 3',
      time: '6:30 PM',
      dateLabel: 'Today, May 24',
      ctaLabel: 'Open match',
      players: [
        {
          id: 'player-alex-dunia',
          name: 'Alex',
          image: 'https://i.pravatar.cc/160?img=47',
        },
        {
          id: 'player-james',
          name: 'James',
          image: 'https://i.pravatar.cc/160?img=12',
        },
      ],
      to: { name: 'Challenges' },
    },
  ],
  ladders: [
    {
      id: 'greenview-mens-singles',
      name: "Men's Singles",
      clubId: 'greenview-tennis-club',
      position: 2,
      playerCount: 12,
      challengeFrom: 1,
      challengeTo: 5,
    },
  ],
  quickActions: [
    {
      id: 'play-match',
      title: 'Play match',
      description: 'Play now or schedule a match',
      icon: 'play',
      image:
        'https://images.unsplash.com/photo-1551773188-0801da12ddae?auto=format&fit=crop&fm=jpg&q=78&w=1100',
      to: { name: 'Play' },
    },
    {
      id: 'challenge-ladder',
      title: 'Challenge ladder',
      description: 'Challenge someone near your position',
      icon: 'challenge',
      image:
        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1100&q=80',
      to: { name: 'CreateChallenge' },
    },
    {
      id: 'enter-tournament',
      title: 'Enter tournament',
      description: 'Find an event and enter',
      icon: 'tournament',
      image:
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1100&q=80',
      to: { name: 'Tournaments' },
    },
  ],
  attentionItems: [
    {
      id: 'review-result',
      icon: 'review',
      title: 'Review your match result',
      description: "You vs Sam · Men's Singles",
      actionLabel: 'Review',
      to: { name: 'Challenges' },
    },
    {
      id: 'membership-fee',
      icon: 'calendar',
      title: 'Your membership fee is due in 4 days',
      description: 'Due on May 28, 2025',
      actionLabel: 'Pay now',
      unavailableMessage: 'Membership payments are not connected yet.',
    },
  ],
  upcomingItems: [
    {
      id: 'court-one-live',
      month: 'May',
      day: '26',
      weekday: 'Tue',
      title: 'Live now on Court 1',
      description: 'Amina Esin vs Priya Nair',
    },
    {
      id: 'club-social',
      month: 'May',
      day: '30',
      weekday: 'Sat',
      title: 'Club social night',
      description: 'This Friday at 7:00 PM',
    },
  ],
  clubSummary: {
    members: 128,
    newMembersLabel: '6 new members this month',
    liveMatches: 6,
    liveMatchesLabel: 'Across 3 courts',
    activeLadders: 8,
    activeLaddersLabel: '3 updated today',
  },
})
