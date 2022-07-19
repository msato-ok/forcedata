// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01Device1 model.DataID = "Test01Device1"
	Test05Device1 model.DataID = "Test05Device1"
)

func RegisterDevice() {
	f := model.Factory
	f.Register(Test01Device1, func() interface{} {
		return &model.Device{
			Android: f.ChildNode(Test01Android1).(*model.Android),
			Ios:     f.ChildNode(Test01Ios1).(*model.Ios),
		}
	})
	f.Register(Test05Device1, func() interface{} {
		return &model.Device{}
	})
}
