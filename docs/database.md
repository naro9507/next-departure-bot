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

---

## 設計の補足

### hour が 24 以上の値

終夜バスなど日付をまたぐ発車時刻を扱うために `hour` の上限を 30 としている。
例: 翌日 0:38 発 → `hour: 24, minute: 38`

表示時は `hour % 24` を使い、24 以上の場合は `(翌日)` を付加する（`src/utils/time.ts` の `formatTime` 関数）。

### day_type の判定

`src/utils/time.ts` の `getJSTTime()` で JST の曜日を判定する。

| JST の曜日 | day_type |
|-----------|----------|
| 月〜金 | `weekday` |
| 土曜日 | `saturday` |
| 日曜日 | `holiday` |

祝日は現在 `holiday` として別途管理していない。必要であれば祝日判定ロジックを `getJSTTime()` に追加する。

### バス停削除時のカスケード

`DELETE /admin/api/bus-stops/:id` では、対象バス停に紐づく `timetable` レコードを先に削除してから `bus_stops` を削除する（SQLite は外部キー制約のカスケード削除がデフォルト無効のため、アプリ側で制御）。

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
