//go:build test
// +build test

/*
json のデータを作成するサンプル

usege:
go run -tags=test examples/golang/makejson/main.go -outdir examples/json

*/

package main

import (
	"forcedata/examples/golang/data"
	"forcedata/examples/golang/model"

	"encoding/json"
	"flag"
	"fmt"

	"io/ioutil"
	"log"
	"os"
	"path/filepath"
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
	flag.StringVar(&outdir, "outdir", "", "json出力先ディレクトリ")
}

func validateArgs() error {
	flag.Parse()
	return nil
}

func execute() error {
	// if _, err := os.Stat(outdir); os.IsNotExist(err) {
	// 	if err := os.MkdirAll(outdir, 0755); err != nil {
	// 		return err
	// 	}
	// }
	data.RegisterData()
	for jsonFile, dataID := range data.TestData {
		outputPath := filepath.Join(outdir, jsonFile)
		data := model.Factory.Get(dataID)
		bdata, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return err
		}
		bdata = append(bdata, 0x0a)
		fmt.Printf("output %s ...\n", outputPath)
		err = ioutil.WriteFile(outputPath, bdata, 0644)
		if err != nil {
			return err
		}
	}
	fmt.Print("Done\n")
	return nil
}
