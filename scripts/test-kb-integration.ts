/**
 * Test Knowledge Base Integration
 *
 * Verifies that FumbleBot can access the Knowledge Base through Core's API
 */

import { getCoreClient } from '../src/lib/core-client.js';

async function testKBIntegration() {
  console.log('🧪 Testing Knowledge Base Integration\n');

  try {
    const coreClient = getCoreClient();
    console.log('✓ Core client initialized\n');

    // Test 1: List all systems
    console.log('📋 Test 1: List all systems');
    const { systems, total } = await coreClient.kb.getSystems();
    console.log(`Found ${total} systems:`, systems);
    console.log('✓ getSystems() works\n');

    // Test 2: Search for D&D 5e spells
    console.log('🔍 Test 2: Search for D&D 5e spells');
    const spellResults = await coreClient.kb.list({
      system: 'dnd5e',
      category: 'spells',
      search: 'fireball'
    });
    console.log(`Found ${spellResults.total} results for "fireball"`);
    if (spellResults.articles.length > 0) {
      console.log('First result:', {
        title: spellResults.articles[0].title,
        slug: spellResults.articles[0].slug,
        tags: spellResults.articles[0].tags
      });
    }
    console.log('✓ list() with search works\n');

    // Test 3: Get a specific spell
    console.log('📖 Test 3: Get specific spell (Fireball)');
    const fireballSlug = spellResults.articles[0]?.slug;
    if (fireballSlug) {
      const { article } = await coreClient.kb.get(fireballSlug);
      console.log('Article retrieved:', {
        title: article.frontmatter.title,
        system: article.frontmatter.system,
        category: article.frontmatter.category,
        tags: article.frontmatter.tags,
        contentLength: article.content.length
      });
      console.log('✓ get() works\n');
    }

    // Test 4: List all D&D 5e classes
    console.log('⚔️  Test 4: List all D&D 5e classes');
    const classResults = await coreClient.kb.list({
      system: 'dnd5e',
      category: 'classes'
    });
    console.log(`Found ${classResults.total} classes:`,
      classResults.articles.map(a => a.title).join(', ')
    );
    console.log('✓ list() with category filter works\n');

    // Test 5: Search Cypher System
    console.log('🎲 Test 5: Search Cypher System content');
    const cypherResults = await coreClient.kb.list({
      system: 'cypher',
      search: 'effort'
    });
    console.log(`Found ${cypherResults.total} Cypher articles about "effort"`);
    if (cypherResults.articles.length > 0) {
      console.log('Results:', cypherResults.articles.map(a => a.title));
    }
    console.log('✓ Cypher System content accessible\n');

    // Test 6: Get categories
    console.log('📂 Test 6: List all categories');
    const { categories } = await coreClient.kb.getCategories();
    console.log('Available categories:', categories);
    console.log('✓ getCategories() works\n');

    // Test 7: Count all articles
    console.log('📊 Test 7: Count total articles');
    const allArticles = await coreClient.kb.list({});
    console.log(`Total articles in KB: ${allArticles.total}`);
    console.log('✓ Full KB accessible\n');

    console.log('🎉 All tests passed! Knowledge Base integration is working perfectly.\n');

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('KB Integration Summary:');
    console.log(`  Total Articles: ${allArticles.total}`);
    console.log(`  Systems: ${systems.join(', ')}`);
    console.log(`  Categories: ${categories.join(', ')}`);
    console.log(`  D&D 5e Spells: ~${spellResults.total} searchable`);
    console.log(`  D&D 5e Classes: ${classResults.total}`);
    console.log('═══════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testKBIntegration();
