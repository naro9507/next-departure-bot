# 管理画面仕様

URL: `GET /admin`

Alpine.js を使ったシングルページアプリ。HTML は `src/handlers/adminPage.ts` に文字列として埋め込まれており、Cloudflare Workers から直接配信する（ビルドステップなし）。

---

## アクセス制御

2 段階の保護を行う。

| レイヤー | 方法 | 設定場所 |
|---------|------|---------|
| IP 制限 | Cloudflare WAF カスタムルール | `terraform/waf.tf` の `admin_allowed_ips` |
| 認証 | Bearer Token（ブラウザの localStorage に保存） | `ADMIN_API_TOKEN` シークレット |

IP 制限はコード側では実装しない。WAF がブロックするため Workers まで到達しない。

---

## 画面構成

### ログイン画面

- `ADMIN_API_TOKEN` の値を入力するフォーム
- 入力値は `localStorage` の `admin_token` キーに保存
- Enter キーまたはボタンでログイン
- 認証失敗（401）時はエラーメッセージを表示

### メイン画面（ログイン後）

2 カラムレイアウト。

#### 左カラム — バス停管理

- バス停一覧（ID + 名前）
- バス停をクリックすると右カラムに時刻表を表示（選択中は青くハイライト）
- 「削除」ボタン: 確認ダイアログ後、バス停と紐づく時刻表をすべて削除
- バス停追加フォーム（名前入力 + 追加ボタン）

#### 右カラム — 時刻表管理

- バス停未選択時: 「左からバス停を選択してください」を表示
- バス停選択時:
  - 平日 / 土曜 / 休日 のタブ切り替え
  - 選択中の曜日区分の時刻を `HH:MM` 形式のチップで表示
  - チップの × ボタンで時刻を削除（確認なし）
  - 時刻追加フォーム（時・分の入力 + 追加ボタン）
    - `hour`: 0〜30、`minute`: 0〜59 のバリデーション

---

## API 通信

フロントエンド（Alpine.js）から `/admin/api/*` への fetch で通信する。
すべてのリクエストに `Authorization: Bearer <token>` ヘッダーを付与する。

401 レスポンスを受け取った場合は自動でログアウト（localStorage のトークンを削除）。

---

## Alpine.js データモデル

```js
{
  token: string,          // ログイントークン (localStorage)
  busStops: BusStop[],    // バス停一覧
  selectedStop: BusStop | null,
  currentDay: 'weekday' | 'saturday' | 'holiday',
  timetable: Timetable[], // 選択中バス停の時刻表
  newStopName: string,
  newHour: number | '',
  newMinute: number | '',
}
```
