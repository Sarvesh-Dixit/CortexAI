# CompressionAI - Ultra-Low Resource LLM Context Compression Engine

An intelligent AI middleware platform that sits between users and LLM providers, reducing token usage by **70%+** while maintaining **95%+ semantic accuracy**.

## Architecture

```
User → Compression Engine (Multi-Agent Pipeline) → Optimized Prompt → LLM → Response
```

### Multi-Agent Pipeline (LangGraph-style)

The system uses a Supervisor Agent that orchestrates 13 specialized agents through a directed graph:

```
User Upload
  ↓
Supervisor Agent
  ↓
┌─────────────────────────────────────────────────┐
│  Input Processing Agent                         │
│  Document Classification Agent                  │
│  Language Detection Agent                       │
│  Token Analysis Agent                           │
│  Semantic Similarity Agent                      │
│  Duplicate Detection Agent                      │
│  Boilerplate Removal Agent                      │
│    ├── Code Analysis Agent (if code)            │
│    ├── Log Analysis Agent (if logs)             │
│    └── (direct to next if other)                │
│  Importance Scoring Agent                       │
│  Compression Agent                              │
│  Validation Agent                               │
│  Dashboard Agent                                │
└─────────────────────────────────────────────────┘
  ↓
Response (compressed + analytics + pipeline metadata)
```

**Key design principles:**
- The Supervisor NEVER performs compression. Only orchestration.
- Each agent has a single responsibility and operates independently.
- Agents receive current state → process → return updated state.
- The graph supports conditional routing, retry logic, and failure recovery.
- Non-critical agents failing does not crash the pipeline.

## Features

- Multi-stage compression pipeline with 4 compression levels (Low/Medium/High/Extreme)
- Support for 10+ file types: TXT, PDF, DOCX, MD, JSON, CSV, Python, JS, TS, Java, C++, Logs
- 7 LLM provider support: OpenAI, Gemini, Claude, Llama, DeepSeek, Mistral, Ollama
- Real-time analytics with compression trends, cost savings, and document type distributions
- API Playground for testing compression across providers
- Full authentication system (Register, Login, Forgot/Reset Password)
- Dark mode SaaS UI with responsive design
- Document management with drag-and-drop upload
- Compression history with search, filter, pagination

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Framer Motion, Recharts, Zustand |
| Backend | Node.js, Express, TypeScript, Prisma ORM, SQLite |
| Auth | JWT (Access + Refresh tokens), bcrypt |
| File Processing | pdf-parse, mammoth (DOCX), native text parsers |
| Validation | Zod schema validation |
| Security | Helmet, CORS, Rate Limiting, Input Sanitization |

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone and enter the project
cd compression-engine

# Install all dependencies
cd server && npm install && npx prisma generate && npx prisma db push && cd ..
cd client && npm install && cd ..
```

### Development

```bash
# Terminal 1 - Start the server
cd server
npm run dev

# Terminal 2 - Start the client
cd client
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
cd client && npm run build
cd ../server && npm run build
npm start
```

## Project Structure

```
compression-engine/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/              # Layout, Sidebar
│   │   ├── lib/                     # API client, utilities
│   │   ├── pages/                   # All 12 application pages
│   │   ├── store/                   # Zustand auth store
│   │   ├── App.tsx                  # Router configuration
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Tailwind + custom styles
│   └── vite.config.ts               # Vite + proxy config
│
├── server/                          # Express backend
│   ├── prisma/                      # Database schema + SQLite
│   ├── src/
│   │   ├── agents/                  # Multi-Agent Pipeline
│   │   │   ├── supervisor/          # Supervisor Agent + Workflow Graph
│   │   │   │   ├── supervisor.agent.ts  # Orchestrator (the brain)
│   │   │   │   └── graph.ts        # LangGraph-style execution engine
│   │   │   ├── nodes/              # 13 Specialized Agent Nodes
│   │   │   │   ├── input-processing.node.ts
│   │   │   │   ├── document-classification.node.ts
│   │   │   │   ├── language-detection.node.ts
│   │   │   │   ├── token-analysis.node.ts
│   │   │   │   ├── semantic-similarity.node.ts
│   │   │   │   ├── duplicate-detection.node.ts
│   │   │   │   ├── boilerplate-removal.node.ts
│   │   │   │   ├── code-analysis.node.ts
│   │   │   │   ├── log-analysis.node.ts
│   │   │   │   ├── importance-scoring.node.ts
│   │   │   │   ├── compression.node.ts
│   │   │   │   ├── validation.node.ts
│   │   │   │   └── dashboard.node.ts
│   │   │   └── types.ts            # Shared workflow state types
│   │   ├── cache/                   # LRU cache service
│   │   ├── engine/                  # Legacy compression engine
│   │   ├── evaluation/              # Batch evaluation service
│   │   ├── middleware/              # Auth, error handling
│   │   ├── routes/                  # API routes
│   │   ├── services/               # LLM Connector service
│   │   ├── utils/                   # Logger, Prisma, token utilities
│   │   ├── vector_store/            # In-memory vector store + TF-IDF
│   │   └── index.ts                # Server entry point
│   └── .env                         # Environment variables
│
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Sign in |
| `/api/auth/refresh` | POST | Refresh tokens |
| `/api/auth/me` | GET | Get current user |
| `/api/compression/compress` | POST | Compress text |
| `/api/compression/analyze` | POST | Analyze text |
| `/api/compression/history` | GET | Get compression history |
| `/api/documents/upload` | POST | Upload file |
| `/api/documents` | GET | List documents |
| `/api/analytics/overview` | GET | Dashboard stats |
| `/api/analytics/trends` | GET | Compression trends |
| `/api/playground/compress-and-compare` | POST | Compare across providers |
| `/api/settings` | GET/PUT | User preferences |
| `/api/settings/api-keys` | POST/DELETE | Manage API keys |

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Supported Document Types

| Type | Extensions | Compression Strategy |
|------|-----------|---------------------|
| Text | .txt | Semantic + Redundancy removal |
| PDF | .pdf | Full extraction + compression |
| DOCX | .docx | Raw text extraction + compression |
| Markdown | .md | Structure-aware (preserves headers, summarizes code blocks) |
| JSON | .json | Minification + depth truncation |
| CSV | .csv | Header + sample rows |
| Code | .py, .js, .ts, .java, .cpp | Comment removal, whitespace normalization, log stripping |
| Logs | .log | Pattern grouping, deduplication |
| Email | - | Signature/quote removal, header filtering |
| Legal | - | Boilerplate removal, section limiting |

## Design Principles

- SOLID principles throughout
- Clean Architecture with separation of concerns
- Modular compression pipeline (each compressor is independent)
- Type-safe with TypeScript on both client and server
- Reusable components and utilities
- Production-ready error handling and logging
