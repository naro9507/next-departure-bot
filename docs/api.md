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
  "busStopName": "〇〇駅前",
  "message": "本日の残りのバスはありません"
}
```

**レスポンス 400**

```json
{ "error": "busStopId is required" }
{ "error": "busStopId must be a number" }
```

**レスポンス 404**（バス停が存在しない）

```json
{ "error": "bus stop not found" }
```

**備考**
- 現在時刻は JST で評価する
- 曜日は JST 基準で weekday / saturday / holiday を自動判定（日曜・祝日・振替休日・国民の休日 → holiday）
- `hour` が 24 以上の場合、`formatted` は `"00:05(翌日)"` のように表示
- 日付をまたいだ直後（例: 0:10）は、前日ダイヤの 24 時以降の便（例: 24:30）も候補に含める。
  この場合は今日の時刻に直して返す（`hour: 0, minute: 30, formatted: "00:30"`）

---

## Admin API

すべてのエンドポイントにパスキーログインで発行された `admin_session` Cookie が必要（無効なら 401）。
認証フローは `/admin/api/auth/*` を参照（[admin.md](./admin.md)）。

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

バス停に紐づく時刻表エントリもすべて削除される（`db.batch` で 1 トランザクションとして実行）。

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

### POST /admin/api/timetable/bulk — 時刻をまとめて登録

貼り付けたテキストから時刻を読み取り、まとめて登録する（`src/utils/parseTimes.ts`）。
**解釈できない箇所が 1 つでもあれば何も登録しない。**

**リクエストボディ**

```json
{
  "busStopId": 1,
  "dayType": "weekday",
  "text": "6: 05 25 45\n7: 00 30\n24:10",
  "replace": false
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `busStopId` | number | ✅ | 正の整数 |
| `dayType` | string | ✅ | `weekday` / `saturday` / `holiday` |
| `text` | string | ✅ | 1〜20000 文字。時刻は 500 件まで |
| `replace` | boolean | - | `true` ならそのバス停・区分の既存の時刻を削除してから登録（1 トランザクション）。既定は `false`（登録済みの時刻はスキップ） |

**`text` の書き方**（全角・`6時30分` も可。行ごとに形式を変えてもよい）

| 形式 | 例 |
|------|-----|
| 時刻を並べる（空白・カンマ・改行区切り） | `6:30, 6:45 7:00` |
| 時刻表の行形式（時の後に区切り + 空白、続けて分） | `6: 05 25 45` / `6 \| 05 25` / `6時 05 25` |

重複は除いて登録する。

**レスポンス 201**

```json
{ "added": 7, "skipped": 1, "deleted": 0 }
```

**レスポンス 400**

```json
{ "error": "解釈できない時刻があります", "details": ["2行目: abc", "3行目: 7:75"] }
```

バス停が存在しない場合は 404。

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

署名検証は Web Crypto API (`crypto.subtle.verify`) で行う（定数時間比較）。検証失敗時は 401 を返す。

**対応イベント**

- `message` イベント（type: `text`）のみ処理する

**メッセージ解析ルール**（`src/utils/parseBusStopId.ts`）

入力は NFKC 正規化（全角 → 半角）し、漢数字（〜九百九十九）を算用数字に変換してから解釈する。

| 入力例 | 解釈 |
|--------|------|
| `3`, `３`, `三`, `十二` | その数値をバス停 ID とする |
| `3番`, `5番のバス` | 先頭の「N番」 |
| `バス停3`, `バス停 十` | 「バス停N」 |
| 上記以外（`一覧` など） | バス停一覧を返信 |

**返信内容**

| 状況 | 返信 |
|------|------|
| 次のバスあり | `〇〇駅前の次のバス: 14:35発` |
| 本日の残りなし | `〇〇駅前の本日の残りのバスはありません` |
| バス停が存在しない | `N番のバス停は見つかりませんでした…` |

イベントごとに処理し、DB や返信 API のエラー（通信エラー含む）は `console.error` でログに残して次のイベントへ進む（1 件の失敗で 500 にしない）。

**レスポンス 200** `OK`（LINE の仕様上、常に 200 を返す）

---

## Alexa スキル

### POST /alexa

Alexa Skills Kit からのリクエストを処理する。

**リクエスト検証**

| 検証 | 失敗時 |
|------|-------|
| JSON として解析でき `request.type` がある | 400 |
| `ALEXA_APP_ID` 設定時、`context.System.application.applicationId`（なければ `session.application.applicationId`）が一致 | 403 |
| `request.timestamp` が現在時刻 ±150 秒以内 | 400 |

> ⚠️ Alexa の署名検証（`SignatureCertChainUrl` / `Signature-256`）は未実装。Lambda 以外でホストするスキルを公開審査に出す場合は必須。

**対応リクエスト**

| 種別 | 動作 |
|------|------|
| `LaunchRequest` | バス停番号を尋ねる（セッション継続 + reprompt） |
| `IntentRequest` / `GetNextBusIntent` | スロット `BusStop`（数値）のバス停の次の発車時刻を返す |
| `IntentRequest` / `AMAZON.HelpIntent`, `AMAZON.FallbackIntent` | 使い方を案内（セッション継続） |
| `IntentRequest` / `AMAZON.StopIntent`, `AMAZON.CancelIntent` | セッション終了 |
| `SessionEndedRequest` | 空の `response` を返す（音声なし） |

`GetNextBusIntent` で番号が取れない・バス停が存在しない場合は聞き返す（セッション継続）。

**読み上げ形式**（`formatTimeForSpeech`）

| 時刻 | 読み上げ |
|------|---------|
| 7:00 | 7時 |
| 14:35 | 14時35分 |
| 24:38 | 深夜0時38分 |

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
