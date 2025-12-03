const testMessages = [
  'what does Fireball do?',
  'tell me about fireball',
  'fireball spell',
  'check my access',
  'look up the fireball spell',
  'what is a goblin',
];

const dndTerms = ['spell', 'monster', 'creature', 'item', 'weapon', 'armor', 'feat', 'class', 'race', 'subclass', 'background', 'condition'];

function detectRuleLookup(content: string): { isLookup: boolean; category: string; query: string } {
  const contentLower = content.toLowerCase();

  const lookupPatterns = [
    /what (?:is|are|does) (?:a |an |the )?(.+?)(?:\?|$)/i,
    /tell me about (?:the |a |an )?(.+?)(?:\?|$)/i,
    /how does (?:the |a |an )?(.+?) work(?:\?|$)/i,
    /look up (?:the |a |an )?(.+?)(?:\?|$)/i,
    /search (?:for )?(?:the |a |an )?(.+?)(?:\?|$)/i,
    /find (?:the |a |an )?(.+?)(?:\?|$)/i,
  ];

  let isLookup = false;
  let query = content;

  for (const pattern of lookupPatterns) {
    const match = content.match(pattern);
    if (match) {
      isLookup = true;
      query = match[1].trim();
      break;
    }
  }

  if (!isLookup && dndTerms.some(term => contentLower.includes(term))) {
    isLookup = true;
  }

  let category = 'spells';
  if (contentLower.includes('monster') || contentLower.includes('creature') || contentLower.includes('bestiary')) {
    category = 'bestiary';
  } else if (contentLower.includes('spell') || contentLower.includes('cast')) {
    category = 'spells';
  }

  query = query.replace(/\?/g, '').trim();
  if (!query) query = content;

  return { isLookup, category, query };
}

for (const msg of testMessages) {
  const result = detectRuleLookup(msg);
  console.log(`"${msg}" -> lookup=${result.isLookup}, cat=${result.category}, query="${result.query}"`);
}
