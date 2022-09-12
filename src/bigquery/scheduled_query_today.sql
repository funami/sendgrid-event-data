# set schedule query, 
# query name: `mail_events_daily_today`
# table id: `mail_events_daily_{run_date}`
# overwrite
WITH
  `raw_data` AS (
    SELECT
      publish_time,
      JSON_QUERY_ARRAY(SAFE_CONVERT_BYTES_TO_STRING(data)) data,
      _PARTITIONTIME as pt
    FROM
      `sendgrid.mail_events`
    WHERE
      DATE(_PARTITIONTIME) = CURRENT_DATE()
      OR _PARTITIONTIME IS NULL
  ),
  `raw_events` AS (
    SELECT
      publish_time,
      data,
      pt
    FROM
      raw_data,
      UNNEST (data) data
  ),
  `events` AS (
    SELECT
      *
    EXCEPT
    (row_num)
    FROM
      (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY sg_event_id
            ORDER BY
              publish_time
          ) row_num
        FROM
          (
            SELECT
              JSON_EXTRACT_SCALAR(data, "$.sg_event_id") AS sg_event_id,
              JSON_EXTRACT_SCALAR(data, "$.sg_message_id") AS sg_message_id,
              TIMESTAMP_SECONDS(
                CAST(JSON_EXTRACT_SCALAR(data, "$.timestamp") AS INT64)
              ) AS timestamp,
              JSON_EXTRACT_SCALAR(data, "$.event") AS event,
              JSON_EXTRACT_SCALAR(data, "$.email") AS email,
              JSON_EXTRACT_SCALAR(data, "$.useragent") AS useragent,
              JSON_EXTRACT_SCALAR(data, "$.url") AS url,
              JSON_EXTRACT_SCALAR(data, "$.reason") AS reason,
              JSON_EXTRACT_SCALAR(data, "$.status") AS status,
              JSON_EXTRACT_SCALAR(data, "$.attempt") AS attempt,
              JSON_EXTRACT_SCALAR(data, "$.category") AS category,
              CAST(
                JSON_EXTRACT_SCALAR(data, "$.marketing_campaign_id") AS INT64
              ) AS marketing_campaign_id,
              JSON_EXTRACT_SCALAR(data, "$.marketing_campaign_name") AS marketing_campaign_name,
              JSON_EXTRACT_SCALAR(data, "$.marketing_campaign_version") AS marketing_campaign_version,
              JSON_EXTRACT_SCALAR(data, "$.marketing_campaign_split_id") AS marketing_campaign_split_id,
              CAST(
                JSON_EXTRACT_SCALAR(data, "$.sg_user_id AS") AS INT64
              ) AS sg_user_id,
              publish_time,
              pt,
              JSON_EXTRACT_SCALAR(data, "$.purpose") AS purpose
            FROM
              raw_events
          )
      )
    WHERE
      row_num = 1
  )
SELECT
  *
FROM
  events
WHERE
  DATE(timestamp) = CURRENT_DATE()