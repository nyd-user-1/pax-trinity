# Brief: AWS shutdown and full cost audit

You are an Opus window taking the AWS cost brief. This is account-ops work, not app work: you act on the AWS account this machine's credentials reach, across **all regions**, while other windows keep building. Ground rules: commit only to this file (path-limited, `git commit docs/briefs/aws-cost-audit.md`), never push, never touch the running dev server on :3000. Cost Explorer calls cost a cent each — use them freely; they're cheaper than guessing.

## The situation

Credits are exhausted; October's whole bill is $27.30. Brendan has authorized shutting down the spenders by category, listed below. The posture is **bank, then kill, reversibly where possible**: snapshot or export anything that might be wanted back, prefer disable over delete, use recovery windows where a service offers one, and write down the re-enable path for every single thing you turn off.

**Never touch, under any reading:** the `pax-trinity-audience-*` S3 bucket (exports/ and raw/ carry tonight's work), the pax-trinity DynamoDB tables (`pax-trinity-test-responses` and kin), the Amplify apps and their builds, the clips CloudFront distribution and its S3 origin, Route 53 and domains, and anything you cannot positively identify — unknowns go in the report as HELD, not into the shredder.

## Authorized shutdowns, from October's actual spend

1. **$7.94 DataTransfer-Regional-Bytes — find the chatty thing and shut it down.** Suspects: ECS (there's $0.55 of ECS and $1.43 of ECR, so containers exist), the leuk harvest pipelines, Glue jobs moving data cross-AZ. Identify by resource: Cost Explorer grouped by resource/region, VPC flow if needed, CloudTrail for the write paths. Stop the ECS services/tasks, disable the schedules (EventBridge rules, cron-like triggers) that revive them. Brendan's word on the harvest pipelines is "gotta shut it down" — disable their triggers and runners; document re-enable.
2. **Model-invoking pipelines ($6.07 Bedrock Sonnet, $4.09 Rekognition, $2.14 TwelveLabs, $0.53 Polly) — find out what calls them and shut it down.** CloudTrail event lookup (InvokeModel, Rekognition/Polly API events) → caller role → the pipeline that assumes it. Name it in the report (likely a video-analysis or harvest enrichment job), disable its trigger, and say what it was doing so Brendan can decide if it ever comes back.
3. **Secrets Manager ($3.60, nine secrets) → SSM Parameter Store.** For each secret: replicate the value to Parameter Store as a SecureString under a matching path, grep ~/Code (leuk, pax-trinity, 44b, hq) for consumers of the secret's name/ARN and repoint them, verify the consumer path reads SSM, then delete the secret **with the maximum 30-day recovery window**, never force-delete. Any secret with a consumer you can't find or can't verify: HELD, in the report.
4. **Glue ($2.45) — stop the warm interactive sessions, disable every job schedule and crawler.** List what each job was; delete nothing, disable everything.
5. **The in-use public IPv4 ($1.54/mo so far) — release it.** First identify what holds it; if it's an instance or NAT that's part of item 1's shutdown, shut that down first, then release the address.
6. **ECR and SageMaker — bank, then shut down.** ECR: keep the latest tagged image per repository exported or retained, delete untagged and stale images, add a lifecycle policy. SageMaker: list endpoints, notebook instances, apps and domains across regions; stop/delete anything running; archive model artifacts and anything restore-worthy to S3 (Glacier Instant Retrieval class is fine) before deleting; record the restore path.
7. **Credits.** Check the account's AWS Activate status; if the Activate Founders tier ($1,000, self-serve, no VC required) hasn't been drawn, prepare the application to the point where Brendan clicks submit — he applies, you don't. Note in the report what the bigger Activate tiers would require (an affiliated accelerator/VC). Azure Founders Hub and Google for Startups drafts are out of scope here; just note them as options.

## The full audit

After the shutdowns, sweep the whole account, **every region**: EC2 instances and EBS volumes/snapshots, NAT gateways, load balancers, RDS, ElastiCache, OpenSearch, Lambda functions with schedules, EventBridge rules, Kinesis, SageMaker leftovers, S3 buckets by size and storage class, CloudWatch log groups without retention (set retention, don't delete), and anything billing in October no matter how small. The deliverable is a table: resource, region, what it is, October cost, action taken (STOPPED / DELETED after banking / HELD + why), re-enable or restore path.

## Done means

Projected monthly bill after your pass, stated as a number against October's $27.30, with the single-digit target named honestly if something held keeps it above that. The report appended below, the kill table complete, every action reversible or banked, nothing from the never-touch list so much as described in a write call. Rulings and HELD items to the lead session (pax-trinity-1c) by message.

---

## Worker report

Account 638175140432, credentials `user/2525-cli`, swept 2026-10-26 across all 17 regions. Everything billable is in us-east-1. The other 16 regions hold only the multi-region trail `2525-management`, plus one empty bucket in us-west-2.

### The number

| | Monthly |
|---|---|
| October as billed (net) | $27.30 |
| October gross usage, before credits | $185.26 |
| Run rate Oct 19–25, gross, pax2 loop running | $181 |
| **Projected after this pass, gross = net** | **~$59 before tax, ~$65 with tax** |

October's $27.30 was small only because $159.83 of credit absorbed EC2, RDS, S3, Amplify and WAF. The credits are spent: $1,199.94 has been drawn since July, which is the $1,000 Activate Founders credit plus about $200 of free-plan credit, and the free-plan API reports $0.00 remaining. From November the bill is the gross run rate. The projection is higher than October's bill because the credits ran out, not because usage rose.

Projected ~$59: S3 $17.43, govblock Aurora $14.66, Amplify $9.97 (never-touch), EBS snapshot archives $6.67, Aurora manual snapshots $5.88, SageMaker space volume $1.73, Secrets Manager $1.55, KMS $1.00, ECR $0.46. Bedrock calls from the Amplify apps and from the Mac come on top and vary: $0.04 to $1.08 a day last week.

**Single digits aren't reachable in this pass.** Amplify alone is ~$10/month and is never-touch. If every HELD ruling below went the cheapest way, the floor would be about $20 (Amplify plus the Glacier IR archives).

### Kill table

| Resource | Region | What it is | October cost | Action | Re-enable / restore |
|---|---|---|---|---|---|
| LaunchAgent `com.pax2.lead-watchdog` | this Mac | Hourly reviver: if the PAX2 lead session goes quiet, it resumes it headlessly with `claude -p --resume … --dangerously-skip-permissions`. That loop launched the Oct 17–22 runs: about 300 instances, including 20-box t3.micro yt-dlp fleets, g5/g6/g6e encoder/whisper/vqa/broll/codebook GPU boxes and c7i rigs. It was retrying every hour; every attempt since Oct 19 left an empty output file. | EC2 compute Oct 17–23 $21.80, regional transfer Oct 18–22 $3.92, public IPv4 $1.54, Mac-side Sonnet and Polly | **STOPPED**: `launchctl bootout`, plist renamed `.plist.disabled` (the same convention as the leuk/44b agents) | `mv ~/Library/LaunchAgents/com.pax2.lead-watchdog.plist{.disabled,} && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pax2.lead-watchdog.plist` |
| DataTransfer-Regional-Bytes, 794 GB | us-east-1 | Two bursts: Oct 1–3 (402 GB) was the govblock `gbp-*` state boxes and the `migrate-box*` boxes; Oct 18–22 (392 GB) was the pax2 runs above. Resource-level Cost Explorer data isn't enabled, so this attribution is by date match against CloudTrail launches. | $7.94 gross, **$0.10 net**: a −$7.84 credit line offset it | Nothing running now. govblock reviver `govblock-pipeline-weekly` found already DISABLED. pax2 reviver stopped above. | `aws scheduler update-schedule` on `govblock-pipeline-weekly` with `--state ENABLED` |
| LaunchAgents `com.leuk.harvest`, `com.44b.harvest`, `com.44b.cu-watch`, `com.44b.vercel-watch` | this Mac | leuk and 44b harvest runners | not AWS | Found already disabled (`.plist.disabled`) | rename to `.plist`, then `launchctl bootstrap` |
| ECS `leuk-cluster` (task defs `leuk-task:1–3`) | us-east-1 | leuk Fargate ARM tasks | $0.55, all Oct 1 | Found idle: 0 services, 0 tasks, nothing scheduling it | `aws ecs run-task --cluster leuk-cluster --task-definition leuk-task:3 --launch-type FARGATE …` |
| EC2 `pax-worker` i-029959fd31bba9a75 | us-east-1 | The Oct 3–4 video-analysis box: Rekognition segment detection (shot + technical cue, 20.5 min of video), Pegasus 1.2 (62 calls), Polly (89 calls), Sonnet (25 calls), under role `pax-worker` | Rekognition $4.09, Pegasus ~$2.06, Polly $0.44, Sonnet ~$0.74 | Found terminated Oct 15 by an earlier pass. Root volume banked as `snap-027631fa4c86264d7` (60 GB). | Create a volume from the snapshot, launch a t4g.large with it as root and instance profile `pax-worker` |
| Lambda `pax2-analyze` | us-east-1 | Fired by S3 ObjectCreated `uploads/*.mp4` on `pax-2-638175140432`. Starts a self-terminating c7i.large (profile `nsr-embed`) that runs Whisper, CLIP, ResMem and Pegasus. pax-trinity's own upload path writes to that bucket (`src/app/actions.ts:121`) and `src/lib/originals.ts` reads the "analyzed" events. | Pegasus $0.08 over 6 boxes, Oct 18–19, plus ~1.5¢ per box | **HELD**, ruling R1 | Disable: `aws lambda put-function-concurrency --function-name pax2-analyze --reserved-concurrent-executions 0`. Re-enable: `aws lambda delete-function-concurrency --function-name pax2-analyze` |
| Bedrock calls from Amplify apps | us-east-1 | `pax-2` app server calling Sonnet (Oct 15, 23, 24); `sports` app calling Haiku (Oct 1) | part of Sonnet's $6.07; Haiku $0.17 | HELD: never-touch | — |
| Bedrock calls from the Mac CLI | — | Interactive windows using the AWS MCP server: 82 Sonnet calls Oct 4, one call to each of ~25 models Oct 20, pax2 scripts Oct 17–23. Not a pipeline; nothing to disable on AWS. | most of Sonnet's $6.07, Opus 4.6 $0.28 | No AWS trigger exists. The pax2 loop driving most of these is stopped above. | — |
| Lambda `insurance-api` | us-east-1 | The insurance product's streaming API behind CloudFront EH81LYJSIN1KP; Sonnet calls Oct 1 only; its database went in the Oct 15 shutdown | ~$0.02 | HELD: product endpoint, $0 at rest | — |
| Secret `govblock/slack` | us-east-1 | Empty placeholder (no `bot_token`). Read by pax-trinity `src/lib/agents/connections/slack.ts` and govblock `apps/web/lib/agents/connections/slack.ts`. | $0.40/mo | **Banked** to SSM SecureString `/govblock/slack` (hash-verified). Delete HELD, ruling R2. | Live as is. After repoint: `aws secretsmanager delete-secret --secret-id govblock/slack --recovery-window-in-days 30` |
| Secret `govblock/discord` | us-east-1 | Live webhook URL. Read by pax-trinity `src/lib/agents/connections/discord.ts` and govblock `apps/web/lib/agents/connections/discord.ts`. Last read Oct 25 from the Mac. | $0.40/mo | **Banked** to `/govblock/discord`. Delete HELD, R2. | as above |
| Secret `govblock/discord-bot` | us-east-1 | Live bot token, guild and channel. Read by govblock `apps/web/lib/agents/connections/discord-community.ts`. | $0.40/mo | **Banked** to `/govblock/discord-bot`. Delete HELD, R2. | as above |
| Secret `rds!cluster-ee58a523…` | us-east-1 | RDS-managed master secret for the govblock Aurora cluster. Read through the RDS Data API by `nysgpt-api` (Oct 24), the NYSgpt Amplify app and the Mac. | in Secrets total | HELD: the Data API only accepts Secrets Manager ARNs | — |
| Secrets `bedrock-agentcore-identity!default/oauth2/govblock-google-…` and `…/govblock-slack-…` | us-east-1 | Owned by AgentCore Identity (OAuth2 credential providers); last read Sep 20 | in Secrets total | HELD: service-owned, and AgentCore can't read SSM. Removing them means deleting the credential providers, ruling R7. | — |
| Secret `events!connection/linkedin-publisher/…` | us-east-1 | Owned by an EventBridge connection; its rule `linkedin-publish-every-minute` is DISABLED | in Secrets total | HELD: service-owned. Removing it means deleting the connection, R7. | — |
| Secrets `leuk/env`, `44b/demo/aurora`, two 44b AgentCore secrets | us-east-1 | Deletion requested Oct 15 by an earlier pass | in Secrets total ($3.62) | Found pending deletion | `aws secretsmanager restore-secret --secret-id <name>` until each recovery window closes |
| Glue: jobs `govblock-elections-raw-tables`, `govblock-elections-tables`, `govblock-fec-cycles`, `govblock-ny-bill-status-flow`, `govblock-ny-committee-workload`; crawler `govblock-open-us-law-snapshot`; 3 interactive sessions | us-east-1 | govblock lake ETL (elections, FEC cycles, NY bill status, committee workload) | $2.54, all Oct 1–3 | Found idle: no triggers, no workflows, crawler unscheduled, all sessions TIMEOUT since Oct 1–2. MWAA Serverless `govblock_ny_refresh` is `manual_only`. Nothing to disable. | `aws glue start-job-run --job-name <job>` |
| Public IPv4 | all regions | In-use addresses on the pax2 boxes, Oct 18–22 | $1.54 | Found none held: 0 Elastic IPs and 0 public ENIs in any region. Nothing to release. | Comes back only with new launches |
| ECR `nysgpt-rerankers` (3 tagged images, 2.2 GB) and `biomed-encoder` (1 tagged image, 2.24 GB) | us-east-1 | Images behind the Marketplace model packages (validation jobs Oct 6–7). The 14-region ECR egress on Oct 6–7 was Marketplace replication. | $1.43, of which $1.20 was the one-time replication | **Lifecycle policy added**: untagged images expire after 1 day. The preview expires nothing; every image is tagged and current, so all are kept. | `aws ecr delete-lifecycle-policy --repository-name <repo>` |
| ECR `leuk` (1 image, tags `2`/`latest`) | us-east-1 | leuk container | in the above | Already had "keep last 10"; unchanged | — |
| SageMaker endpoints, notebook instances, inference components, MLflow, running jobs | all regions | — | — | None exist | — |
| SageMaker space `default-aaf9f9f1-…` in domain `d-siwxf5me3grg` | us-east-1 | Unified Studio JupyterLab space, 16 GB home volume, used ~1 h on Oct 1–2 | $1.42 (volume) + $0.05 (JupyterLab) | **HELD**, R6. Unified Studio refuses presigned URLs, so the home volume can only be opened in the portal. I started its JupyterLab app for ~3 min to try banking, found it unreachable, and deleted the app (status Deleted). | — |
| SageMaker model artifacts `govblock-ny-committee-referral-1…5` (2.6 GB) | us-east-1 | Trained models in `s3://amazon-sagemaker-638175140432-us-east-1-dncy9hq2gvgmuf/shared/govblock-demo/models/` | ~$0.06/mo | **Archived** in place, Standard to GLACIER_IR (bucket unversioned, so no Standard copies remain) | Instant read as is; `aws s3 cp --recursive <prefix> <prefix> --storage-class STANDARD` to move back |
| SageMaker domains `d-siwxf5me3grg`, `d-xt3vofjtehsz` | us-east-1 | Unified Studio and QuickSetup domains; no apps, no EFS | $0 | Kept | — |
| CloudWatch log groups (45 without retention) | us-east-1 | Glue, Lambda, AgentCore, CodeBuild, RDS, SageMaker logs, 46 MB total | $0.03 | **Retention set to 365 days.** The account is under 4 months old, so nothing expires yet. All 17 regions now report zero groups without retention. | `aws logs delete-retention-policy --log-group-name <group>` |
| Aurora Serverless v2 `govblock` (writer `govblock-writer`) | us-east-1 | Live database: `nysgpt-api` and the NYSgpt app query it through the Data API. Already min 0 ACU with 300 s auto-pause, ~75 GB. | $14.66/mo steady (storage $7.56, ACU $4.57, IO $2.53) | **HELD**, R3 | — |
| 14 Aurora manual cluster snapshots (`*-final-2026-10-15`, `govblock-before-cleanup-2026-10-02`) | us-east-1 | Restore points for the 13 clusters deleted Oct 15; ~293 GB. `b44-final` was also exported to Parquet at `govblock-lake/lake/v1/ai` on Oct 24. | $5.88/mo | HELD (banked restore points), R4 | `aws rds restore-db-cluster-from-snapshot --snapshot-identifier <id> …` |
| 14 EBS snapshots, archive tier | us-east-1 | Root volumes of the 12 stopped instances, plus `pax-worker` and `leuk-aetna-bulk` | $6.67/mo | HELD (banked). The archive tier bills a 90-day minimum, so deleting early saves nothing. | Restore the snapshot to standard tier, create a volume, attach as root |
| 12 stopped EC2 instances (44b-*, solar-*, govblock-*, livingston-*, cshl-serve-cshl, nsr-serve) | us-east-1 | Instance shells with no volumes | $0 | Kept | Attach a volume from its snapshot, then start |
| S3, 37 buckets in us-east-1 | us-east-1 | 2.08 TB already in Glacier IR. Standard holders: `govblock-lake` 276 GB (active: the Oct 24 export landed there), `solar-grid-lake` 64 GB, `livingston-bill-pdfs` 49 GB, `pax-2` 44 GB (pax-trinity uses it), `tariffs-cross-docs` 13 GB, `hermes` 11 GB | $17.43/mo steady | HELD, R5 | — |
| KMS `alias/nysgpt-lake-export` | us-east-1 | Created Oct 24; encrypts the b44 Parquet export | $1/mo | HELD: deleting it would make the export unreadable | — |
| Lambda pollers `pax2-velocity-poll`, `hermes-velocity-poll` | us-east-1 | YouTube view-count pollers every 15 min, writing to S3; switched on and off from their dashboards | $0.00 (free tier) | Kept: product features, not spenders | — |
| AgentCore runtimes and memories, Step Functions (6), Athena (no Spark sessions), CodeBuild (3), API Gateway (2), DynamoDB (non-pax-trinity tables) | us-east-1 | Consumption-priced and idle | $0.01–0.49 each | Kept | — |
| WAF, OpenSearch, NAT, load balancers, ElastiCache, Kinesis, Redshift, EFS, EMR, Batch | all regions | — | WAF $11.92 and ELB $0.16 early in October | None exist now; they were removed before this pass | — |

### Rulings for the lead

- **R1. `pax2-analyze`: keep or throttle?** I held it rather than throttle it. It's pax-trinity's live upload-analysis path, and an S3 event throttled while it's off is retried for 6 hours and then dropped, so uploads made in that window never get analyzed. It cost $0.08 of Pegasus in October. **Lead ruling: KEEP, held by design.** It's a live product function, and $0.08 a month buys nothing.
- **R2. The govblock secrets.** **Lead ruling: DEFER.** All three secrets stay in Secrets Manager. The SSM copies stay as the migration-ready state, and the reader swap happens whenever govblock next gets an app window. The SSM copies exist. To finish, repoint the consumers and deploy:
  - pax-trinity: `src/lib/agents/connections/slack.ts`, `discord.ts`
  - govblock: `apps/web/lib/agents/connections/slack.ts`, `discord.ts`, `discord-community.ts`

  The change is SSM `GetParameter` with `WithDecryption`, plus `ssm:GetParameter` on `/govblock/*` and `kms:Decrypt` on `aws/ssm` for the compute roles. That needs an app window and an Amplify deploy, both outside this brief, which is why the deletes are held. It saves $1.20/month.
- R3–R8 are Brendan's; the lead put them in front of him with this report.
- **R3. govblock Aurora ($14.66/month plus its share of backups): keep, or migrate off AWS?** It's the biggest single line I could not touch.
- **R4. Aurora final snapshots ($5.88/month): keep all 14, or drop `b44-final` (127 GB, $2.67) now that it's in Parquet?** Parquet is a dataset, not a database restore.
- **R5. Parked Standard data to Glacier IR:** `solar-grid-lake`, `livingston-bill-pdfs` (its Standard part) and `tariffs-cross-docs` would save $2.39/month. The 2.08 TB already in Glacier IR would drop from $7.30 to about $2.06 in Deep Archive, with 12-hour restores and a 90-day minimum.
- **R6. SageMaker space ($1.73/month):** open it in the Unified Studio portal and download anything wanted, or rule it disposable. Then `aws sagemaker delete-space --domain-id d-siwxf5me3grg --space-name default-aaf9f9f1-4255-43e4-a8d9-e0dc70dbc2a7`.
- **R7. Service-owned secrets ($1.20/month): keep, or delete?** These are the two govblock AgentCore OAuth providers and the `linkedin-publisher` EventBridge connection. Deleting them means re-entering their OAuth client credentials to restore.
- **R8. Confirm the credit balance on the Billing console's Credits page.** The API can't read promotional balances. The arithmetic says $0.06 is left.

### Activate

Founders has already been drawn: $1,000, recorded in `govblock/docs/prompts/2026-09-30-aws-activate-questions.md`, and it matches the $1,199.94 of credits consumed. So there is no Founders application to prepare.

AWS's own guide says select Founders startups can qualify for up to $5,000 over time, which is the reapplication path that doc's questions B5–B10 already target. The larger Portfolio tier (third-party guides say up to $100,000; AWS's June 2026 guide says up to $200,000) requires an Activate Provider Organization ID from an affiliated VC, accelerator or incubator, and pre-Series B status.

Azure Founders Hub and Google for Startups remain options, out of scope here.

### What I wrote, all of it

- launchd: booted out `com.pax2.lead-watchdog` and renamed its plist
- ECR: put lifecycle policies on `nysgpt-rerankers` and `biomed-encoder`
- SSM: put `/govblock/slack`, `/govblock/discord`, `/govblock/discord-bot`
- CloudWatch Logs: put retention on 45 groups
- S3: in-place storage-class copy on the SageMaker project's `models/` prefix
- SageMaker: create-app, then delete-app, on the one space

No write call named or described a never-touch resource: the `pax-trinity-audience-*` and `pax-trinity-clips-*` buckets, the pax-trinity DynamoDB tables, the Amplify apps, CloudFront E1KWOUYTX2OF63, and Route 53.
