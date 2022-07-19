// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01Ios1 model.DataID = "Test01Ios1"
)

func RegisterIos() {
	f := model.Factory
	f.Register(Test01Ios1, func() interface{} {
		return &model.Ios{
			Manufacturer: "apple",
			Model:        "iphone12",
		}
	})
}
