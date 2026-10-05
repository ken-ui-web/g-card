# 段階3：GitHub Pages で対戦試作を開く

このプロジェクトは `https://github.com/ken-ui-web/g-card` に送信済みです。公開URLは `https://ken-ui-web.github.io/g-card/#/battle` です。以下のGitHubリポジトリ作成・初回送信の手順は記録として残しています。

学校アカウントや生徒名簿の準備はまだ不要です。ここでは、端末内だけで動く対戦試作をiPadで開けるようにします。

1. GitHub にサインインし、右上の「＋」から **New repository** を開きます。リポジトリ名を `g-card` などにし、公開範囲を決めて作成します。作成時の **Add a README file**、`.gitignore`、ライセンスの追加は選びません（こちらのフォルダに必要なファイルがあります）。リポジトリは後で公開され得る前提で、名簿や秘密の値を入れないでください。
2. Windows の PowerShell で、次を順に実行します。最初にGitのコミット用の名前とメールアドレスを設定します。ここには**生徒や学校のメールアドレスを入れず**、自分のGitHub用メールアドレス（必要ならGitHubの非公開メールアドレス）を使ってください。`表示名`、`自分のメールアドレス`、`ユーザー名`、`リポジトリ名` は必ず実際の値に置き換えます。GitHub のサインイン画面が開いたら、そのアカウントで承認します。

   ```powershell
   cd "C:\Users\ken06\AI\授業管理システム\g-card"
   git init -b main
   git config user.name "表示名"
   git config user.email "自分のメールアドレス"
   git add .
   git commit -m "Gカード段階3対戦試作"
   git remote add origin https://github.com/ユーザー名/リポジトリ名.git
   git push -u origin main
   ```

   `git remote add origin` をすでに見本の `https://github.com/ユーザー名/リポジトリ名.git` で実行した場合は、再度 `add` せずに `git remote set-url origin "https://github.com/実際のユーザー名/実際のリポジトリ名.git"` で修正します。`Author identity unknown` が出てコミットが失敗した場合は、名前とメールを設定してから `git commit` 以降を再実行します。

   `package.json`、`src`、`public`、`docs`、`.github` がリポジトリの一番上に並ぶ状態になります。デスクトップの仕様書を別途入れる必要はありません。`docs/SPEC.md` に入っています。
3. GitHub のリポジトリで **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
4. コードを送ると、**Actions** に「GitHub Pages に公開」が表示されます。初回の実行が失敗した場合は、手順3の Pages 設定を保存してから **Actions → GitHub Pages に公開 → Run workflow** で再実行します。緑のチェックが付いたら、**Settings → Pages** に出る公開URLを開きます。
5. 公開URLの末尾に `#/battle` を付けて開きます。例：`https://ユーザー名.github.io/g-card/#/battle`。iPadのSafariで縦向き・横向きの両方を確認してください。試作用の数値調整は `#/dev/tuning` です。

ページが出ない場合は **Actions** の最新の実行結果を開き、失敗した手順の表示を控えてください。公開URLがわかれば、そのURLを教えてください。iPadでの表示確認を一緒に進められます。

# 段階5：学校アカウントとサーバーの準備

段階5では、学校のGoogleアカウントでログインし、GASをサーバーとしてスプレッドシートにデータを保存します。Pages公開URLは `https://ken-ui-web.github.io/g-card/` です。OAuthの**承認済みの JavaScript 生成元**には、パスを除いた `https://ken-ui-web.github.io` を登録します。GASコード、ログイン画面、PWAのファイルは作成済みです。現在の作業手順は [STAGE5_CONNECT.md](STAGE5_CONNECT.md) を参照してください。

**生徒のメールアドレス・氏名・名簿CSV・パスワードはGitHubに置きません。** GitHub Pagesには画面のコードと画像だけを置きます。名簿は学校アカウント所有の、先生だけが開けるスプレッドシートに保存し、GASだけが参照します。生徒はGoogleで認証し、GASが本人のメールアドレスを名簿と照合します。生徒の画面に名簿全体を送る処理は作りません。リポジトリが非公開でもPagesは公開され得るため、公開前にCSV・実名・秘密鍵が混入していないことを確認します。

## 1. 学校アカウントでGoogle Cloudを設定する

1. 学校のGoogleアカウントで [Google Cloud Console](https://console.cloud.google.com/) を開き、Gカード用のプロジェクトを新規作成します。学校が既存のプロジェクトを指定している場合は、その指示に従います。
2. Google Auth Platform の同意画面を設定します。学校組織内だけで使うため、選べる場合はユーザー種別を **内部** にします。内部を選べない場合は、学校のGoogle Workspace管理者にプロジェクトの組織設定を確認してください。
3. **クライアント → クライアントを作成**から、アプリケーションの種類を **ウェブ アプリケーション** にします。
4. **承認済みの JavaScript 生成元**に、GitHub PagesのURLの「`https://` とホスト名」だけを登録します。例：公開URLが `https://example.github.io/g-card/` なら、生成元は `https://example.github.io`。リポジトリ名のパスや `/#/battle` は含めません。ローカルでのログイン確認用に、開発サーバーの実際のポート（例：`http://localhost:5173`）も追加します。
5. 作成された **クライアントID**（末尾が `.apps.googleusercontent.com`）を控えます。クライアントシークレットはこのWebアプリでは使いません。

Google公式：[ウェブ用クライアントIDの設定](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)、[内部ユーザー設定の説明](https://support.google.com/cloud/answer/13463817)。

## 2. スプレッドシートを作る

1. 同じ学校アカウントで、Gカード専用の空のGoogleスプレッドシートを作ります。生徒名簿を入れるため、共有範囲は学校の方針に合わせ、一般公開しないでください。
2. **拡張機能 → Apps Script** を開きます。このスプレッドシートに紐づくGASプロジェクトを使います。
3. [STAGE5_CONNECT.md](STAGE5_CONNECT.md) に従って `Code.gs` と `Bridge.html` を貼り付け、`setup()` を実行します。必要なシートとヘッダー、カードの初期データはコードで作成します。
4. GASの **プロジェクトの設定 → スクリプト プロパティ** に、`GOOGLE_CLIENT_ID` と `SESSION_SECRET` を登録します。`GOOGLE_CLIENT_ID` は手順1のIDです。`SESSION_SECRET` は十分に長いランダムな値を先生側で作り、**チャットやGitHubには貼らない**でください。
5. `setup()` 実行後、`Settings` シートの `schoolDomain` と `adminEmails` に学校ドメイン、先生のメールアドレスを入れます。名簿CSV（`email,class,number,name`）は管理者画面ができてからインポートします。

Google公式：[スクリプト プロパティ](https://developers.google.com/apps-script/guides/properties)。

## 3. GASをウェブアプリとして公開する

1. Apps Scriptの右上 **デプロイ → 新しいデプロイ** を開き、種類を **ウェブアプリ** にします。
2. 実行ユーザーは **自分**（先生）、アクセスは仕様書の方針に合わせて **全員** に設定します。アプリ側でGoogleのIDトークン、学校ドメイン、名簿、セッションを検証します。学校管理者のポリシーによりこの設定が選べない場合は、その表示を控えてください。
3. デプロイ後のURLを控えます。コードを更新したときは、新しいバージョンとして再デプロイします。

Google公式：[Apps Scriptウェブアプリのデプロイ](https://developers.google.com/apps-script/guides/web)。

## 4. GitHub Actionsへ公開設定を渡す

リポジトリの **Settings → Secrets and variables → Actions → Variables → New repository variable** で、`VITE_GOOGLE_CLIENT_ID` と `VITE_GAS_URL` を登録します。両者はフロントのビルドに使う公開設定です。`SESSION_SECRET` と名簿は絶対に登録しないでください。必要なワークフロー修正はコードと一緒に行います。

GitHub公式：[Actionsのリポジトリ変数](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)。

## 5. iPadで確認する（実装・公開後）

1. 学校アカウントが登録済みのiPad Safariで公開URLを開き、Googleログインと名簿外アカウントの拒否を確認します。
2. Safariの共有ボタンから **ホーム画面に追加** し、追加されたアイコンから起動して再度ログインを確認します。ホーム画面版のGoogleログインは実機での確認が必要です。
3. 生徒の `Users` シートA列に学校メール、E列に氏名を登録します。ログイン後は氏名、初期カード、ログインボーナスが表示され、スプレッドシートに記録されることを確認します。ゲストだけがニックネームを入力します。

GitHubリポジトリ・Pages URL・Google CloudクライアントID・学校用の空シートは準備済みです。残りは [STAGE5_CONNECT.md](STAGE5_CONNECT.md) のGAS配置と接続設定、iPad確認です。
