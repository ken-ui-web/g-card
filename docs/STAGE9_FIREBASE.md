# 段階9：Firebaseの準備とオンライン対戦

Firebaseプロジェクトはまだ作成されていません。個人のGoogleアカウントでも作成できます。操作を1段階ずつ案内する [セットアップウィザード](../tools/setup-firebase.sh) も用意しています。WindowsではGit Bashから `bash tools/setup-firebase.sh` で実行できます。手作業で進める場合は以下だけで足ります。

## 1. Firebaseプロジェクトを作る

1. [Firebaseコンソール](https://console.firebase.google.com/)を開き、「プロジェクトを追加」を押す。Gカード専用の名前を付ける。個人アカウントでも動く。学校の管理者がアカウントやGoogle Cloudプロジェクトを指定している場合は、その指示を優先する。
2. 料金プランは **Spark（無料）** のままにする。Google Analyticsはこのアプリには不要。
3. プロジェクトの概要が表示されたら、そのプロジェクトを開いたまま次へ進む。

Firebaseには対戦用のニックネーム・デッキ・対戦の進行情報が入る。学校メール、名簿、Gポイントは学校側のApps Scriptとスプレッドシートで管理する。個人アカウントで運用する場合は、学校の情報管理ルールを確認し、引き継ぎが必要になったときのために[プロジェクトのユーザーと権限](https://firebase.google.com/docs/projects/iam/overview)から学校側の管理者を追加できるようにしておく。

## 2. 匿名認証を有効にする

「構築」→「Authentication」→「始める」→「ログイン方法」で、**匿名**を有効にして保存する。学校のGoogleログインは引き続きGカードのGAS側で確認する。Firebaseには学校メールや名簿を登録しない。

## 3. Realtime Databaseを作る

「構築」→「Realtime Database」→「データベースを作成」を開く。地域を選び、**ロックモード**で作成する。作成後の「ルール」に [database.rules.json](../firebase/database.rules.json) の全文を貼り付けて公開する。テストモードのまま運用しない。

このルールは匿名認証済み端末だけを受け付ける。対戦部屋は参加者2人だけが読め、各端末は自分のカード決定・公開・状態ハッシュだけを書ける。待機列と4桁コードにはニックネーム等の対戦用情報だけを置く。Firebaseの匿名認証だけでは学校所属を証明できないため、Gポイント確定時はGASで学校ログイン済みの異なる2アカウントの結果を照合する。

## 4. ウェブアプリの設定を控える

「プロジェクトの概要」の歯車→「プロジェクトの設定」→「マイアプリ」からウェブアプリ（`</>`）を追加する。Firebase Hostingは選ばない。表示される `firebaseConfig` の項目を1行のJSONにし、Realtime DatabaseのURLを `databaseURL` として含める。例：

```json
{"apiKey":"例","authDomain":"例.firebaseapp.com","databaseURL":"https://例.firebasedatabase.app","projectId":"例","appId":"例"}
```

これはウェブアプリに配る**公開設定**であり、管理者パスワードやサービスアカウント鍵ではない。学校メール、生徒名簿、GASの `SESSION_SECRET` は含めない。

## 5. GitHub Pagesへ設定を渡す

[GカードのGitHub Actions変数](https://github.com/ken-ui-web/g-card/settings/variables/actions)で、Repository variablesに `VITE_FIREBASE_CONFIG` を追加し、値に手順4の1行JSONを入れる。既存の `VITE_GAS_URL` と `VITE_GOOGLE_CLIENT_ID` はそのままにする。追加後に「Actions」→「GitHub Pages に公開」→「Run workflow」で再公開する。

ローカルで確認するときだけ `.env.local` に `VITE_FIREBASE_CONFIG=...` を保存する。このファイルはGitに含まれない。

## 6. 学校側Apps Scriptを更新する

学校側の既存Apps Scriptの `Code.gs` を [最新版](https://github.com/ken-ui-web/g-card/blob/main/gas/Code.gs)に貼り替えて保存する。`Learning.gs` と `Bridge.html` はそのまま。`setup()` を1回実行して `OnlineMatches` シートと設定項目を作り、既存ウェブアプリを「新しいバージョン」で再デプロイする。名簿、所持カード、Gポイントは上書きしない。

## 7. 確認してから生徒に公開する

`onlineEnabled=0` の間、管理者の学校アカウントでは `/#/online` に管理者テストモードが表示される。同じ学校アカウントをPCとiPadなど別の端末で開けば、実際の生徒アカウントを借りずにルームコード対戦とランダムマッチ、4ラウンド、切断からの復帰を試せる。ブラウザーの通常タブ同士はFirebaseの匿名IDを共有するので使わず、別端末か通常ウィンドウとシークレットウィンドウを組み合わせる。このテスト対戦では `OnlineMatches`、`BattleLog`、Gポイント、ランキングに記録しない。報酬処理は、公開後に異なる2つの学校アカウントで行われた最初の実対戦で確認する。通信切れが30秒を超えた試合は不戦勝画面へ進むが、両者の結果照合ができない場合はG報酬を付けない。本公開時に管理者画面の「Gポイントと育成の数値」で `onlineEnabled` を `1` にする。ランキングだけ停止する場合は `rankingEnabled` を `0` にする。

両端末に「管理者テストモードです」が出てから新しい部屋を作る。試合中は「先生A VS 先生B」と表示される。表示されない場合は管理者設定を `0` にして両端末を再読み込みし、以前のルームコードは使わない。

Firebaseの無料枠を守るため、Realtime Databaseへの接続はオンライン対戦画面を開いている間だけ行う。終了時は両端末の報酬確認後に部屋とコードを削除する。途中で閉じた部屋は30分で期限切れとなり、再接続時の掃除対象にする。

参考：[Firebaseウェブアプリ設定](https://firebase.google.com/docs/web/setup)、[匿名認証](https://firebase.google.com/docs/auth/web/anonymous-auth)、[Realtime Databaseの作成](https://firebase.google.com/docs/database/web/start)、[データベースのセキュリティルール](https://firebase.google.com/docs/database/security)、[切断検知](https://firebase.google.com/docs/database/web/offline-capabilities)。
