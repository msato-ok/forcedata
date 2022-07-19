// +build test

package initial

import (
	"forcedata/examples/golang/model"
)

// データの識別子
const (
	Test01Base1 model.DataID = "Test01Base1"
	Test02Base1 model.DataID = "Test02Base1"
	Test03Base1 model.DataID = "Test03Base1"
	Test04Base1 model.DataID = "Test04Base1"
	Test05Base1 model.DataID = "Test05Base1"
	Test06Base1 model.DataID = "Test06Base1"
)

func RegisterBase() {
	f := model.Factory
	f.Register(Test01Base1, func() interface{} {
		return &model.Base{
			Id:        "5973782bdb9a930533b05cb2",
			IsActive:  true,
			Age:       32,
			Name:      "Logan Keller",
			Gender:    "male",
			EyeColor:  nil,
			HairStyle: f.ChildNode(Test01HairStyle1).(*model.HairStyle),
			Salery:    float64(9007199254740991),
			Friends: []*model.Friends{
				f.ChildNode(Test01Friends1).(*model.Friends),
				f.ChildNode(Test01Friends2).(*model.Friends),
			},
			Groups: []model.Int64OrNull{
				1,
				2,
				3,
			},
			Rooms: []model.StringOrNull{
				"1-1",
				"1-2",
			},
			Device: f.ChildNode(Test01Device1).(*model.Device),
		}
	})
	f.Register(Test02Base1, func() interface{} {
		data := f.InheritNode(Test01Base1).(*model.Base)
		data.IsActive = false
		data.Friends[1] = f.ChildNode(Test02Friends2).(*model.Friends)
		data.Groups = []model.Int64OrNull{
			1,
			2,
			3,
			4,
		}
		data.Qualifications = []interface{}{}
		return data
	})
	f.Register(Test03Base1, func() interface{} {
		data := f.InheritNode(Test02Base1).(*model.Base)
		data.Qualifications = []interface{}{}
		return data
	})
	f.Register(Test04Base1, func() interface{} {
		data := f.InheritNode(Test01Base1).(*model.Base)
		data.Friends = []*model.Friends{
			f.ChildNode(Test01Friends1).(*model.Friends),
			f.ChildNode(Test01Friends2).(*model.Friends),
			f.ChildNode(Test04Friends3).(*model.Friends),
		}
		data.Qualifications = []interface{}{}
		return data
	})
	f.Register(Test05Base1, func() interface{} {
		return &model.Base{
			Id:     "05",
			Device: f.ChildNode(Test05Device1).(*model.Device),
		}
	})
	f.Register(Test06Base1, func() interface{} {
		return &model.Base{
			Id:             "06",
			Qualifications: []interface{}{},
		}
	})
}
