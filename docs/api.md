# API 仕様

Base URL: `https://<worker-name>.<account>.workers.dev`

---

## Public API

### GET /search — 次の発車時刻を取得

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `busStopId` | number | ✅ | バス停 ID |

**レスポンス 200**

```json
{
  "busStopId": 1,
  "busStopName": "〇〇駅前",
  "nextDeparture": {
    "hour": 14,
    "minute": 35,
    "formatted": "14:35"
  }
}
```

本日の残りのバスがない場合:
```json
{
  "busStopId": 1,
  "message": "本日の残りのバスはありません"
}
```

**レスポンス 400**

```json
{ "error": "busStopId is required" }
{ "error": "busStopId must be a number" }
```

**備考**
- 現在時刻は JST で評価する
- 曜日は JST 基準で weekday / saturday / holiday を自動判定（日曜 → holiday）
- `hour` が 24 以上の場合、`formatted` は `"00:05(翌日)"` のように表示

---

## Admin API

すべてのエンドポイントに `Authorization: Bearer <ADMIN_API_TOKEN>` ヘッダーが必要。

### GET /admin/api/bus-stops — バス停一覧

**レスポンス 200**

```json
[
  { "id": 1, "name": "〇〇駅前", "createdAt": "2025-01-01 00:00:00" },
  { "id": 2, "name": "△△公園", "createdAt": "2025-01-01 00:00:00" }
]
```

---

### POST /admin/api/bus-stops — バス停を追加

**リクエストボディ**

```json
{ "name": "〇〇駅前" }
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| `name` | string | ✅ | 1〜100 文字 |

**レスポンス 201**

```json
{ "id": 1, "name": "〇〇駅前", "createdAt": "2025-01-01 00:00:00" }
```

---

### DELETE /admin/api/bus-stops/:id — バス停を削除

バス停に紐づく時刻表エントリもすべて削除される（カスケード削除）。

**レスポンス 204** (No Content)

---

### GET /admin/api/timetable/:busStopId — 時刻表を取得

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `dayType` | string | - | `weekday` / `saturday` / `holiday`（省略時は全区分） |

**レスポンス 200**

```json
[
  { "id": 1, "busStopId": 1, "dayType": "weekday", "hour": 6, "minute": 30, "createdAt": "..." },
  { "id": 2, "busStopId": 1, "dayType": "weekday", "hour": 7, "minute": 0,  "createdAt": "..." }
]
```

---

### POST /admin/api/timetable — 時刻を追加

**リクエストボディ**

```json
{
  "busStopId": 1,
  "dayType": "weekday",
  "hour": 6,
  "minute": 30
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| `busStopId` | number | ✅ | 正の整数 |
| `dayType` | string | ✅ | `weekday` / `saturday` / `holiday` |
| `hour` | number | ✅ | 0〜30（終電が日付をまたぐ場合 24 以上使用） |
| `minute` | number | ✅ | 0〜59 |

**レスポンス 201**

```json
{ "id": 10, "busStopId": 1, "dayType": "weekday", "hour": 6, "minute": 30, "createdAt": "..." }
```

---

### DELETE /admin/api/timetable/:id — 時刻を削除

**レスポンス 204** (No Content)

---

## LINE Webhook

### POST /line

LINE プラットフォームからのイベントを受信する。

**リクエストヘッダー**

| ヘッダー | 説明 |
|---------|------|
| `x-line-signature` | HMAC-SHA256 署名（Base64）|

署名検証は Web Crypto API (`crypto.subtle`) で行う。検証失敗時は 401 を返す。

**対応イベント**

- `message` イベント（type: `text`）のみ処理する

**メッセージ解析ルール**

| 入力例 | 解釈 |
|--------|------|
| `1`, `１`, `一` | バス停 ID = 1 |
| `2`, `２`, `二` | バス停 ID = 2 |
| `1番`, `バス停1` | バス停 ID = 1 |
| 数字文字列 | その数値を ID として使用 |
| 上記以外 | バス停一覧を返信 |

**レスポンス 200** `OK`（LINE の仕様上、常に 200 を返す）

---

## Alexa スキル

### POST /alexa

Alexa Skills Kit からのリクエストを処理する。

**対応 IntentRequest**

| Intent | 動作 |
|--------|------|
| `GetNextBusIntent` | スロット `BusStop`（数値）のバス停の次の発車時刻を返す |
| `AMAZON.HelpIntent` | 使い方を案内 |
| `AMAZON.StopIntent` / `AMAZON.CancelIntent` | セッション終了 |

`LaunchRequest` 時はバス停番号の入力を促す。

`ALEXA_APP_ID` が設定されている場合、リクエストのアプリケーション ID を検証する。

**レスポンス形式**

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": { "type": "PlainText", "text": "..." },
    "shouldEndSession": true
  }
}
```
