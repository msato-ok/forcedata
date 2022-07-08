//go:build test
// +build test

/*
json のデータを作成するサンプル

usege:
go run -tags=test examples/golang/usagetree/main.go -outdir examples/json

*/

package main

import (
	"encoding/json"
	"forcedata/examples/golang"

	"flag"
	"fmt"

	"log"
	"os"
)

var (
	outdir string
)

func main() {
	if err := validateArgs(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
	if err := execute(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}

func init() {
	flag.StringVar(&outdir, "outdir", "", "html 出力先ディレクトリ")
}

func validateArgs() error {
	flag.Parse()
	return nil
}

func execute() error {
	golang.RegisterData()
	bdata, _ := json.MarshalIndent(golang.Factory.NodeList(), "", "  ")
	fmt.Printf("var usages = %s;\n", string(bdata))
	fmt.Print("Done\n")
	return nil
}
