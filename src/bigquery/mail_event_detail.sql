-- mail_event_detail
CREATE TEMP FUNCTION config() RETURNS STRUCT < time_zone STRING,
pediod_days INT64 > LANGUAGE js AS 'return { "time_zone": "Asia/Tokyo", "pediod_days": 7 };';

/*
 * getTableSuffix sub_daysで指定した日数前の指定timezoneの00:00:00時点の tableSuffixの文字列を返す
 */
CREATE TEMP FUNCTION getTableSuffix (sub_days INT64) RETURNS STRING AS (
  FORMAT_DATE (
    "%Y%m%d",
    DATE (
      DATE_SUB (
        TIMESTAMP(
          DATETIME_TRUNC (CURRENT_DATETIME (config().time_zone), DAY),
          config().time_zone
        ),
        INTERVAL sub_days DAY
      )
    )
  )
);

WITH mail_events_daily AS (
  SELECT
    *,
    DATE (timestamp, "Asia/Tokyo") as date,
  FROM
    `sendgrid.mail_events_daily_*`
  WHERE
    _TABLE_SUFFIX BETWEEN getTableSuffix(7 * 4 * 12) -- 全体の集計期間の最初の日
    AND getTableSuffix(0) -- 前日までの集計
),
-- marketing_campain_events 
-- marketing_campaign_idごとに、イベント数をカウント
marketing_campain_events AS (
  SELECT
    MIN(date) as issue_date,
    marketing_campaign_id,
    marketing_campaign_name,
    event,
    count(*) as count
  FROM
    mail_events_daily
  WHERE
    marketing_campaign_name IS NOT NULL
  GROUP BY
    marketing_campaign_id,
    marketing_campaign_name,
    event
),
-- marketing_campains 
-- marketing_campain_eventsをPIVOTして、marketing_campaign_idごとに1行のテーブルにする
marketing_campains AS (
  SELECT
    issue_date,
    DATE_ADD(issue_date, INTERVAL config().pediod_days DAY) AS pediod_date,
    marketing_campaign_id,
    marketing_campaign_name,
    IF(processed IS NULL, 0, processed) AS processed,
    IF(delivered IS NULL, 0, delivered) AS delivered,
    IF(deferred IS NULL, 0, deferred) AS deferred,
    IF(dropped IS NULL, 0, dropped) AS dropped,
    IF(bounce IS NULL, 0, bounce) AS bounce,
    IF(dropped IS NULL, delivered, delivered - dropped) AS received
  FROM
    (
      SELECT
        *
      FROM
        marketing_campain_events PIVOT(
          SUM(count) FOR event IN (
            "processed",
            "delivered",
            "deferred",
            "dropped",
            "bounce",
            "spamreport",
            "unsubscribe",
            "group_unsubscribe",
            "group_resubscribe"
          )
        )
      WHERE
        processed IS NOT NULL
    )
),
-- events_by_emails
-- emailアドレスごとに、open, clickを集計するための準備. clickしたURLのpathも切り出しておく
-- 発行日からpediod_daysまでの期間を集計対象とする
events_by_emails AS (
  SELECT
    me.marketing_campaign_id,
    me.marketing_campaign_name,
    mc.issue_date,
    email,
    DATE_DIFF(date, mc.issue_date, DAY) days,
    date,
    timestamp,
    event,
    url,
    SPLIT(url, "?") [OFFSET(0)] url_path,
    SPLIT(url, "?") [SAFE_OFFSET(1)] url_query,
  FROM
    mail_events_daily me
    JOIN marketing_campains as mc ON me.marketing_campaign_id = mc.marketing_campaign_id
  WHERE
    event in ("open", "click")
    AND DATE_DIFF(date, mc.issue_date, DAY) <= config().pediod_days
),
-- event_summary
-- emailを開いた(OPEN)数,クリック(click)を総数とユニークユーザーで集計
event_summary AS (
  SELECT
    marketing_campaign_id,
    event,
    COUNT(*) count,
    COUNT(DISTINCT email) uu
  FROM
    events_by_emails
  GROUP BY
    marketing_campaign_id,
    event
),
marketing_campains_summary AS (
  SELECT
    m.*,
    o.count AS open_count,
    c.count AS click_count,
    o.uu AS open_uu,
    c.uu AS click_uu,
  FROM
    marketing_campains m
    LEFT JOIN event_summary o ON m.marketing_campaign_id = o.marketing_campaign_id
    AND o.event = "open"
    LEFT JOIN event_summary c ON m.marketing_campaign_id = c.marketing_campaign_id
    AND c.event = "click"
),
daily_count AS (
  SELECT
    marketing_campaign_id,
    event,
    date,
    days,
    COUNT(*) AS count,
    COUNT(DISTINCT email) AS uu,
  FROM
    events_by_emails
  GROUP BY
    marketing_campaign_id,
    date,
    days,
    event
),
-- daily_count_total
-- 日毎のカウント数とUU、および累積カウント数とUUの一覧
daily_count_total AS (
  SELECT
    marketing_campaign_id,
    event,
    "" AS url_path,
    "" AS url_query,
    date,
    days,
    count,
    uu,
    (
      SELECT
        count(*)
      FROM
        events_by_emails b
      WHERE
        b.date <= a.date
        AND b.marketing_campaign_id = a.marketing_campaign_id
        AND b.event = a.event
    ) AS total_count,
    (
      SELECT
        count(distinct email)
      FROM
        events_by_emails b
      WHERE
        b.date <= a.date
        AND b.marketing_campaign_id = a.marketing_campaign_id
        AND b.event = a.event
    ) AS total_uu
  FROM
    daily_count a
),
daily_click_count AS (
  SELECT
    marketing_campaign_id,
    event,
    date,
    days,
    url_path,
    MIN(url_query) AS url_query,
    COUNT(*) AS count,
    COUNT(DISTINCT email) AS uu,
  FROM
    events_by_emails
  WHERE
    event = "click"
  GROUP BY
    marketing_campaign_id,
    date,
    days,
    event,
    url_path
),
daily_click_url_count_total AS (
  SELECT
    marketing_campaign_id,
    "click_detail" AS event,
    url_path,
    url_query,
    date,
    days,
    count,
    uu,
    (
      SELECT
        count(*)
      FROM
        events_by_emails b
      WHERE
        b.date <= a.date
        AND b.marketing_campaign_id = a.marketing_campaign_id
        AND b.event = a.event
        AND (
          b.url_path = a.url_path
          OR (
            b.url_path IS NULL
            AND a.url_path IS NULL
          )
        )
    ) AS total_count,
    (
      SELECT
        count(distinct email)
      FROM
        events_by_emails b
      WHERE
        b.date <= a.date
        AND b.marketing_campaign_id = a.marketing_campaign_id
        AND b.event = a.event
        AND (
          b.url_path = a.url_path
          OR (
            b.url_path IS NULL
            AND a.url_path IS NULL
          )
        )
    ) AS total_uu
  FROM
    daily_click_count a
  WHERE
    event = "click"
),
daily_count_total_union AS (
  SELECT
    *
  FROM
    daily_count_total
  UNION
  ALL
  SELECT
    *
  FROM
    daily_click_url_count_total
) -- **
-- キャンペーンごとのサマリー
-- **
SELECT
  mcs.issue_date,
  mcs.marketing_campaign_id,
  mcs.marketing_campaign_name,
  t.*
EXCEPT
  (marketing_campaign_id)
FROM
  daily_count_total_union t
  JOIN marketing_campains_summary mcs ON t.marketing_campaign_id = mcs.marketing_campaign_id
ORDER BY
  issue_date,
  marketing_campaign_name,
  event DESC,
  url_path,
  date