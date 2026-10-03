# Gカード

`docs/SPEC.md` に沿ったGカードアプリです。学校Googleログイン、カード購入・育成・対戦、テストと既存の授業振り返りシステムとの連携、管理者画面を実装しています。段階9のルームコード対戦と週間ランキングを実装し、管理者テストモードでの実機確認を進めています。テストの回答本文と振り返り本文はGカードのシートへ保存しません。

## ローカルで遊ぶ

```powershell
npm install
npm run dev
```

表示されたURLの `/#/battle` を開いてください。モードとレベルを選び、5枚から4枚のデッキを決めて対戦を始めます。CPU戦ではCPUが別の4枚を選び、裏面の種類構成もプレイヤーと異なります。端末内2人対戦では同じデッキを使います。初期選択はキックを救急箱に入れ替えた4枚で、どのカードも一覧で変更できます。カード決定後はラウンド表示と「VS」の演出を経て両者の裏面が現れます。種類・勝敗を確認したら、「カードをめくる」で表面を公開します。2人対戦では、画面の案内に従って端末を交代で渡します。`/#/dev/tuning` では初期ライフ、CPUのライフ・筋トレ値、3枚の基本ダメージ、救急箱の回復量、演出速度を調整できます。調整値はこの端末に保存され、次の対戦から適用されます。

```powershell
npm test
npm run build
```

試作対戦はGポイント・ミッション・ランキングに反映されません。カード表面は枠・人物・文字を一体で生成した画像1枚を使い、ダメージ効果のあるカードの右上に最終ダメージだけを画面で重ねます。`design-source/` と `tools/build-card-fronts.cjs` は以前の試作記録です。

GitHub Pages への公開手順は [docs/SETUP.md](docs/SETUP.md)、学校アカウントの接続は [docs/STAGE5_CONNECT.md](docs/STAGE5_CONNECT.md)、Firebaseの準備は [docs/STAGE9_FIREBASE.md](docs/STAGE9_FIREBASE.md) または [対話式セットアップ](tools/setup-firebase.sh)、実装と確認の記録は [docs/PROGRESS.md](docs/PROGRESS.md) を参照してください。
