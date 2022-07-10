# forcedata

データの共通性を抽出して、関連性を力指向グラフで可視化するツールです。

データは json で作成されていることを前提とします。  
共通性抽出された結果は、プログラムのソースコードとして出力されて、類似データをオブジェクトとして共通化します。  
出力されるソースコードは typescript, golang に対応しています。

力指向グラフでの可視化は、出力されたソースコードを使って html 出力することで可能となります。

共通性が抽出されたデータは、テストデータのメンテナンスなどに使ってください。  
出力されたコードを使って、json として出力することもできるので、一度、共通性抽出して、コード化したら、それ以降は、jsonの生データをメンテするのではなく、コードを修正することで、データをメンテすることで、テストデータの管理が、楽になると思います。

## とりあえず使ってみる

テストデータのメンテナンスなどに使うことを想定しているため、vscode のリモートコンテナで実行されることを想定しています。  
試しに、ちょっと動かしてみる場合には、例示されているコマンドの先頭に `docker-compose run app ` をつけて実行してください。

例として、対象データが、`./examples/json/*.json` にあるものとします。
共通性抽出された結果は typescript のコードとして出力して、
出力されたコードを使って、力指向グラフの html にします。

* 共通性抽出
    ```bash
    npx ts-node src/cli.ts json2ts -v -o ./examples/typescript/data.ts "./examples/json/*.json"
    ```
* 力指向グラフ用のデータに変換  
    可視化用の html は、`./examples/force.html` に作成してあって、 `force-data.js` を読み込むようになっているので、出力ファイルは `./examples/force-data.js` にしてください。
    ```bash
    npx ts-node examples/typescript/force/main.ts -v -o ./examples/force-data.js
    ```
* ブラウザで表示  
    `./examples/force.html` をブラウザで表示します。
    
    実際のプロジェクトに使う場合には、`./examples/force.html` を任意のディレクトリにコピーして、力指向グラフ用のデータ変換での出力先も、同じディレクトリにするとよいと思います。

* json化  
    ```bash
    npx ts-node examples/typescript/makejson/main.ts -v -o ./examples/json
    ```

## じっくり使ってみる

### 共通性抽出のコード出力

データから共通性抽出してソースコードとして出力します。  

```bash
# typescript
npx ts-node src/cli.ts json2ts -v -o ./examples/typescript/data.ts "./examples/json/*.json"

# golang
npx ts-node src/cli.ts json2go -v -o ./examples/golang/data.go "./examples/json/*.json"
```

※ 実際にサンプルデータで作成されたソースコードも、コミットされています。

#### 型定義の補正

json は型定義がないので、コード化されたもの見たときに、期待した型になっていない場合があります。
その場合には、デフォルトで解釈された型定義を yaml に出力して、その定義を修正して、共通性抽出のコード出力のオプションで指定することで、型を強制することができます。  
手順を示します。

* デフォルトの型定義を出力する
    ```bash
    npx ts-node src/cli.ts json2type -v -o ./examples/data.yml "./examples/json/*.json"
    ```
    ./examples/data.yml に出力されます。

* 出力された型定義 data.yml を編集する
* 修正された出力された型定義 data.yml を使って、コード生成する
    ```bash
    # typescript
    npx ts-node src/cli.ts json2ts -v -t ./examples/data.yml -o ./examples/typescript/data.ts "./examples/json/*.json"

    # golang
    npx ts-node src/cli.ts json2go -v -t ./examples/data.yml -o ./examples/golang/data.go "./examples/json/*.json"
    ```

### 力指向グラフ用データ出力

```bash
# typescript
npx ts-node examples/typescript/force/main.ts -v -o ./examples/force-data.js

# golang
go run -tags=test examples/golang/force/main.go -out examples/force-data.js
```

### jsonファイル出力

```bash
# typescript
npx ts-node examples/typescript/makejson/main.ts -v -o ./examples/json

# golang
go run -tags=test examples/golang/makejson/main.go -outdir examples/json
```

## 開発環境

vscode のリモートコンテナで開発しています。

### vscode の初期設定

Go のデバッグをする場合

* コマンドパレットから実行
    - Go: Install/Update Tools
    - 表示されたツールを全選択してOK

### husky の有効化

precommit に husky を使っているので hook を登録する

```bash
npx husky install
```
