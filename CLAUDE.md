# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm start         # Run in production (node index.js)
npm run dev       # Run with auto-reload (nodemon)
npm test          # Run all Jest tests
npx jest <file>   # Run a single test file, e.g. npx jest __tests__/apis/redis/redisCache.test.js
npx eslint .      # Lint the codebase
```

## Architecture Overview

**Griefhem** is a text-based Discord social deduction game with a 13-tier role hierarchy (Poop → Emperor). The system runs **14 separate Discord bot accounts** simultaneously — one per role plus one admin/console bot — each posting a single interactive UI message (buttons + select menus) to its dedicated channel.

### Startup Flow

`index.js` → `initializeRedis()` → `CacheDataFromDB()` (sync Firebase → Redis) → `initializeBots()` (launch all 14 bots) → `scheduledXpBoost()` (60s interval loop)

Each bot in `botSetup.js`:
1. Deletes its previous messages from the channel
2. Posts a new interactive ActionRow message
3. Registers `interactionCreate` and `guildMemberUpdate` event handlers

### Key Files

| File | Purpose |
|------|---------|
| `index.js` | Entry point, startup orchestration, graceful shutdown |
| `botSetup.js` | Creates all Discord.js Client instances, `initializeBots()` |
| `game_state.js` | ~45 getters/setters for shared mutable state (Revolution, Siege, Elections, role counts) |
| `game_config.json` | Single source of truth for all game balance: XP costs, cooldowns, thresholds, timers |
| `apis/firebase/querys.js` | All Firebase CRUD — XP updates, role changes, writs, festering |
| `apis/redis/redisCache.js` | Ephemeral cache — cooldowns, active swarms, endow links (flushed on startup) |
| `functions/botActions.js` | Shared utilities: XP boost scheduler, select menu builder, channel messaging |
| `functions/eventEmitter.js` | Node.js EventEmitter bus for cross-bot communication (e.g. Revolution progress → all bots update UI) |

### Role Commands Pattern

Every `role_commands/*_commands.js` exports two functions:
- `messageRoleCommands(client)` — Sends the single interactive message for that role's channel
- `setupRoleEvents(client, messageId)` — Registers interaction/member-update handlers

`console_commands.js` is the admin bot: handles the XP boost loop, server status, and global system logic.

### Data Layer

**Firebase** (persistent): user XP, roles, writs, buffs/debuffs
**Redis** (ephemeral, flushed on restart): ability cooldowns, active festering links, endow relationships, writ cache

Every Firebase write should be mirrored to Redis. The two layers are kept in sync manually — there is no automatic sync after startup.

### Game State

`game_state.js` is the centralized store for multi-player coordinated mechanics:
- **Revolution** — Peasants/Scholars/Merchants group uprising
- **Siege** — King vs King military engagement with Knight participation
- **Election** — Lords promote Nobles/Lords
- **Role size counters** — Used to enable/disable abilities based on minimum participant thresholds

When adding new coordinated ability logic, add state to `game_state.js` rather than local module variables.

### Cross-Bot Communication

Bots do **not** communicate directly. They use `functions/eventEmitter.js` (shared in-process EventEmitter). When one bot triggers an event (e.g. a Revolution starting), it emits an event that all other bots listen to for updating their UIs.

### Environment Variables

Required in `.env`: one `TOKEN_*` and `CLIENTID_*` per bot (14 bots), one `CHANNELIDX` per role channel, one `ROLEID_*` per Discord role, `GUILDID`, `FIREBASE_DATABASEURL`, `FIREBASE_SERVICE_ACCOUNT` (stringified JSON), and optionally `REDIS_URL` (defaults to `redis://localhost:6379`).

### Testing

Tests use Jest with full mocks for Firebase and Redis — no real connections needed. `game_config.json` is also mocked in tests. Test files live in `__tests__/` mirroring the source structure.
