#!/usr/bin/env bash
# Deploys lambda/channel-ingest as pax2-channel-ingest in the new account (613473203863, us-east-2, profile
# pax-new): Node 22, 512 MB, 900 s, no automatic retries of an async invoke. Bundles handler.ts with
# src/lib/channel-ingest.ts (esbuild via npx; the AWS SDK is the runtime's). Its execution role,
# pax2-channel-ingest: SSM read on /pax2/youtube/* (the channel tokens and the OAuth client), DynamoDB
# Query/GetItem/PutItem/DeleteItem on pax-trinity-ledger (DeleteItem for un-picked private and unlisted
# videos), lambda:InvokeFunction on itself (the hand-off between passes), CloudWatch Logs. Lets the Amplify
# compute role invoke the function. Moved from the old account's us-east-1 on 2026-11-01; the code's
# defaults (ledger table and region, the function's region) already name this home, so it needs no
# environment.
#
#   ./lambda/channel-ingest/deploy.sh            # dry run: what exists, what it would make
#   ./lambda/channel-ingest/deploy.sh --apply    # makes or updates every piece
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-2
ACCOUNT=613473203863
PROFILE=pax-new
TABLE=pax-trinity-ledger
FN=pax2-channel-ingest
ROLE=pax2-channel-ingest
APP_ROLE=pax-trinity-amplify-compute
FN_ARN=arn:aws:lambda:$REGION:$ACCOUNT:function:$FN
MODE=dry; case "${1:-}" in --apply) MODE=apply ;; "") ;; *) echo "usage: $0 [--apply]"; exit 1 ;; esac
AWS_BIN=$(type -P aws)
aws() { "$AWS_BIN" --profile $PROFILE --region $REGION "$@"; }

ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text 2>/dev/null || true)
HAVE_FN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text 2>/dev/null || true)
echo "role:     ${ROLE_ARN:-(would create $ROLE)}"
echo "function: ${HAVE_FN:-(would create $FN)}"
echo "app role: $APP_ROLE gets lambda:InvokeFunction on $FN"
# A channel of 500 videos: about 25 Data API and Analytics calls plus 500 retention calls, a few minutes
# at 512 MB; at \$0.0000167 per GB-second, under a cent a channel.
[ $MODE = apply ] || { echo "dry run; --apply makes it"; exit 0; }

BUILD=$(mktemp -d)
npx --yes esbuild@0.25.10 lambda/channel-ingest/handler.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile="$BUILD/index.mjs" '--external:@aws-sdk/*' --alias:server-only=./lambda/channel-ingest/server-only.mjs --tsconfig=tsconfig.json --log-level=warning
(cd "$BUILD" && zip -q fn.zip index.mjs)
echo "bundled $(wc -c < "$BUILD/index.mjs" | tr -d ' ') bytes"

if [ -z "$ROLE_ARN" ]; then
  ROLE_ARN=$(aws iam create-role --role-name $ROLE --query Role.Arn --output text \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}')
  echo "role created; waiting for IAM to propagate"; sleep 12
fi
aws iam put-role-policy --role-name $ROLE --policy-name $ROLE --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":[\"ssm:GetParameter\"],\"Resource\":\"arn:aws:ssm:$REGION:$ACCOUNT:parameter/pax2/youtube/*\"},
  {\"Effect\":\"Allow\",\"Action\":[\"dynamodb:Query\",\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:DeleteItem\"],\"Resource\":\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE\"},
  {\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"$FN_ARN\"},
  {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"arn:aws:logs:$REGION:$ACCOUNT:log-group:/aws/lambda/$FN:*\"}]}"
echo "role policy written"

if [ -z "$HAVE_FN" ]; then
  for i in 1 2 3 4 5; do
    aws lambda create-function --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
      --memory-size 512 --timeout 900 --zip-file "fileb://$BUILD/fn.zip" >/dev/null && break
    echo "create refused (role not assumable yet); retrying"; sleep 8
  done
  echo "function created"
else
  aws lambda update-function-code --function-name $FN --zip-file "fileb://$BUILD/fn.zip" >/dev/null
  aws lambda wait function-updated --function-name $FN
  aws lambda update-function-configuration --function-name $FN --memory-size 512 --timeout 900 >/dev/null
  echo "function updated"
fi
aws lambda wait function-active --function-name $FN
aws lambda put-function-event-invoke-config --function-name $FN --maximum-retry-attempts 0 >/dev/null
echo "async retries: 0"

aws iam put-role-policy --role-name $APP_ROLE --policy-name pax2-channel-ingest \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"$FN_ARN\"}]}"
echo "$APP_ROLE may invoke $FN"
rm -rf "$BUILD"
