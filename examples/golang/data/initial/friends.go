// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01Friends1 model.DataID = "Test01Friends1"
	Test01Friends2 model.DataID = "Test01Friends2"
	Test02Friends2 model.DataID = "Test02Friends2"
	Test04Friends3 model.DataID = "Test04Friends3"
)

func RegisterFriends() {
	f := model.Factory
	f.Register(Test01Friends1, func() interface{} {
		return &model.Friends{
			Id:   0,
			Name: "Colon Salazar",
		}
	})
	f.Register(Test01Friends2, func() interface{} {
		return &model.Friends{
			Id:   1,
			Name: "French\nMcneil",
		}
	})
	f.Register(Test02Friends2, func() interface{} {
		data := f.InheritNode(Test01Friends2).(*model.Friends)
		data.Name = "French\nMcneil2"
		return data
	})
	f.Register(Test04Friends3, func() interface{} {
		return &model.Friends{
			Id:   2,
			Name: "Nestor Salinas",
		}
	})
}
