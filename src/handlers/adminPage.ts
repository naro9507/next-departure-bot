export function renderAdminPage(): Response {
	const html = /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>バス時刻表 管理画面</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #333; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #1a1a1a; }
    h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: #333; }
    h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem; }

    /* Login */
    .login-card { background: #fff; border-radius: 10px; padding: 2rem; max-width: 400px; margin: 4rem auto; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .login-card h1 { text-align: center; margin-bottom: 1.5rem; }
    input[type="password"], input[type="text"], input[type="number"], select {
      width: 100%; padding: .6rem .8rem; border: 1px solid #ddd; border-radius: 6px;
      font-size: .9rem; background: #fff;
    }
    input:focus, select:focus { outline: 2px solid #3b82f6; border-color: transparent; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: .3rem; padding: .5rem 1rem;
      border: none; border-radius: 6px; font-size: .85rem; font-weight: 500;
      cursor: pointer; transition: opacity .15s; }
    .btn:hover { opacity: .85; }
    .btn:disabled { opacity: .4; cursor: not-allowed; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-danger  { background: #ef4444; color: #fff; }
    .btn-ghost   { background: transparent; color: #555; border: 1px solid #ddd; }

    /* Layout */
    .grid-2 { display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem; }
    .card { background: #fff; border-radius: 10px; padding: 1.25rem; box-shadow: 0 1px 6px rgba(0,0,0,.06); }

    /* Bus stop list */
    .stop-item { display: flex; align-items: center; justify-content: space-between;
      padding: .6rem .75rem; border-radius: 6px; cursor: pointer; transition: background .12s; }
    .stop-item:hover { background: #f0f6ff; }
    .stop-item.active { background: #dbeafe; font-weight: 600; color: #1d4ed8; }
    .stop-name { flex: 1; font-size: .9rem; }
    .stop-id { font-size: .75rem; color: #999; margin-right: .5rem; }

    /* Timetable */
    .day-tabs { display: flex; gap: .5rem; margin-bottom: 1rem; }
    .day-tab { padding: .4rem .9rem; border-radius: 20px; font-size: .8rem; font-weight: 500;
      cursor: pointer; border: 1.5px solid #ddd; background: #fff; transition: all .15s; }
    .day-tab.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .time-grid { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
    .time-chip { display: flex; align-items: center; gap: .3rem; padding: .35rem .6rem;
      background: #f0f6ff; border-radius: 20px; font-size: .85rem; font-weight: 500; color: #1d4ed8; }
    .time-chip button { background: none; border: none; cursor: pointer; color: #999;
      font-size: .85rem; line-height: 1; padding: 0; transition: color .12s; }
    .time-chip button:hover { color: #ef4444; }
    .add-time-form { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .time-input-group { display: flex; align-items: center; gap: .4rem; }
    .time-input-group label { font-size: .8rem; color: #666; white-space: nowrap; }
    .time-input-group input { width: 65px; }

    /* Messages */
    .msg-error { padding: .6rem .9rem; background: #fee2e2; color: #b91c1c; border-radius: 6px;
      font-size: .85rem; margin-bottom: .75rem; }
    .msg-ok { padding: .6rem .9rem; background: #dcfce7; color: #166534; border-radius: 6px;
      font-size: .85rem; margin-bottom: .75rem; }

    /* Misc */
    .mt-1 { margin-top: .5rem; }
    .mt-2 { margin-top: 1rem; }
    .empty { color: #aaa; font-size: .85rem; }
    .sep { height: 1px; background: #eee; margin: .75rem 0; }
  </style>
</head>
<body>
<div x-data="app()" x-init="init()">

  <!-- LOGIN -->
  <template x-if="!token">
    <div class="container">
      <div class="login-card">
        <h1>🚌 管理画面</h1>
        <p style="font-size:.85rem;color:#666;margin-bottom:1.25rem;text-align:center">
          管理トークンを入力してください
        </p>
        <input type="password" x-model="tokenInput" placeholder="Bearer Token"
               @keydown.enter="login()" />
        <div x-show="loginError" class="msg-error mt-1" x-text="loginError"></div>
        <button class="btn btn-primary mt-2" style="width:100%" @click="login()">ログイン</button>
      </div>
    </div>
  </template>

  <!-- MAIN -->
  <template x-if="token">
    <div class="container">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <h1>🚌 バス時刻表 管理画面</h1>
        <button class="btn btn-ghost" @click="logout()">ログアウト</button>
      </div>

      <div class="grid-2">

        <!-- LEFT: Bus stops -->
        <div>
          <div class="card">
            <h2>バス停</h2>
            <template x-for="stop in busStops" :key="stop.id">
              <div class="stop-item" :class="{ active: selectedStop?.id === stop.id }"
                   @click="selectStop(stop)">
                <span class="stop-id" x-text="'#' + stop.id"></span>
                <span class="stop-name" x-text="stop.name"></span>
                <button class="btn btn-danger" style="padding:.25rem .5rem;font-size:.75rem"
                        @click.stop="deleteBusStop(stop.id)">削除</button>
              </div>
            </template>
            <p x-show="busStops.length === 0" class="empty mt-1">バス停がありません</p>

            <div class="sep"></div>
            <h3>バス停を追加</h3>
            <div style="display:flex;gap:.5rem">
              <input type="text" x-model="newStopName" placeholder="バス停名" @keydown.enter="addBusStop()" />
              <button class="btn btn-primary" @click="addBusStop()" :disabled="!newStopName.trim()">追加</button>
            </div>
            <div x-show="stopError" class="msg-error mt-1" x-text="stopError"></div>
          </div>
        </div>

        <!-- RIGHT: Timetable -->
        <div>
          <div class="card" x-show="!selectedStop">
            <p class="empty">左からバス停を選択してください</p>
          </div>

          <div class="card" x-show="selectedStop">
            <h2 x-text="selectedStop?.name + ' の時刻表'"></h2>

            <!-- Day tabs -->
            <div class="day-tabs">
              <template x-for="d in dayTypes" :key="d.value">
                <button class="day-tab" :class="{ active: currentDay === d.value }"
                        @click="currentDay = d.value; loadTimetable()" x-text="d.label"></button>
              </template>
            </div>

            <!-- Time chips -->
            <div x-show="timetable.length > 0" class="time-grid">
              <template x-for="entry in timetable" :key="entry.id">
                <div class="time-chip">
                  <span x-text="pad(entry.hour) + ':' + pad(entry.minute)"></span>
                  <button @click="deleteTime(entry.id)" title="削除">×</button>
                </div>
              </template>
            </div>
            <p x-show="timetable.length === 0" class="empty">この区分の時刻はありません</p>

            <!-- Add time form -->
            <div class="sep"></div>
            <h3>時刻を追加</h3>
            <div class="add-time-form">
              <div class="time-input-group">
                <label>時</label>
                <input type="number" x-model.number="newHour" min="0" max="30" placeholder="6" />
              </div>
              <div class="time-input-group">
                <label>分</label>
                <input type="number" x-model.number="newMinute" min="0" max="59" placeholder="30" />
              </div>
              <button class="btn btn-primary" @click="addTime()">追加</button>
            </div>
            <div x-show="timeError" class="msg-error mt-1" x-text="timeError"></div>
          </div>
        </div>

      </div>
    </div>
  </template>

</div>

<script>
function app() {
  return {
    token: localStorage.getItem('admin_token') || '',
    tokenInput: '',
    loginError: '',

    busStops: [],
    selectedStop: null,
    newStopName: '',
    stopError: '',

    dayTypes: [
      { value: 'weekday',  label: '平日' },
      { value: 'saturday', label: '土曜' },
      { value: 'holiday',  label: '休日' },
    ],
    currentDay: 'weekday',
    timetable: [],
    newHour: '',
    newMinute: '',
    timeError: '',

    async init() {
      if (this.token) await this.loadBusStops();
    },

    login() {
      if (!this.tokenInput.trim()) { this.loginError = 'トークンを入力してください'; return; }
      this.token = this.tokenInput.trim();
      localStorage.setItem('admin_token', this.token);
      this.loginError = '';
      this.loadBusStops();
    },
    logout() {
      this.token = '';
      localStorage.removeItem('admin_token');
      this.busStops = [];
      this.selectedStop = null;
      this.timetable = [];
    },

    headers() {
      return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token };
    },

    async api(method, path, body) {
      const res = await fetch(path, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) { this.logout(); return null; }
      if (res.status === 204) return {};
      return res.json();
    },

    async loadBusStops() {
      const data = await this.api('GET', '/admin/api/bus-stops');
      if (data) this.busStops = data;
    },

    async addBusStop() {
      this.stopError = '';
      const name = this.newStopName.trim();
      if (!name) return;
      const res = await this.api('POST', '/admin/api/bus-stops', { name });
      if (res?.id) {
        this.busStops.push(res);
        this.newStopName = '';
      } else {
        this.stopError = '追加に失敗しました';
      }
    },

    async deleteBusStop(id) {
      if (!confirm('このバス停とその時刻表をすべて削除しますか？')) return;
      await this.api('DELETE', '/admin/api/bus-stops/' + id);
      this.busStops = this.busStops.filter(s => s.id !== id);
      if (this.selectedStop?.id === id) { this.selectedStop = null; this.timetable = []; }
    },

    selectStop(stop) {
      this.selectedStop = stop;
      this.currentDay = 'weekday';
      this.loadTimetable();
    },

    async loadTimetable() {
      if (!this.selectedStop) return;
      const data = await this.api('GET', '/admin/api/timetable/' + this.selectedStop.id + '?dayType=' + this.currentDay);
      if (data) {
        this.timetable = (data).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      }
    },

    async addTime() {
      this.timeError = '';
      const h = this.newHour, m = this.newMinute;
      if (h === '' || m === '') { this.timeError = '時・分を入力してください'; return; }
      if (h < 0 || h > 30 || m < 0 || m > 59) { this.timeError = '時:0〜30、分:0〜59 の範囲で入力してください'; return; }
      const res = await this.api('POST', '/admin/api/timetable', {
        busStopId: this.selectedStop.id,
        dayType: this.currentDay,
        hour: h,
        minute: m,
      });
      if (res?.id) {
        this.timetable.push(res);
        this.timetable.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
        this.newHour = ''; this.newMinute = '';
      } else {
        this.timeError = '追加に失敗しました';
      }
    },

    async deleteTime(id) {
      await this.api('DELETE', '/admin/api/timetable/' + id);
      this.timetable = this.timetable.filter(t => t.id !== id);
    },

    pad(n) { return String(n).padStart(2, '0'); },
  };
}
</script>
</body>
</html>`;

	return new Response(html, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}
