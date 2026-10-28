# MkMkCardGame

オリジナルカードゲーム。

対戦の確定事項は [ゲームロジック指示書.md](ゲームロジック指示書.md)。そこに無かった手順は [docs/短いルール.md](docs/短いルール.md) に書いてから、`src/` に実装している。

入口は `createGame` と `applyAction`。カードの処理は構造化した `effects` だけを実行し、効果文の文字列は実行しない。

```sh
npm test
npm run typecheck
```

カードの見た目を作るツールは、このルール実装とは別である。
