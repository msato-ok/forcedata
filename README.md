# datatrait

## husky の有効化

```bash
npx husky install
```

## デバッグ

```bash
# json2type
npx ts-node src/cli.ts json2type -v -o ./examples/type.yml "./examples/json/*.json"
# json2go type なし
npx ts-node src/cli.ts json2go -v -o ./examples/golang/data.go "./examples/json/*.json"
# json2go type あり
npx ts-node src/cli.ts json2go -v -t ./examples/type.yml -o ./examples/golang/data.go "./examples/json/*.json"
```

## issue

- 代替フローと例外フローは、基本フローを extends する形式になっているが、飛び石状態のフローが正しく継らない問題がある
