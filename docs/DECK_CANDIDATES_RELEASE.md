# サンプル・CPU候補を全40枚から選ぶための更新

管理者画面の「カード・ミッション」→「サンプル・CPUデッキの設定」で、販売停止中のカードを含む40枚を候補にできます。各カードには種類・レア度・効果を表示します。販売設定は変わりません。

## 学校側Apps Script

既存の `Code.gs` にある `gcAdminSaveDeck_` 関数のカード確認を、[最新版の1行](../gas/Code.gs)に変更します。

```javascript
if (!payload.cardIds.every(function (id) { return master.some(function (card) { return card.cardId === id; }); })) gcError_('BAD_DECK', '登録済みのカードから選んでください');
```

保存後、「デプロイ」→「デプロイを管理」→既存デプロイの編集→「新しいバージョン」で更新します。`setup()` は不要です。既存のシート、カードの販売設定、選択済み候補、所持カード、Gポイントは変更しません。

## 公開サイト

Apps Scriptの新しいバージョンが反映されてから、この画面変更をGitHub Pagesへ公開します。管理者画面で販売停止中のカードを1枚候補に追加して一括保存し、開き直して選択状態を確認します。
