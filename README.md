# LunchDeck 🍱

LunchDeck は https://nacookan.github.io/lunchdeck/ で利用できます。

お昼ご飯何食べるか決められない人のためのランチ決定ツール。

近所の飲食店を登録・タグ付けしておき、その日の気分や移動時間でパッと絞り込んだり、ランダムやルーレットで今日のランチを決めることができます。

サーバーDBに個人情報（自宅や職場の近所の店、行動履歴など）を持たず、静的ファイルだけで動作し、データは**ユーザー自身のDropboxアカウント**にのみ保存されます。

---

## 主な特徴

- 🏷️ **グループ化されたタグ絞り込み**:
  - `状態`: `🌱 未訪問` / `⏳ ご無沙汰` / `🕒 最近` / `⭐️ 定番`
  - `ジャンル` / `時間` / `方面`: お店登録時に自由に追加でき、実際に登録されたタグだけが候補やフィルターとして表示されます。
  - カテゴリごとに整理されているため、迷わずパッと選べます。
- ⚡️ **店名が主役の超シンプルUI**:
  - 知っている店だからこそ、余計なメモやURL、タグ表示は削ぎ落とし、店名と訪問状況（`3日前 · 5回`）だけをすっきり表示。
- 🎯 **迷いを解消する並べ替え & ランダム順**:
  - **おすすめ順 (偏りランダム)**: 直近行った店は後ろに回り、しばらく行っていないご無沙汰な店や未訪問店が上位に来やすいスマートな重み付けシャッフル。
  - **完全ランダム順**: 条件に合う店をフラットに均等シャッフル。
  - **最近行った順 / ご無沙汰順 / 訪問回数多い順 / 訪問回数少ない順 / 名前順**
- 🎲 **1個だけ決める（決定ルーレット）**:
  - どうしても決められない時に、現在の絞り込み条件に合うお店から1軒をスロット・ルーレット風にピックアップ！
- 🍽️ **訪問記録（「行った」） & 履歴管理**:
  - 「行った」ボタンをワンタップするだけで今日の訪問を記録（誤タップ時の取消通知付き）。
  - 編集画面から過去の訪問日時の個別削除や手動追加も可能。
- 🔒 **プライバシー重視 & サーバーレス**:
  - データはお使いのDropbox（アプリフォルダ内の `/lunchdeck.json`）にのみ保存。サーバーやDBには個人情報を一切保持しません。
- ⚡️ **ビルドプロセス不要**:
  - HTML / CSS / Vanilla JavaScript のみで構成。バンドラやコンパイルなしでそのままブラウザで動きます。

---

## 動かし方・ローカルで試す

```sh
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

> ⚠️ **注意**: LunchDeck は Dropbox への保存を前提としているため、**Dropbox App Key の設定が必須**です。App Key が未設定の場合は画面上でエラー案内が表示されます。

### ローカルで動かす場合
ローカル設定ファイルを作成します（`config.local.js` はGit管理されません）。

```sh
cp config.local.example.js config.local.js
```

`config.local.js` の `PASTE_YOUR_DROPBOX_APP_KEY_HERE` をご自身のDropbox App keyに書き換えてください。

---

## Dropbox の設定手順

1. [Dropbox App Console](https://www.dropbox.com/developers/apps) で **Create app** を選択。
2. 以下の設定を選択：
   - **Scoped access**
   - **App folder**（アプリ専用フォルダ）
   - アプリ名（例: `LunchDeck`）
3. **Permissions** タブで、以下にチェックを入れて保存（Submit）：
   - `files.content.read`
   - `files.content.write`
4. **Settings** タブの **OAuth 2** 設定：
   - **Redirect URIs** に以下を登録（末尾のスラッシュまで完全一致）：
     - ローカル開発用: `http://localhost:8000/`
     - 本番用（GitHub Pages）: `https://<ユーザー名>.github.io/<リポジトリ名>/`
5. 表示される **App key** をコピーします。
   - ※ App secret は不要です（ブラウザ完結の OAuth 2.0 PKCE フローを使用しています）。

---

## GitHub Pages へのデプロイ

リポジトリの `.github/workflows/deploy-pages.yml` により、静的ファイルが自動デプロイされます。

1. GitHubリポジトリの **Settings → Secrets and variables → Actions** に進みます。
2. **Repository secrets**（または **Variables**）で `DROPBOX_APP_KEY` という名前でDropboxの App key を登録します。
3. **Settings → Pages → Build and deployment** の Source で **GitHub Actions** を選択します。
4. `main` ブランチへ push すると、GitHub Actions が自動で静的サイトをビルド（App keyを注入した `config.local.js` を生成）して GitHub Pages に公開します。

---

## データ構造 (`/lunchdeck.json`)

Dropboxのアプリフォルダ内に以下のJSONとして保存されます。

```json
{
  "version": 1,
  "updatedAt": "2026-10-18T12:00:00.000Z",
  "restaurants": [
    {
      "id": "c3a9f8...",
      "name": "洋食キッチン ABC",
      "tags": ["洋食", "徒歩5分", "東口"],
      "visits": [
        "2026-10-18T12:30:00.000Z",
        "2026-10-05T12:15:00.000Z"
      ],
      "createdAt": "2026-09-01T10:00:00.000Z",
      "updatedAt": "2026-10-18T12:30:00.000Z"
    }
  ]
}
```
