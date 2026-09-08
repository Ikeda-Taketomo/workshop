# ポモドーロタイマー Web アプリケーション アーキテクチャ案

## 目的

このドキュメントは、Go の `net/http` と HTML/CSS/JavaScript を使用してポモドーロタイマー Web アプリケーションを実装するためのアーキテクチャ案をまとめたものです。

本アプリケーションでは、Go 側を静的ファイルと HTML を配信する薄い Web サーバーとして扱い、タイマーのリアルタイム制御や画面操作はブラウザ側の JavaScript が担当します。

## 基本方針

- Go の標準ライブラリである `net/http` を使用する
- 初期実装では外部 Web フレームワークを導入しない
- サーバー側は HTML/CSS/JavaScript の配信に集中する
- タイマー計算、状態遷移、画面更新は JavaScript 側で行う
- ユーザー設定や簡単な統計情報は `localStorage` に保存する
- 履歴の永続化や複数端末同期が必要になった段階で API と保存層を追加する

## 推奨ディレクトリ構成

初期実装では、次のような構成を推奨します。

```text
pomodoro/
  go.mod
  main.go
  internal/
    server/
      server.go
      routes.go
      routes_test.go
  web/
    index.html
    static/
      css/
        style.css
      js/
        timer.js
        storage.js
        app.js
        timer.test.js
      assets/
```

小さく始める場合は、まず次の最小構成でも問題ありません。

```text
pomodoro/
  go.mod
  main.go
  web/
    index.html
    static/
      css/
        style.css
      js/
        timer.js
        storage.js
        app.js
```

アプリケーションが大きくなった段階で、`internal/server` に HTTP ハンドラを切り出します。

## 各層の責務

| 層 | 主な責務 |
| --- | --- |
| `main.go` | サーバー起動、ポート設定、HTTP ハンドラの初期化 |
| `internal/server` | ルーティング、静的ファイル配信、ヘルスチェック、将来的な API ハンドラ |
| `web/index.html` | UI の構造、ボタンや表示領域などの HTML |
| `web/static/css/style.css` | レイアウト、色、余白、レスポンシブ対応、状態ごとの見た目 |
| `web/static/js/timer.js` | タイマー計算、状態遷移、モード切り替えなどの純粋なロジック |
| `web/static/js/storage.js` | `localStorage` を使った設定や統計情報の保存・読み込み |
| `web/static/js/app.js` | DOM 操作、イベント購読、画面更新、`timer.js` と `storage.js` の接続 |

## HTTP ルーティング

初期実装では、次のエンドポイントを用意します。

| メソッド | パス | 用途 |
| --- | --- | --- |
| `GET` | `/` | アプリケーションの HTML を返す |
| `GET` | `/static/...` | CSS、JavaScript、画像などの静的ファイルを返す |
| `GET` | `/healthz` | 動作確認用のヘルスチェック |

将来的にサーバー側で設定や履歴を保存する場合は、次のような API を追加できます。

| メソッド | パス | 用途 |
| --- | --- | --- |
| `GET` | `/api/settings` | 設定の取得 |
| `PUT` | `/api/settings` | 設定の保存 |
| `GET` | `/api/sessions` | セッション履歴の取得 |
| `POST` | `/api/sessions` | 完了したセッションの記録 |

ただし、初期段階では API を増やしすぎず、ブラウザ内で完結する設計にします。

## タイマー制御の設計

タイマーはサーバーではなくブラウザ側で制御します。秒単位の表示更新をサーバーに問い合わせる設計にすると、通信が増え、実装も複雑になります。

タイマーの残り時間は `setInterval` の実行回数で減らすのではなく、開始時刻と現在時刻の差分から計算します。

```js
export function calculateRemainingSeconds(durationSeconds, startedAtMs, nowMs) {
  return Math.max(0, durationSeconds - Math.floor((nowMs - startedAtMs) / 1000));
}
```

この方式にすると、ブラウザのタブが非アクティブになった場合や、一時的に JavaScript の実行が遅延した場合でも、表示時間のズレを抑えられます。

## JavaScript の状態設計

タイマーの状態は、ひとつの状態オブジェクトとして管理します。

```js
const state = {
  mode: "focus",
  isRunning: false,
  startedAtMs: null,
  remainingSeconds: 25 * 60,
  completedFocusCount: 0,
};
```

モード設定は、集中時間、短い休憩、長い休憩を明示的に分けます。

```js
const settings = {
  focus: { durationSeconds: 25 * 60 },
  shortBreak: { durationSeconds: 5 * 60 },
  longBreak: { durationSeconds: 15 * 60 },
  longBreakInterval: 4,
};
```

状態遷移は、DOM 操作とは分離した関数として実装します。

```js
export function startTimer(state, nowMs) {
  return {
    ...state,
    isRunning: true,
    startedAtMs: nowMs,
  };
}

export function resetTimer(state, settings) {
  return {
    ...state,
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: settings[state.mode].durationSeconds,
  };
}
```

このようにすることで、タイマーの中核ロジックを DOM やブラウザの実時間から切り離してテストできます。

## UI コンポーネントの考え方

UI は 1 ページ完結の構成を基本とします。

主な UI 要素は次の通りです。

- モード切り替え: 集中、短い休憩、長い休憩
- タイマー表示: 現在の残り時間
- 操作ボタン: 開始、一時停止、リセット
- 進捗表示: 完了した集中セッション数、現在のサイクル
- 設定パネル: 集中時間、短い休憩、長い休憩、長い休憩までの回数
- 通知: セッション完了時の音やブラウザ通知

HTML は構造に集中し、状態に応じた見た目の変更は CSS クラスで表現します。JavaScript では、状態変更後に必要な DOM だけを更新します。

## 保存設計

初期実装では、サーバー側にデータベースを持たず、ブラウザの `localStorage` を使用します。

保存対象の例は次の通りです。

- タイマー設定
- 完了した集中セッション数
- 通知音の有効・無効
- 最後に選択したモード

`localStorage` の直接操作は `storage.js` に集約します。

```js
export function createStorageRepository(storage) {
  return {
    loadSettings() {
      const raw = storage.getItem("pomodoro.settings");
      return raw ? JSON.parse(raw) : null;
    },
    saveSettings(settings) {
      storage.setItem("pomodoro.settings", JSON.stringify(settings));
    },
  };
}
```

本番では `window.localStorage` を渡し、ユニットテストではメモリ上の fake storage を渡します。

## ユニットテストしやすくするための改善点

テストしやすさを重視する場合、最も重要なのはロジックと副作用を分離することです。

### 1. タイマー計算を純粋関数にする

`Date.now()` を関数内部で直接呼び出さず、現在時刻を引数として受け取ります。

```js
calculateRemainingSeconds(durationSeconds, startedAtMs, nowMs)
```

これにより、テストでは固定時刻を渡して安定した検証ができます。

### 2. 状態遷移を DOM 操作から分離する

開始、一時停止、リセット、完了時のモード切り替えなどは `timer.js` に実装します。

テスト対象の例は次の通りです。

- 開始すると `isRunning` が `true` になる
- 一時停止すると残り時間が正しく保存される
- リセットすると現在モードの初期時間に戻る
- 集中セッション完了後に短い休憩へ進む
- 規定回数の集中セッション完了後に長い休憩へ進む

### 3. DOM 操作は `app.js` に閉じ込める

`app.js` は、イベントハンドラ、DOM 更新、`setInterval` の管理だけを担当します。

タイマー計算やモード判定を `app.js` に直接書かないことで、DOM を使うテストを最小限にできます。

### 4. 保存先を差し替え可能にする

`storage.js` では `window.localStorage` を直接参照せず、外から storage オブジェクトを受け取れるようにします。

これにより、テストでは fake storage を使って保存・読み込みを検証できます。

### 5. Go の HTTP ハンドラを `NewHandler` として切り出す

Go 側では、サーバー起動処理と HTTP ハンドラ作成処理を分けます。

```go
func NewHandler(staticDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.Handle("/", http.FileServer(http.Dir(staticDir)))

	return mux
}
```

この形にすると、`httptest` を使って実サーバーを起動せずに検証できます。

## テスト方針

優先してテストする対象は次の通りです。

1. `calculateRemainingSeconds`
2. `startTimer`、`pauseTimer`、`resetTimer`
3. `nextMode`
4. 設定値のバリデーション
5. `localStorage` の保存・読み込み
6. Go の `/healthz` と静的ファイル配信
7. 必要に応じた E2E テスト

想定するテストケースは次の通りです。

- 25 分の集中タイマーが 0 になる
- 一時停止後に再開しても残り時間が正しい
- リセットで現在モードの初期時間に戻る
- 集中セッション完了後に短い休憩へ進む
- 規定回数の集中セッション完了後に長い休憩へ進む
- 設定変更後、未開始タイマーに新しい時間が反映される
- 不正な設定値が保存されない

## 実装の進め方

実装は次の順番で進めます。

1. `net/http` で `/`、`/static/`、`/healthz` を配信する
2. `index.html` に UI モックに沿った構造を作る
3. `style.css` でモックの見た目を再現する
4. `timer.js` にタイマー計算と状態遷移を実装する
5. `app.js` でボタン操作と画面更新を接続する
6. `storage.js` で設定と統計情報を保存する
7. JavaScript のユニットテストを追加する
8. Go の HTTP ハンドラテストを追加する
9. 必要に応じて通知音、ブラウザ通知、履歴 API を追加する

## 将来的な拡張

初期版の完成後、必要に応じて次の機能を追加できます。

- セッション履歴のサーバー保存
- 日別・週別の統計表示
- 複数端末での設定同期
- ブラウザ通知
- 通知音の選択
- タスク名やメモの記録
- E2E テストによる主要操作の検証

これらの拡張を見据えても、初期段階ではサーバー側を薄く保ち、タイマーの中核ロジックを JavaScript の純粋関数として実装する方針が最も扱いやすいです。