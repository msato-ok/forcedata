// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01HairStyle1 model.DataID = "Test01HairStyle1"
)

func RegisterHairStyle() {
	f := model.Factory
	f.Register(Test01HairStyle1, func() interface{} {
		return &model.HairStyle{}
	})
}
