//go:build test
// +build test

/*
力指向グラフの html を作成するサンプル

usege:
go run -tags=test examples/golang/force/main.go -out examples/force-data.js

*/

package main

import (
	"encoding/json"
	"forcedata/examples/golang"

	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
)

var (
	out string
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
	flag.StringVar(&out, "out", "", "出力するhtml")
}

func validateArgs() error {
	flag.Parse()
	return nil
}

func execute() error {
	golang.RegisterData()
	bdata, _ := json.MarshalIndent(golang.Factory.NodeList(), "", "  ")
	text := fmt.Sprintf("var forceData = %s;\n", string(bdata))
	err := ioutil.WriteFile(out, []byte(text), 0644)
	if err != nil {
		return err
	}
	fmt.Print("Done\n")
	return nil
}
