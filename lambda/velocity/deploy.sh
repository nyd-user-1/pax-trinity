#!/usr/bin/env bash
# Deploys lambda/velocity as pax2-velocity-poll in the new account (613473203863, us-east-2, profile
# pax-new): Node 22, 1024 MB, 900 s, run every 15 minutes by the EventBridge rule pax2-velocity-poll. Its
# state lives in s3://pax-trinity-velocity-613473203863/velocity/ (readings by UTC day, baselines, the
# catalog, the stat card snapshots, the watch list the app writes). Its role, pax2-velocity-poller: Lambda
# basic execution plus S3 read and write on velocity/*. The Amplify compute role reads velocity/* and
# writes velocity/watch.json (lib/velocity-store.ts). Moved from the old account's us-east-1 on 2026-11-01.
#
# The YouTube Data API key comes from YOUTUBE_API_KEY in the environment when the function is created; an
# update leaves the function's environment as it is. It goes to the CLI through a private temp file, never
# on the command line.
#
#   ./lambda/velocity/deploy.sh                     # dry run
#   ./lambda/velocity/deploy.sh --apply             # makes or updates every piece; the rule stays as it is
#   ./lambda/velocity/deploy.sh --apply --enable    # and switches the 15-minute rule on
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=us-east-2
ACCOUNT=613473203863
PROFILE=pax-new
BUCKET=pax-trinity-velocity-$ACCOUNT
FN=pax2-velocity-poll
ROLE=pax2-velocity-poller
RULE=pax2-velocity-poll
APP_ROLE=pax-trinity-amplify-compute
FN_ARN=arn:aws:lambda:$REGION:$ACCOUNT:function:$FN
MODE=dry; [ "${1:-}" = --apply ] && MODE=apply
ENABLE=no; [ "${2:-}" = --enable ] && ENABLE=yes
AWS_BIN=$(type -P aws)
aws() { "$AWS_BIN" --profile $PROFILE --region $REGION "$@"; }

HAVE_BUCKET=$(aws s3api head-bucket --bucket $BUCKET >/dev/null 2>&1 && echo yes || true)
ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text 2>/dev/null || true)
HAVE_FN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text 2>/dev/null || true)
RULE_STATE=$(aws events describe-rule --name $RULE --query State --output text 2>/dev/null || true)
echo "bucket:   ${HAVE_BUCKET:+$BUCKET}${HAVE_BUCKET:-(would create $BUCKET)}"
echo "role:     ${ROLE_ARN:-(would create $ROLE)}"
echo "function: ${HAVE_FN:-(would create $FN)}"
echo "rule:     ${RULE_STATE:-(would create $RULE, disabled)}$([ $ENABLE = yes ] && echo ', then enable')"
[ $MODE = apply ] || { echo "dry run; --apply makes it"; exit 0; }

if [ -z "$HAVE_BUCKET" ]; then
  aws s3api create-bucket --bucket $BUCKET --create-bucket-configuration LocationConstraint=$REGION >/dev/null
  aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "bucket created, public access blocked"
fi

if [ -z "$ROLE_ARN" ]; then
  ROLE_ARN=$(aws iam create-role --role-name $ROLE --query Role.Arn --output text \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}')
  aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "role created; waiting for IAM to propagate"; sleep 12
fi
aws iam put-role-policy --role-name $ROLE --policy-name velocity-s3 --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/velocity/*\"},
  {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\"}]}"
echo "role policy written"

BUILD=$(mktemp -d)
chmod 700 "$BUILD"
(cd lambda/velocity && zip -q "$BUILD/fn.zip" index.mjs channels.json)
if [ -z "$HAVE_FN" ]; then
  [ -n "${YOUTUBE_API_KEY:-}" ] || { echo "YOUTUBE_API_KEY must be set in the environment to create $FN"; rm -rf "$BUILD"; exit 1; }
  ( umask 077; printf '{"Variables":{"VELOCITY_BUCKET":"%s","YOUTUBE_API_KEY":"%s"}}' "$BUCKET" "$YOUTUBE_API_KEY" > "$BUILD/env.json" )
  for i in 1 2 3 4 5; do
    aws lambda create-function --function-name $FN --runtime nodejs22.x --handler index.handler --role "$ROLE_ARN" \
      --memory-size 1024 --timeout 900 --environment "file://$BUILD/env.json" --zip-file "fileb://$BUILD/fn.zip" >/dev/null && break
    echo "create refused (role not assumable yet); retrying"; sleep 8
  done
  echo "function created"
else
  aws lambda update-function-code --function-name $FN --zip-file "fileb://$BUILD/fn.zip" >/dev/null
  echo "function code updated"
fi
rm -rf "$BUILD"
aws lambda wait function-active --function-name $FN

if [ -z "$RULE_STATE" ]; then
  aws events put-rule --name $RULE --schedule-expression "rate(15 minutes)" --state DISABLED \
    --description "The velocity poller, every 15 minutes (lambda/velocity)" >/dev/null
  aws lambda add-permission --function-name $FN --statement-id $RULE --action lambda:InvokeFunction \
    --principal events.amazonaws.com --source-arn "arn:aws:events:$REGION:$ACCOUNT:rule/$RULE" >/dev/null
  aws events put-targets --rule $RULE --targets "Id=1,Arn=$FN_ARN" >/dev/null
  echo "rule created, disabled"
fi
[ $ENABLE = yes ] && { aws events enable-rule --name $RULE; echo "rule enabled"; }

aws iam put-role-policy --role-name $APP_ROLE --policy-name pax2-velocity --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
  {\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/velocity/*\"},
  {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\"},
  {\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/velocity/watch.json\"}]}"
echo "$APP_ROLE reads velocity/* and writes velocity/watch.json"
