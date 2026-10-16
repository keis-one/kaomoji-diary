# Google Play 掲載素材 — 今日、〇〇できた？

作成日: 2026-10-10 / 言語: 日本語 / 対象: Android無料版

| ファイル | 用途 |
|---|---|
| store_icon_512.png | ストアアイコン。512×512、32ビットPNG、全面不透明 |
| feature_graphic_1024x500.png | フィーチャーグラフィック。1024×500、24ビットPNG、透明度なし |
| app_name_ja.txt | アプリ名 |
| short_description_ja.txt | 短い説明。34文字 |
| full_description_ja.txt | 詳しい説明。686文字 |

各txtはUTF-8。本文をそのままPlay Consoleへ貼り付けられます。
ストアアイコンは既存 assets/icon.png から作成。フィーチャーグラフィックはグリーンと顔文字・カレンダーで構成した紹介用イラストです。実際のアプリ画面のスクリーンショットではありません。生成画像モデル・外部画像は使用していません。
アプリ本体・既存アイコン・app.jsonは変更していません。
説明は仕様書v1.5の無料版に基づき、将来の有料版向け機能（複数問い・グラフ・顔文字カスタム）は掲載していません。

画像要件: https://support.google.com/googleplay/android-developer/answer/9866151?hl=ja
文字数要件: https://support.google.com/googleplay/android-developer/answer/9859152?hl=ja

実施したこと: 掲載画像2点と日本語テキスト3点を作成。寸法・形式・容量・文字数と画像の表示を確認。
できなかったこと: Play Consoleへの登録、実機での機能確認。
要確認事項: デザイン・紹介文の最終確認。仕様書ではCSV・カレンダー入力等の実機確認待ちが残っているため、公開ビルドで紹介文との一致を確認してください。