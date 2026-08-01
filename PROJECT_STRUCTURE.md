# Ultra-Low Resource LLM Context Compression Engine
## Complete Project Structure

---

## Root
```
llm-context-compressor/
├── README.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-staging.yml
│       └── cd-production.yml
└── docs/
    ├── architecture.md
    ├── api-reference.md
    ├── compression-algorithms.md
    └── deployment.md
```

---

## Frontend — React + TypeScript + Vite + Tailwind + shadcn/ui
```
frontend/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json               # shadcn/ui config
├── .env
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── index.html
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── fonts/
│       └── inter-variable.woff2
│
└── src/
    ├── main.tsx                  # App entry point
    ├── App.tsx                   # Root component + router setup
    ├── vite-env.d.ts
    │
    ├── assets/
    │   ├── logo.svg
    │   └── illustrations/
    │       ├── empty-state.svg
    │       └── onboarding.svg
    │
    ├── components/
    │   │
    │   ├── ui/                   # shadcn/ui primitive components
    │   │   ├── accordion.tsx
    │   │   ├── alert.tsx
    │   │   ├── alert-dialog.tsx
    │   │   ├── avatar.tsx
    │   │   ├── badge.tsx
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── collapsible.tsx
    │   │   ├── command.tsx
    │   │   ├── context-menu.tsx
    │   │   ├── dialog.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── form.tsx
    │   │   ├── hover-card.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── menubar.tsx
    │   │   ├── navigation-menu.tsx
    │   │   ├── popover.tsx
    │   │   ├── progress.tsx
    │   │   ├── radio-group.tsx
    │   │   ├── scroll-area.tsx
    │   │   ├── select.tsx
    │   │   ├── separator.tsx
    │   │   ├── sheet.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── slider.tsx
    │   │   ├── switch.tsx
    │   │   ├── table.tsx
    │   │   ├── tabs.tsx
    │   │   ├── textarea.tsx
    │   │   ├── toast.tsx
    │   │   ├── toaster.tsx
    │   │   ├── toggle.tsx
    │   │   ├── tooltip.tsx
    │   │   └── use-toast.ts
    │   │
    │   ├── layout/
    │   │   ├── AppShell.tsx           # Main authenticated layout wrapper
    │   │   ├── Sidebar.tsx            # Left navigation sidebar
    │   │   ├── SidebarItem.tsx        # Individual nav item with tooltip
    │   │   ├── SidebarSection.tsx     # Grouped nav section
    │   │   ├── TopBar.tsx             # Top header bar
    │   │   ├── UserMenu.tsx           # Avatar + dropdown menu
    │   │   ├── ThemeToggle.tsx        # Dark / light mode toggle
    │   │   ├── NotificationBell.tsx   # In-app notifications
    │   │   ├── CommandPalette.tsx     # Cmd+K global search
    │   │   └── Footer.tsx
    │   │
    │   ├── auth/
    │   │   ├── LoginForm.tsx
    │   │   ├── RegisterForm.tsx
    │   │   ├── ForgotPasswordForm.tsx
    │   │   ├── ResetPasswordForm.tsx
    │   │   ├── OAuthButtons.tsx       # Google / GitHub SSO
    │   │   └── AuthGuard.tsx          # Route protection HOC
    │   │
    │   ├── dashboard/
    │   │   ├── StatsCards.tsx         # KPI summary row
    │   │   ├── CompressionChart.tsx   # Token usage area chart
    │   │   ├── ModelUsageChart.tsx    # Provider breakdown donut
    │   │   ├── RecentSessionsTable.tsx
    │   │   ├── SavingsWidget.tsx      # Cumulative cost savings
    │   │   └── QuickCompressWidget.tsx
    │   │
    │   ├── compression/
    │   │   ├── CompressionWorkspace.tsx   # Split-pane main UI
    │   │   ├── InputPanel.tsx             # Text + file input area
    │   │   ├── OutputPanel.tsx            # Compressed result display
    │   │   ├── CompressionSettings.tsx    # Algorithm + ratio config sidebar
    │   │   ├── ModelSelector.tsx          # Provider + model dropdown
    │   │   ├── TokenCounter.tsx           # Real-time token count display
    │   │   ├── DiffViewer.tsx             # Inline before/after diff
    │   │   ├── CompressionPipeline.tsx    # Visual step-by-step pipeline
    │   │   ├── AgentStatusPanel.tsx       # Multi-agent live progress
    │   │   ├── FileUploadZone.tsx         # Drag-and-drop upload
    │   │   ├── FormatSelector.tsx         # Input format picker
    │   │   ├── CompressionRatioSlider.tsx
    │   │   ├── SemanticPreservationToggle.tsx
    │   │   └── ExportOptions.tsx          # Download / copy result
    │   │
    │   ├── sessions/
    │   │   ├── SessionList.tsx
    │   │   ├── SessionCard.tsx
    │   │   ├── SessionDetail.tsx
    │   │   ├── SessionFilters.tsx
    │   │   └── SessionSearch.tsx
    │   │
    │   ├── analytics/
    │   │   ├── AnalyticsDashboard.tsx
    │   │   ├── TokenSavingsChart.tsx      # Recharts area chart
    │   │   ├── CompressionRatioChart.tsx  # Recharts bar chart
    │   │   ├── ModelComparisonChart.tsx   # Recharts grouped bars
    │   │   ├── CostSavingsChart.tsx       # Recharts line chart
    │   │   ├── UsageHeatmap.tsx           # Calendar-style heatmap
    │   │   ├── TopContextsTable.tsx
    │   │   └── ExportReportButton.tsx
    │   │
    │   ├── api-keys/
    │   │   ├── ApiKeyManager.tsx
    │   │   ├── ApiKeyCard.tsx
    │   │   ├── CreateApiKeyDialog.tsx
    │   │   └── ApiKeyUsageChart.tsx
    │   │
    │   ├── settings/
    │   │   ├── SettingsTabs.tsx
    │   │   ├── ProfileSettings.tsx
    │   │   ├── SecuritySettings.tsx       # Password, 2FA
    │   │   ├── NotificationSettings.tsx
    │   │   ├── BillingSettings.tsx
    │   │   ├── LLMProviderSettings.tsx    # Per-provider API keys
    │   │   └── TeamSettings.tsx
    │   │
    │   ├── billing/
    │   │   ├── PricingCards.tsx
    │   │   ├── UsageMeter.tsx
    │   │   ├── InvoiceTable.tsx
    │   │   └── UpgradeModal.tsx
    │   │
    │   └── shared/
    │       ├── LoadingSpinner.tsx
    │       ├── LoadingOverlay.tsx
    │       ├── ErrorBoundary.tsx
    │       ├── EmptyState.tsx
    │       ├── ConfirmDialog.tsx
    │       ├── CopyButton.tsx
    │       ├── CodeBlock.tsx
    │       ├── Pagination.tsx
    │       ├── DataTable.tsx             # Generic sortable/filterable table
    │       ├── SearchInput.tsx
    │       ├── TagInput.tsx
    │       └── StatusBadge.tsx
    │
    ├── pages/
    │   ├── auth/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── ForgotPasswordPage.tsx
    │   │   └── ResetPasswordPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── CompressionPage.tsx          # Primary compression tool page
    │   ├── SessionsPage.tsx             # Session history list
    │   ├── SessionDetailPage.tsx
    │   ├── AnalyticsPage.tsx
    │   ├── ApiKeysPage.tsx
    │   ├── SettingsPage.tsx
    │   ├── BillingPage.tsx
    │   ├── OnboardingPage.tsx
    │   └── NotFoundPage.tsx
    │
    ├── hooks/
    │   ├── useAuth.ts                   # Auth state + actions
    │   ├── useCompression.ts            # Compression job state machine
    │   ├── useWebSocket.ts              # Socket.io live updates
    │   ├── useTokenCounter.ts           # Debounced client-side estimation
    │   ├── useFileUpload.ts             # Upload progress + validation
    │   ├── useSessions.ts               # Session CRUD + pagination
    │   ├── useAnalytics.ts              # Analytics data fetching
    │   ├── useApiKeys.ts
    │   ├── useSettings.ts
    │   ├── useBilling.ts
    │   ├── useTheme.ts
    │   ├── useDebounce.ts
    │   ├── useLocalStorage.ts
    │   ├── useClipboard.ts
    │   └── useMediaQuery.ts
    │
    ├── store/                           # Zustand global stores
    │   ├── authStore.ts
    │   ├── compressionStore.ts
    │   ├── sessionStore.ts
    │   ├── settingsStore.ts
    │   ├── uiStore.ts                   # Sidebar collapsed, modals, theme
    │   └── notificationStore.ts
    │
    ├── services/                        # Axios API client layer
    │   ├── api.ts                       # Axios instance + interceptors + refresh
    │   ├── authService.ts
    │   ├── compressionService.ts
    │   ├── sessionService.ts
    │   ├── analyticsService.ts
    │   ├── apiKeyService.ts
    │   ├── settingsService.ts
    │   ├── billingService.ts
    │   └── uploadService.ts
    │
    ├── lib/
    │   ├── utils.ts                     # cn(), clsx, tailwind-merge helpers
    │   ├── constants.ts                 # App-wide constants
    │   ├── validators.ts                # Zod schemas for all forms
    │   ├── formatters.ts                # Token counts, file sizes, dates
    │   ├── tokenizers.ts                # Client-side token estimation
    │   └── errors.ts                    # Typed API error classes
    │
    ├── types/
    │   ├── auth.ts
    │   ├── compression.ts
    │   ├── session.ts
    │   ├── analytics.ts
    │   ├── llm.ts                       # Provider + model union types
    │   ├── billing.ts
    │   └── api.ts                       # Generic ApiResponse<T> types
    │
    ├── router/
    │   ├── index.tsx                    # TanStack Router root
    │   └── routes.ts                    # Route definitions + auth guards
    │
    └── styles/
        ├── globals.css                  # Tailwind directives + CSS custom properties
        └── animations.css               # Keyframe animations
```

---

## Backend — Node.js + Express + TypeScript
```
backend/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .env
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── nodemon.json
│
├── prisma/
│   ├── schema.prisma               # Full DB schema (see table list below)
│   ├── seed.ts                     # Dev seed script
│   └── migrations/
│       └── .gitkeep
│
└── src/
    ├── server.ts                   # HTTP + WebSocket server bootstrap
    ├── app.ts                      # Express app config + global middleware
    │
    ├── config/
    │   ├── index.ts                # Config aggregator + env validation
    │   ├── database.ts             # Prisma client singleton
    │   ├── redis.ts                # ioredis client singleton
    │   ├── logger.ts               # Winston structured logger
    │   ├── cors.ts                 # CORS options
    │   └── swagger.ts              # OpenAPI / Swagger UI setup
    │
    ├── routes/
    │   ├── index.ts                # Route registry
    │   ├── auth.routes.ts
    │   ├── compression.routes.ts
    │   ├── session.routes.ts
    │   ├── analytics.routes.ts
    │   ├── apikey.routes.ts
    │   ├── user.routes.ts
    │   ├── billing.routes.ts
    │   ├── upload.routes.ts
    │   ├── webhook.routes.ts
    │   └── health.routes.ts
    │
    ├── controllers/
    │   ├── auth.controller.ts
    │   ├── compression.controller.ts
    │   ├── session.controller.ts
    │   ├── analytics.controller.ts
    │   ├── apikey.controller.ts
    │   ├── user.controller.ts
    │   ├── billing.controller.ts
    │   ├── upload.controller.ts
    │   └── webhook.controller.ts
    │
    ├── services/
    │   ├── auth.service.ts         # JWT issue/verify, refresh token rotation
    │   ├── compression.service.ts  # HTTP client to Python AI microservice
    │   ├── session.service.ts
    │   ├── analytics.service.ts
    │   ├── apikey.service.ts
    │   ├── user.service.ts
    │   ├── billing.service.ts
    │   ├── email.service.ts        # Nodemailer / SendGrid transactional email
    │   ├── upload.service.ts       # Multipart parsing + S3/local storage
    │   ├── cache.service.ts        # Redis cache abstraction layer
    │   ├── queue.service.ts        # BullMQ queue setup
    │   └── webhook.service.ts
    │
    ├── middleware/
    │   ├── auth.middleware.ts           # JWT Bearer verification
    │   ├── rateLimiter.middleware.ts    # express-rate-limit
    │   ├── validate.middleware.ts       # Zod request schema validation
    │   ├── upload.middleware.ts         # Multer config + file type filter
    │   ├── errorHandler.middleware.ts   # Global error handler
    │   ├── requestLogger.middleware.ts  # Per-request structured logging
    │   └── apiKey.middleware.ts         # API key auth for external callers
    │
    ├── validators/
    │   ├── auth.validator.ts
    │   ├── compression.validator.ts
    │   ├── session.validator.ts
    │   ├── user.validator.ts
    │   └── billing.validator.ts
    │
    ├── jobs/                       # BullMQ job processors
    │   ├── compression.job.ts      # Async heavy compression jobs
    │   ├── analytics.job.ts        # Scheduled aggregation cron
    │   ├── cleanup.job.ts          # Expire old sessions + temp files
    │   └── email.job.ts            # Email send queue processor
    │
    ├── websockets/
    │   ├── index.ts                # Socket.io server setup
    │   ├── compression.ws.ts       # Live compression progress events
    │   └── notification.ws.ts      # User notification push
    │
    ├── types/
    │   ├── express.d.ts            # Augment Express.Request (user, apiKey)
    │   ├── auth.ts
    │   ├── compression.ts
    │   ├── session.ts
    │   └── analytics.ts
    │
    └── utils/
        ├── jwt.ts                  # signToken, verifyToken, refreshToken
        ├── hash.ts                 # bcrypt hash + compare
        ├── paginate.ts             # Cursor + offset pagination helpers
        ├── slugify.ts
        └── retry.ts               # Exponential backoff for external calls
```

### Database Tables (Prisma schema)
| Table | Purpose |
|---|---|
| `User` | Accounts, OAuth links, plan tier, quota |
| `Session` | Compression job runs (metadata + status) |
| `CompressionResult` | Input/output text + token metrics per run |
| `ApiKey` | User-issued API keys (hashed secret) |
| `LLMProviderConfig` | Per-user provider API keys (AES-256 encrypted) |
| `UsageRecord` | Token usage per session for metering |
| `Invoice` | Billing invoices + Stripe IDs |
| `Notification` | In-app notifications |
| `AuditLog` | Security audit trail (auth events, key usage) |

---

## AI Microservice — Python + FastAPI
```
ai-service/
├── requirements.txt              # Production dependencies
├── requirements-dev.txt          # Dev + test dependencies
├── pyproject.toml                # Ruff, mypy, pytest config
├── Dockerfile
├── .env
├── .env.example
│
└── app/
    ├── main.py                   # FastAPI app + lifespan events
    ├── config.py                 # Pydantic BaseSettings
    │
    ├── api/
    │   ├── __init__.py
    │   ├── router.py             # API router aggregator
    │   └── v1/
    │       ├── __init__.py
    │       ├── compression.py    # POST /compress, GET /status/{job_id}
    │       ├── tokens.py         # POST /count-tokens
    │       ├── models.py         # GET /models (provider capabilities)
    │       └── health.py         # GET /health, GET /ready
    │
    ├── core/
    │   ├── __init__.py
    │   ├── security.py           # Internal service-to-service auth
    │   ├── logging.py            # Structured JSON logging
    │   └── exceptions.py        # Custom HTTP exception classes
    │
    ├── agents/                   # Multi-agent compression pipeline
    │   ├── __init__.py
    │   ├── pipeline.py           # Pipeline orchestrator (serial + parallel)
    │   ├── base_agent.py         # Abstract BaseAgent interface
    │   ├── chunker_agent.py      # Splits context into semantic chunks
    │   ├── summarizer_agent.py   # LLM-based chunk summarization
    │   ├── semantic_agent.py     # Semantic similarity / dedup filter
    │   ├── deduplication_agent.py# Remove near-duplicate sentences
    │   ├── priority_agent.py     # Score + rank chunks by relevance
    │   ├── merger_agent.py       # Recombine compressed output
    │   └── validator_agent.py    # Quality gate (ROUGE, length check)
    │
    ├── compression/
    │   ├── __init__.py
    │   ├── engine.py             # Main CompressionEngine entry point
    │   ├── algorithms/
    │   │   ├── __init__.py
    │   │   ├── extractive.py     # Sentence scoring + extraction (TextRank)
    │   │   ├── abstractive.py    # LLM rewrite-based compression
    │   │   ├── hybrid.py         # Extractive → abstractive pipeline
    │   │   ├── selective.py      # Importance-score-based selective drop
    │   │   └── structural.py     # Structure-preserving compress (code/JSON)
    │   └── metrics.py            # ROUGE-L, compression ratio, token delta
    │
    ├── providers/                # LLM provider adapters
    │   ├── __init__.py
    │   ├── base_provider.py      # Abstract LLMProvider interface
    │   ├── openai_provider.py    # GPT-4o, GPT-4, GPT-3.5-turbo
    │   ├── gemini_provider.py    # Gemini 1.5 Pro / Flash
    │   ├── claude_provider.py    # Claude 3.5 Sonnet / Haiku
    │   ├── llama_provider.py     # Llama 3.x via Groq / Together AI
    │   ├── deepseek_provider.py  # DeepSeek-V2, DeepSeek-Coder
    │   ├── mistral_provider.py   # Mistral Large, Nemo, 7B
    │   ├── ollama_provider.py    # Local Ollama REST API
    │   └── registry.py           # ProviderRegistry factory
    │
    ├── tokenizers/
    │   ├── __init__.py
    │   ├── base_tokenizer.py
    │   ├── tiktoken_tokenizer.py  # OpenAI cl100k_base / o200k_base
    │   ├── huggingface_tokenizer.py # HF AutoTokenizer
    │   └── estimator.py           # Fast GPT-4-approximate word estimator
    │
    ├── parsers/                   # Multi-format file parsers
    │   ├── __init__.py
    │   ├── base_parser.py
    │   ├── pdf_parser.py          # PyMuPDF (fitz)
    │   ├── docx_parser.py         # python-docx
    │   ├── markdown_parser.py     # mistune / commonmark
    │   ├── html_parser.py         # BeautifulSoup4
    │   ├── code_parser.py         # tree-sitter AST-aware parsing
    │   ├── json_parser.py
    │   ├── csv_parser.py
    │   └── txt_parser.py
    │
    ├── cache/
    │   ├── __init__.py
    │   └── redis_cache.py         # Semantic result cache (embedding hash)
    │
    ├── schemas/                   # Pydantic request/response models
    │   ├── __init__.py
    │   ├── compression.py         # CompressionRequest, CompressionResponse
    │   ├── tokens.py              # TokenCountRequest, TokenCountResponse
    │   └── providers.py           # ProviderInfo, ModelInfo
    │
    └── utils/
        ├── __init__.py
        ├── text_utils.py          # Sentence splitting, cleaning
        ├── chunk_utils.py         # Chunk size computation, overlap
        └── metrics_utils.py       # Ratio calculations, cost estimates
```

---

## Infrastructure
```
infrastructure/
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── frontend.conf
│       ├── backend.conf
│       └── ai-service.conf
│
├── docker/
│   ├── frontend.Dockerfile
│   ├── backend.Dockerfile
│   └── ai-service.Dockerfile
│
└── scripts/
    ├── setup-dev.sh               # One-shot dev environment bootstrap
    ├── db-migrate.sh              # Run Prisma migrations
    ├── db-seed.sh                 # Seed development data
    └── health-check.sh            # Verify all services are alive
```

---

## Key Technology Decisions

| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Type safety, ecosystem |
| Build tool | Vite 5 | Fast HMR, ESM-native |
| Styling | Tailwind CSS v3 + shadcn/ui | Utility-first, dark mode out of box |
| Charts | Recharts | Composable, React-native |
| State management | Zustand | Lightweight, minimal boilerplate |
| Data fetching | TanStack Query v5 | Server-state, caching, stale-while-revalidate |
| Forms | React Hook Form + Zod | Performance + type-safe validation |
| Router | TanStack Router | Type-safe routes |
| API client | Axios | Interceptors for JWT refresh |
| Backend runtime | Node.js 20 LTS + Express | Familiar, fast, large ecosystem |
| ORM | Prisma | Type-safe queries, migration-first |
| Job queue | BullMQ + Redis | Reliable async jobs |
| Real-time | Socket.io | Bi-directional events for live progress |
| AI service | Python 3.11 + FastAPI | Async, Pydantic, Python AI ecosystem |
| LLM providers | OpenAI / Gemini / Claude / Llama / DeepSeek / Mistral / Ollama | Full coverage |
| File parsing | PyMuPDF, python-docx, tree-sitter, BeautifulSoup4 | Multi-format |
| Tokenization | tiktoken + HuggingFace tokenizers | Accurate per-provider counting |
| Database | PostgreSQL 16 | ACID, JSONB for flexible fields |
| Cache | Redis 7 | Sessions, rate limiting, semantic cache |
| Auth | JWT (access + refresh rotation) + bcrypt | Stateless, secure |
| Container | Docker Compose (dev), Nginx reverse proxy | Easy local + prod parity |
