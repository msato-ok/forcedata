# forcedata

データの共通性を抽出して、関連性を力指向グラフで可視化するツールです。

データは json で作成されていることを前提とします。  
共通性抽出された結果は、プログラムのソースコードとして出力されて、類似データをオブジェクトとして一つに共通化されるようになっています。  
出力されるソースコードは typescript, golang で出力できます。

可視化は、出力されたソースコードを使って html 出力することで行います。

共通性が抽出されたデータは、テストデータのメンテナンスなどに使ってください。

## 使い方

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

### コード生成

データから共通性抽出してソースコードとして出力します。  

```bash
# typescript
npx ts-node src/cli.ts json2ts -v -o ./examples/typescript/data.ts "./examples/json/*.json"

# golang
npx ts-node src/cli.ts json2go -v -o ./examples/golang/data.go "./examples/json/*.json"
```

※ 実際にサンプルデータで作成されたソースコードも、コミットされています。

### 型定義の補正

json の型定義の曖昧さから、期待した型になっていない場合があります。
その場合には、デフォルトで解釈された型定義を yaml に出力して、その定義を修正して、ソースコード出力のオプションで指定することで、型を強制することができます。  
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
