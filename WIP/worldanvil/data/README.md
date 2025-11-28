# World Anvil Data Cache

This directory contains cached data fetched from the World Anvil API.

## Structure

```
data/
├── rpg-systems.json           # All RPG systems (D&D 5e, Cypher, etc.)
├── worlds/                    # World-specific data
│   ├── {world-slug}/
│   │   ├── articles/
│   │   ├── characters/
│   │   ├── stat-blocks/
│   │   └── maps/
└── schemas/                   # World Anvil API response schemas
```

## Usage

### Fetch RPG Systems

```bash
# From project root
npx tsx src/packages/worldanvil/cli/fetch-rpg-systems.ts

# Output: src/packages/worldanvil/data/rpg-systems.json
```

### Use Cached Data

```bash
# Skip API call, use cached file
npx tsx src/packages/worldanvil/cli/fetch-rpg-systems.ts --cache
```

---

## Data Files

### rpg-systems.json

Contains all RPG systems available in World Anvil.

**Format**:
```json
{
  "metadata": {
    "fetched_at": "2024-12-01T12:00:00.000Z",
    "source": "World Anvil Boromir API",
    "api_version": "2.0",
    "total_systems": 50
  },
  "systems": [
    {
      "id": 1,
      "name": "D&D 5e",
      "slug": "5e",
      "description": "...",
      "publisher": "Wizards of the Coast",
      "official": true,
      "community_created": false,
      "icon_url": "...",
      "image_url": "..."
    }
  ]
}
```

---

## Cache Management

Files in this directory are:
- ✅ **Cached locally** - Speeds up development
- ✅ **Versioned** - Committed to git for reference
- ✅ **Refreshable** - Use CLI tools to update

**TTL Recommendations**:
- RPG Systems: Update monthly (rarely changes)
- World Data: Update weekly (more frequent changes)
- Articles/Characters: Update on-demand

---

## .gitignore

Large data files (>10MB) should be added to `.gitignore`:

```gitignore
# Large world data
src/packages/worldanvil/data/worlds/*/articles/*.json
src/packages/worldanvil/data/worlds/*/characters/*.json
```

Small reference files (rpg-systems.json, schemas) should be committed.

---

## Notes

- Data here is complementary to PostgreSQL cache
- PostgreSQL cache is for production (real-time)
- File cache is for development and reference
