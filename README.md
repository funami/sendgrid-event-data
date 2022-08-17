# sendgrid-event-data

receive sendgrid event log via webhook, and store to bigquery

# setup

## Set SendGrid Verification Key

https://app.sendgrid.com/settings/mail_settings

create .env file. and set SENDGRID_VERIFICATION_KEY with Verification Key

from sendgrid Mail Settings > Event Settings > Signed Event Webhook Requests

```.env
SENDGRID_VERIFICATION_KEY='[Verification Key]'
```

## Create Pub/Sub Topic

default topic name: `sendgrid_mail_event_pub`
if use another name, please set SENDGRID_MAIL_EVENT_PUB

```.env
SENDGRID_MAIL_EVENT_PUB='[topic name]'
```

## Create BigQuery Dataset and Table

- dataset: ex. sendgid
- table: ex. mail_events with mail_events.schema

- scheduled query
  1. for today - scheduled_query_today.sql every 8 hours
  2. for lastday - scheduled_query_lastday.sql at 8:00

## Create Pub/Sub Subscription

set bigquery dataset and table
delivery type Write to BigQuery
uncheck `use topic schema`
check `write metadata`
uncheck `drop unknown fields`

## Cloud Function Deploy

```
gcloud beta functions deploy send-grid-webhook \
--gen2 \
--region=asia-northeast1 \
--runtime=nodejs16 \
--entry-point=sendGridWebhook \
--trigger-http \
--allow-unauthenticated \
--set-secrets SENDGRID_VERIFICATION_KEY=projects/${GCLOUD_PROJECT_ID}/secrets/SENDGRID_VERIFICATION_KEY:latest
```

# dev

## pub/sub emulator

https://cloud.google.com/pubsub/docs/emulator?hl=ja

before test. start pub/sub emilator

```
gcloud beta emulators pubsub start
```

```
$(gcloud beta emulators pubsub env-init)
```

# Refs

## cloud function

https://github.com/GoogleCloudPlatform/functions-framework-nodejs
https://github.com/GoogleCloudPlatform/functions-framework-nodejs/blob/master/docs/typescript.md
