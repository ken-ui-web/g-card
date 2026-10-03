# 段階5：学校アカウント接続

この手順は、学校アカウントで作成したGカード用スプレッドシートにGASを設置するためのものです。共有は「制限付き」のままにします。**生徒名簿・学校のメールアドレス・シートURL・SESSION_SECRETをGitHubに入れないでください。**

## 1. スプレッドシートにGASを入れる

1. Gカード用スプレッドシートを学校アカウントで開き、**拡張機能 → Apps Script** を選びます。
2. 最初の `コード.gs` の中身をすべて消し、このリポジトリの `gas/Code.gs` の全文を貼り付けて保存します。
3. 左側の **＋ → HTML** で `Bridge` という名前のファイルを追加します。中身を `gas/Bridge.html` の全文に置き換えて保存します。
4. 関数選択欄で `setup` を選び、**実行**します。初回はGoogleの権限確認が出ます。スプレッドシート操作とGoogleのトークン検証に必要な権限です。完了すると、`Users` や `Cards` など17枚のシートが作られます。同時にシートIDがスクリプトプロパティへ自動保存されます。元の空の「シート1」は残っていても問題ありません。

`gas/appsscript.json` は、Apps Scriptのマニフェストを明示的に管理したい場合に使うファイルです。画面から貼る方法では `Code.gs` と `Bridge.html` の2つで始められます。

## 2. 学校用の値を設定する

1. スプレッドシートの `Settings` シートで、`schoolDomain` の値に学校メールの **@より後だけ**を入れます。`adminEmails` には、管理する先生自身の学校メールアドレスを入れます。複数人ならカンマ区切りです。これらはGitHubには入れません。
2. クライアントIDがまだスクリプトプロパティに入っていない場合は、`Settings` シートの `A9` に `googleClientIdSetup`、`B9` にウェブアプリ用クライアントIDを入力し、Apps Scriptで `setup` をもう一度実行します。`setup` はIDをスクリプトプロパティへ移し、A9:C9を消します。`SESSION_SECRET` はGAS内で自動生成されるため、先生が作る必要はありません。秘密値をチャットへ送らないでください。
3. Apps Scriptの **プロジェクトの設定 → スクリプト プロパティ** で `GOOGLE_CLIENT_ID`、`SESSION_SECRET`、`SPREADSHEET_ID` の3件が存在することだけ確認します。値は共有しないでください。
4. Google Cloudのウェブアプリ用クライアントで、**承認済みの JavaScript 生成元**に `https://ken-ui-web.github.io` が登録されていることを確認します。URLの `/g-card/` 以降は含めません。

## 3. GASを公開する

Apps Script右上の **デプロイ → 新しいデプロイ → 種類：ウェブアプリ** を開きます。**実行ユーザー：自分**、**アクセスできるユーザー：全員**を選びます。公開された `/exec` で終わるウェブアプリURLを控えます。アプリ側では、Google IDトークン、学校ドメイン、名簿、署名付きセッションを毎回確認します。

コードを後で修正した場合は、**デプロイを管理 → 編集 → バージョン：新しいバージョン**で更新します。エディタで保存しただけでは既存の `/exec` に反映されません。

## 4. GitHub Pagesへ接続する

GitHubの `ken-ui-web/g-card` で **Settings → Secrets and variables → Actions → Variables** を開き、次のリポジトリ変数を登録します。

| Name | Value |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Google Cloudのウェブアプリ用クライアントID |
| `VITE_GAS_URL` | 手順3のGASウェブアプリ `/exec` URL |

これらはブラウザーに渡される公開用の設定値です。`SESSION_SECRET` と名簿をGitHub Actionsに入れません。変数を保存した後、**Actions → GitHub Pages に公開 → Run workflow** を実行して再ビルドします。

## 5. 最初のログインを確認する

1. 公開URLの `https://ken-ui-web.github.io/g-card/#/home` を開きます。
2. まず `adminEmails` に入れた先生の学校アカウントでログインします。初回はニックネームを決めます。
3. `#/admin` で `email,class,number,name` の列を持つ名簿CSVを取り込みます。CSVや実名は学校のシートだけに置きます。
4. 名簿内の生徒アカウントでログインし、初期カード4枚、初回100G、日次10Gがシートに記録されるか確かめます。名簿にないアカウントは拒否されることも確認します。
5. iPad Safariで**ホーム画面に追加**し、そこから開いてログインを確認します。この実機確認が終わるまで、段階5のチェックは未完了です。

PagesからGASの `doPost` へJSONを送ります。ブラウザーからの通信と無効セッション拒否は確認済みです。学校のGoogle Workspace設定やiPadのログイン動作は、実機での確認が必要です。
