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

- dataset: ex. `sendgrid`
- table: ex. `mail_events`

  - schema: src/bigquery/mail_events.schema
  - partitioning: daily

- scheduled query
  1. for today
  - query SQL: src/bigquery/scheduled_query_today.sql
  - query name: `mail_events_daily_today`
  - schedule: ondemand
  - write to:
    - dataset: `sendgrid`
    - table id: `mail_events_daily_{run_date}`
    - overwrite: true
  2. for lastday
  - query SQL: src/bigquery/scheduled_query_lastday.sql
  - query name: `mail_events_daily_lastday`
  - schedule: at 8:00
  - write to:
    - dataset: `sendgrid`
    - table id: `mail_events_daily_{run_time-24h|"%Y%m%d"}`
    - overwrite: true

## Create Pub/Sub Subscription

- subscription id: ex. `sendgrid_mail_event_sub`

set bigquery dataset(ex. `sendgrid`) and table (ex. `mail_events`)

- delivery type Write to BigQuery
- uncheck `use topic schema`
- check `write metadata`
- uncheck `drop unknown fields`

if cannot create subscription, try add permission for bigquery `mail_events` table to service account of pub/sub

## Cloud Function Deploy

```
SENDGRID_VERIFICATION_KEY='[Verification Key]'
SENDGRID_MAIL_EVENT_PUB='[topic name]'

gcloud beta functions deploy send-grid-webhook \
--gen2 \
--region=asia-northeast1 \
--runtime=nodejs16 \
--entry-point=sendGridWebhook \
--trigger-http \
--allow-unauthenticated \
--set-env-vars SENDGRID_VERIFICATION_KEY=${SENDGRID_VERIFICATION_KEY},SENDGRID_MAIL_EVENT_PUB=${SENDGRID_MAIL_EVENT_PUB}
```

## set SendGird Event Webhook Post URL

https://app.sendgrid.com/settings/mail_settings

set cloudfunction endpoint url to `HTTP Post URL` and set `Event Webhook Status` to Enabled
and Save..
(if not save ,"X-Twilio-Email-Event-Webhook-Signature" and "X-Twilio-Email-Event-Webhook-Timestamp" headers do not send.
so verification failed
if you dont save in production, please test sendgrid dev account, before make it.)

reopen Event Webhook

push `Test Your Integration`

### CHECK

#### Cloud Function Log

in cloud function log, if published log is written. success receive sendgrid webhook data and publish for bigquery

```
2022-08-18 14:43:02.334 JSTmessageId:5435950069592094 published
```

#### BigQuery Table Preview

subscriber table, add new row of sendgrid raw data(subscription_name, data, message_id, publish_time, attributes)

run `src/bigquery/scheduled_query_today.sql` in bigquery console
get parsed event rows

```
[{
  "sg_event_id": "wwn6QimZXCSeJ1jEZJM2jg\u003d\u003d",
  "sg_message_id": "14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0",
  "timestamp": "2022-08-18T05:36:05Z",
  "event": "unsubscribe",
  "email": "example@test.com",
  "useragent": null,
  "url": null,
  "reason": null,
  "status": null,
  "attempt": null,
  "category": null,
  "marketing_campaign_id": null,
  "marketing_campaign_name": null,
  "marketing_campaign_version": null,
  "marketing_campaign_split_id": null,
  "sg_user_id": null,
  "publish_time": "2022-08-18T05:43:02.324Z",
  "pt": null
}, {
  "sg_event_id": "842YwVb725JKquifzce9fQ\u003d\u003d",
  "sg_message_id": "14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0",
  "timestamp": "2022-08-18T05:36:05Z",
  "event": "group_unsubscribe",
  "email": "example@test.com",
  "useragent": "Mozilla/4.0 (compatible; MSIE 6.1; Windows XP; .NET CLR 1.1.4322; .NET CLR 2.0.50727)",
  "url": "Mozilla/4.0 (compatible; MSIE 6.1; Windows XP; .NET CLR 1.1.4322; .NET CLR 2.0.50727)",
  "reason": null,
  "status": null,
  "attempt": null,
  "category": null,
  "marketing_campaign_id": null,
  "marketing_campaign_name": null,
  "marketing_campaign_version": null,
  "marketing_campaign_split_id": null,
  "sg_user_id": null,
  "publish_time": "2022-08-18T05:43:02.324Z",
  "pt": null
}]
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
