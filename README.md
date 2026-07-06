# KL-CODE

A terminal-based AI coding assistant — an interactive TUI application that lets you chat with AI language models (via OpenRouter, OpenAI, or local Ollama) to help with software development tasks.

Built with **Bun** as the runtime, using a monorepo structure with npm workspaces.

This is not a perfect terminal coding cli because of the system prompt and the model i have used is weak and models were hardcoded.

Most of the work or similar hono based is taken up from youtube 



## Architecture

```
User (Terminal)
    |
    | (React TUI via @opentui/react)
    v
  @KL-CODE/cli ..........  Terminal UI client
    |
    | (HTTP / SSE streaming)
    v
  @KL-CODE/server .......  Hono API server (port 3000)
    |
    |--- @KL-CODE/database  (Prisma + PostgreSQL via Neon)
    |--- @KL-CODE/shared    (types, schemas, config)
    |--- AI SDK (Vercel AI SDK + OpenRouter)
    |
    |--- Tools: readFile, writeFile, bash, grep, glob, webfetch, etc.
    |--- Agents: plan, build, debug, review modes
```

## Packages

| Package | Description |
|---|---|
| `packages/cli` | React-based terminal UI client (via `@opentui/react`) |
| `packages/server` | Hono HTTP API server — AI agent backend with tool execution |
| `packages/database` | Prisma + PostgreSQL (Neon) — session and message storage |
| `packages/shared` | Shared types, Zod schemas, and configuration logic |

## Getting Started

1. Install dependencies:
   ```
   bun install
   ```

2. Configure environment variables (see `.env.example`):
   - `API_URL` — Server URL
   - `DATABASE_URL` — PostgreSQL connection string
   - `OPENROUTER_API_KEY` — Your OpenRouter API key

3. Start the server:
   ```
   bun run dev:server
   ```

4. In a separate terminal, start the CLI:
   ```
   bun run dev:cli
   ```

## Configuration

Project-level configuration is stored in `.klcoderc`, supporting:
- Permission levels for tools (`allow`, `deny`, `ask`)
- Custom agent definitions
- MCP server configurations
- Model settings

## License

MIT

## Clip



https://github.com/user-attachments/assets/16d9325d-3849-4dfb-812a-d15e29e26500

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | [Bun](https://bun.sh) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **HTTP Framework** | [Hono](https://hono.dev) |
| **Terminal UI** | [React](https://react.dev) + [@opentui/react](https://github.com/opentui/opentui) |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai/docs) (`ai`) |
| **LLM Providers** | OpenRouter (`@openrouter/ai-sdk-provider`) |
| **Database ORM** | [Prisma](https://www.prisma.io/) 7 + PostgreSQL |
| **Validation** | [Zod](https://zod.dev) |
| **Error Tracking** | [Sentry](https://sentry.io) (`@sentry/bun`) |
| **Stream Parsing** | `eventsource-parser` |
| **Routing (CLI)** | `react-router` (memory router) |
| **Monorepo** | Bun workspaces (`packages/*`) |
