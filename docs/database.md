# データベース仕様

DB エンジン: Turso (libSQL / SQLite 互換)
ORM: Drizzle ORM
クライアント: `@libsql/client/web`（Cloudflare Workers 対応版）

---

## テーブル定義

### bus_stops

バス停マスタ。管理画面から自由に追加・削除できる。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | バス停 ID |
| `name` | TEXT | NOT NULL | バス停名（1〜100 文字） |
| `created_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` | 作成日時（UTC） |

### timetable

バス停ごと・曜日区分ごとの発車時刻。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 時刻 ID |
| `bus_stop_id` | INTEGER | NOT NULL, REFERENCES bus_stops(id) | バス停 ID |
| `day_type` | TEXT | NOT NULL, CHECK(weekday\|saturday\|holiday) | 曜日区分 |
| `hour` | INTEGER | NOT NULL | 時（0〜30） |
| `minute` | INTEGER | NOT NULL | 分（0〜59） |
| `created_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` | 作成日時（UTC） |

### passkey_credentials

管理画面ログイン用のパスキー（WebAuthn クレデンシャル）。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| `id` | TEXT | PRIMARY KEY | クレデンシャル ID（base64url） |
| `public_key` | TEXT | NOT NULL | COSE 公開鍵（base64url） |
| `counter` | INTEGER | NOT NULL, DEFAULT 0 | 署名カウンタ（リプレイ検出用） |
| `created_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` | 作成日時（UTC） |

---

## 設計の補足

### hour が 24 以上の値

終夜バスなど日付をまたぐ発車時刻を扱うために `hour` の上限を 30 としている。
例: 翌日 0:38 発 → `hour: 24, minute: 38`

表示時は `hour % 24` を使い、24 以上の場合は `(翌日)` を付加する（`src/utils/time.ts` の `formatTime` 関数）。

### 日付をまたぐ便の検索

`getNextDeparture()`（`src/repository/timeTable.ts`）は 2 つの候補を並列に検索し、早い方を返す。

1. 今日の `day_type` で、現在時刻より後の便
2. 前日の `day_type` で、`hour * 60 + minute > 現在分 + 1440` の便（＝前日ダイヤの 24 時以降の便）

2 の便は今日の時刻（`hour - 24`）に直して返す。比較は純粋関数 `pickNextDeparture()` で行う。

### day_type の判定

`src/utils/time.ts` の `getJSTTime()` で JST の曜日を判定する。前日の区分（`previousDayType`）も同時に返す。

| JST の日付 | day_type |
|-----------|----------|
| 日曜日・祝日 | `holiday` |
| 土曜日（祝日でない） | `saturday` |
| 月〜金（祝日でない） | `weekday` |

祝日判定は `src/utils/holiday.ts` の `isJapaneseHoliday()`（外部 API 不要の計算式）。

- 国民の祝日（2022 年以降の法律に準拠。春分・秋分は 1980〜2099 年の近似式）
- 振替休日（日曜の祝日以降、最初の祝日でない日）
- 国民の休日（祝日に挟まれた日。例: 2026-09-22）
- 年末年始（12/29〜1/3）や臨時ダイヤは対象外

### バス停削除時のカスケード

`DELETE /admin/api/bus-stops/:id` では、`deleteBusStop()` が `timetable` → `bus_stops` の順に削除する。2 つの DELETE は `db.batch()` で 1 トランザクションとして実行する（SQLite は外部キー制約のカスケード削除がデフォルト無効のため、アプリ側で制御）。

---

## Drizzle スキーマ

`src/db/schema.ts` に定義。

```ts
export const busStops = sqliteTable("bus_stops", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  name:      text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const timetable = sqliteTable("timetable", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  busStopId: integer("bus_stop_id").notNull().references(() => busStops.id),
  dayType:   text("day_type", { enum: ["weekday", "saturday", "holiday"] }).notNull(),
  hour:      integer("hour").notNull(),
  minute:    integer("minute").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
```

---

## マイグレーション

```bash
# スキーマを直接 Turso に適用（開発・本番共通）
bun run db:push

# マイグレーションファイルを生成（バージョン管理したい場合）
bun run db:generate
```
