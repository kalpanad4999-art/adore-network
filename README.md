# TRINETRA YOGA

Yoga studio management application: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Lovable Cloud authentication, PostgreSQL, private storage, realtime and backend functions.

## Development
Use Bun and a current Node.js LTS. Obtain an approved checkout and environment configuration from the maintainer; never commit private credentials.

```sh
bun install
bun run dev
bun run test
bun run lint
```

The managed preview already runs its server and automatic builds; do not start another server or manually run builds there. A standalone checkout can use `bun run build`.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Feature development](docs/DEVELOPMENT.md)
- [Backend contracts](docs/BACKEND-CONTRACTS.md)
- [Phase 1 report](docs/PHASE-1-REPORT.md)
- `AGENTS.md` contains architecture rules; `roadmap.md` tracks remaining work.

Members is the first feature separated into services, hooks, rules and types. Other modules retain their existing structure. No Python backend, UI redesign, data migration, framework upgrades or additional dependencies were introduced.

Never manually edit generated integrations/types, preview auth storage, managed config or environment files. Keep private keys and database credentials out of React. Preserve existing public OAuth callbacks and Vercel rewrites. Before release, test login and direct-link refresh on the intended hosting origin.
