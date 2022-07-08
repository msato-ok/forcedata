# forcedata

## vscode の初期設定

Go のデバッグをする場合

* コマンドパレットから実行
    - Go: Install/Update Tools
    - 表示されたツールを全選択してOK

## husky の有効化

precommit に husky を使っているので hook を登録する

```bash
npx husky install
```

## デバッグ

```bash
# json2type
npx ts-node src/cli.ts json2type -v -o ./examples/a.yml ./examples/json/*.json
# json2go type なし
npx ts-node src/cli.ts json2go -v -o ./examples/a.go ./examples/json/*.json
# json2go type あり
npx ts-node src/cli.ts json2go -v -o ./examples/a.go ./examples/json/*.json
```

