export const RSP_CATEGORY_TEMPLATE_ID = 'rsp-masters-default'

export const RSP_CATEGORY_TEMPLATE = {
  id: RSP_CATEGORY_TEMPLATE_ID,
  name: 'RSP Masters Default',
  description: 'The usual RSP categories are ready. Turn off any category you do not need.',
  categories: [
    {
      id: 'premier',
      name: 'Premier',
      description: 'Strongest ladder players',
      assignmentMode: 'ladder-range',
      ladderStart: 1,
      ladderEnd: 12,
      targetPlayers: 12,
      minPlayers: 8,
      maxPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: false,
      allowSpecialOverlap: false,
      eligibility: {
        gender: 'any',
        veteranOnly: false,
      },
    },
    {
      id: 'category-a',
      name: 'Category A',
      description: 'Strong and intermediate ladder players',
      assignmentMode: 'ladder-range',
      ladderStart: 13,
      ladderEnd: 24,
      targetPlayers: 12,
      minPlayers: 8,
      maxPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      allowSpecialOverlap: false,
      eligibility: {
        gender: 'any',
        veteranOnly: false,
      },
    },
    {
      id: 'category-b',
      name: 'Category B',
      description: 'Developing ladder players',
      assignmentMode: 'ladder-range',
      ladderStart: 25,
      ladderEnd: 36,
      targetPlayers: 12,
      minPlayers: 8,
      maxPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      allowSpecialOverlap: false,
      eligibility: {
        gender: 'any',
        veteranOnly: false,
      },
    },
    {
      id: 'ladies',
      name: 'Ladies',
      description: 'Female member category',
      assignmentMode: 'eligibility',
      targetPlayers: 12,
      minPlayers: 4,
      maxPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      allowSpecialOverlap: true,
      eligibility: {
        gender: 'female',
        veteranOnly: false,
      },
    },
    {
      id: 'veterans',
      name: 'Veterans',
      description: 'Age-eligible experienced players',
      assignmentMode: 'eligibility',
      targetPlayers: 12,
      minPlayers: 4,
      maxPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      allowSpecialOverlap: true,
      eligibility: {
        gender: 'any',
        veteranOnly: true,
      },
    },
  ],
}

export const CATEGORY_NAME_BY_ID = RSP_CATEGORY_TEMPLATE.categories.reduce(
  (lookup, category) => ({
    ...lookup,
    [category.id]: category.name,
  }),
  {},
)

export function getCategoryTemplate(categoryId) {
  return RSP_CATEGORY_TEMPLATE.categories.find((category) => category.id === categoryId) || null
}

export function getEnabledCategoryTemplates(enabledCategoryIds = []) {
  const enabled = new Set(enabledCategoryIds)
  return RSP_CATEGORY_TEMPLATE.categories.filter((category) => enabled.has(category.id))
}
