// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01Android1 model.DataID = "Test01Android1"
)

func RegisterAndroid() {
	f := model.Factory
	f.Register(Test01Android1, func() interface{} {
		return &model.Android{
			Manufacturer: "google",
			Model:        "pixel5",
		}
	})
}
