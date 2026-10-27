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

*(append here: the kill table, before/after monthly, HELD items, the Activate status, restore paths)*
