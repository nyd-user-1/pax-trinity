# pax-trinity

## Architecture & Core Surfaces

- **America Thinks (`/america-thinks`, `audience/`):** Python + PostgreSQL survey and electorate-slicing engine. Ingests and harmonizes national survey and polling datasets (ANES, CES, GSS, ACS, CPS, CVAP, Pew, WVS, VoteHub, MA enrollment/results, and lift archives) with construct layers, raking targets, significance testing, and simulation APIs.
- **Campaign & Content Intelligence (`src/`, `data/`):** Next.js 16 workspace for tracking campaign maps, YouTube channel velocity and breakout outliers (`/outliers`), message lift models, scoring methodologies (`/scoring`), and creative evaluations (`/evals`).
- **Agentic Inbox (`/agentic-inbox`):** AI-assisted inbox and workflow surface powered by AWS Bedrock Runtime/AgentCore and Resend.
- **Programmatic Video Studio (`src/video/`, Remotion):** Data-driven video composition and rendering pipeline using Remotion 4 and Remotion Lambda (`us-east-2`), with an admin-accessible Remotion Studio bundled at `/studio-app/`.
- **Data Ingestion Pipelines (`lambda/`):** Serverless AWS Lambda pipelines for YouTube `channel-ingest` and `velocity` tracking.

## Tech Stack

- **Web & UI:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Radix UI, Base UI, shadcn, TipTap 3, React Flow (`@xyflow/react`), Motion, GSAP
- **Charts & Reporting:** ECharts, Recharts, KaTeX, jsPDF, `pdf-lib`
- **Video & Audio:** Remotion 4 (`@remotion/player`, `@remotion/web-renderer`, `@remotion/lambda`), Higgsfield AI, Amazon Polly
- **Survey & Data Backend (`audience/`):** Python, PostgreSQL (`audience/migrations/`), `pyproject.toml`
- **Cloud & Auth (AWS):** Amplify Hosting, Bedrock Runtime & AgentCore, Cognito (`next-auth` v5), DynamoDB, RDS Data API, S3, Lambda, EventBridge, Secrets Manager, SSM, Resend
- **Testing:** Vitest, Playwright, pytest (`audience/tests/`)

## Repository Structure

```text
├── .github/workflows/       # CI build checks (build-check.yml)
├── audience/                # Python survey/polling ingestion, migrations, modeling & tests
│   ├── audience/            # Loaders (anes, ces, gss, acs, cps, pew, wvs, etc.) & analysis modules
│   ├── migrations/          # PostgreSQL schema and construct migrations (001–013)
│   ├── seed/                # Seed polling and wave CSVs
│   └── tests/               # Synthetic fixtures and unit/integration tests
├── data/                    # Generated models, reference baselines, sample & velocity datasets
├── docs/                    # Architecture briefs, closeouts, reports, and wireframes
├── lambda/                  # Serverless AWS Lambda functions (channel-ingest, velocity)
├── patches/                 # patch-package dependency patches
├── public/                  # Static assets (/logos, /visuals, /flags)
├── scripts/                 # Data export, decoding, and pipeline automation scripts
├── sketches/                # Standalone HTML/UI prototypes
└── src/
    ├── app/                 # Next.js App Router pages & API routes
    ├── components/          # Shared application components
    ├── data/                # App-level data adapters
    ├── govblock-ui/         # Design system primitives (animbits, nova)
    ├── ui/                  # UI components
    └── video/               # Remotion compositions and Lambda render server
```

## Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.11+ (for `audience/` survey loaders and analysis)
- **PostgreSQL** (for the `audience/` survey database)
- **AWS Credentials** configured via IAM role or local AWS CLI for Bedrock, DynamoDB, RDS, S3, Cognito, Polly, and Remotion Lambda (`us-east-2`)

### Web Application Setup

1. Install dependencies (automatically applies `patches/` via `postinstall`):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Audience Survey Engine Setup (`audience/`)

1. Install Python dependencies from `audience/pyproject.toml`:
   ```bash
   cd audience
   pip install -e .
   ```

2. Run database migrations and tests:
   ```bash
   python -m audience.migrate
   pytest
   ```

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js dev server (purges `.next` automatically if cache exceeds 8 GB). |
| `npm run build` | Bundles Remotion Studio (`studio:bundle`) and builds Next.js for production. |
| `npm start` | Starts the production Next.js server. |
| `npm run typecheck` | Runs TypeScript type checking (`tsc --noEmit`). |
| `npm run video:studio` | Opens local Remotion Studio (`src/video/index.ts`). |
| `npm run studio:bundle` | Builds the static Remotion Studio bundle into `.studio-bundle/`. |
| `npm run video:site` | Deploys the Remotion Lambda site (`pax-video`) to `us-east-2`. |
| `npm run test:video` | Runs the Vitest test suite (`vitest run`). |

## Deployment

- **Web App:** Deployed on AWS Amplify (configured with `images: { unoptimized: true }`, `serverExternalPackages` for AWS SDKs, and `sharp`/`@img` excluded from output tracing to stay under Amplify's 220 MB bundle limit).
- **Video Rendering:** Deployed to AWS Lambda (`us-east-2`) via `npm run video:site`.
- **Ingest Pipelines:** Deployed individually via `deploy.sh` inside `lambda/channel-ingest/` and `lambda/velocity/`.
