// +build test

package golang

type StringOrNull interface{}
type Int64OrNull interface{}
type BoolOrNull interface{}

type HairStyle struct {
}

type Friends struct {
	Id   Int64OrNull  `json:"id"`
	Name StringOrNull `json:"name"`
}

type Android struct {
	Manufacturer StringOrNull `json:"manufacturer"`
	Model        StringOrNull `json:"model"`
}

type Ios struct {
	Manufacturer StringOrNull `json:"manufacturer"`
	Model        StringOrNull `json:"model"`
}

type Device struct {
	Android *Android `json:"android"`
	Ios     *Ios     `json:"ios"`
}

type Base struct {
	Id        StringOrNull   `json:"id"`
	IsActive  BoolOrNull     `json:"is_active"`
	Age       Int64OrNull    `json:"age"`
	Name      StringOrNull   `json:"name"`
	Gender    StringOrNull   `json:"gender"`
	EyeColor  interface{}    `json:"eye_color"`
	HairStyle *HairStyle     `json:"hair_style"`
	Salery    Int64OrNull    `json:"salery"`
	Friends   []*Friends     `json:"friends"`
	Groups    []Int64OrNull  `json:"groups"`
	Rooms     []StringOrNull `json:"rooms"`
	Device    *Device        `json:"device"`
}

// データの識別子
const (
	Test01Android1   DataID = "Test01Android1"
	Test01Ios1       DataID = "Test01Ios1"
	Test01HairStyle1 DataID = "Test01HairStyle1"
	Test01Friends1   DataID = "Test01Friends1"
	Test01Friends2   DataID = "Test01Friends2"
	Test01Device1    DataID = "Test01Device1"
	Test01Base1      DataID = "Test01Base1"
	Test02Friends2   DataID = "Test02Friends2"
	Test02Base1      DataID = "Test02Base1"
	Test04Friends3   DataID = "Test04Friends3"
	Test04Base1      DataID = "Test04Base1"
	Test05Device1    DataID = "Test05Device1"
	Test05Base1      DataID = "Test05Base1"
)

// データ登録
func RegisterData() {
	f := Factory
	f.Register(Test01Android1, func() interface{} {
		return &Android{
			Manufacturer: "google",
			Model:        "pixel5",
		}
	})
	f.Register(Test01Ios1, func() interface{} {
		return &Ios{
			Manufacturer: "apple",
			Model:        "iphone12",
		}
	})
	f.Register(Test01HairStyle1, func() interface{} {
		return &HairStyle{}
	})
	f.Register(Test01Friends1, func() interface{} {
		return &Friends{
			Id:   0,
			Name: "Colon Salazar",
		}
	})
	f.Register(Test01Friends2, func() interface{} {
		return &Friends{
			Id:   1,
			Name: "French\nMcneil",
		}
	})
	f.Register(Test01Device1, func() interface{} {
		return &Device{
			Android: f.ChildNode(Test01Android1).(*Android),
			Ios:     f.ChildNode(Test01Ios1).(*Ios),
		}
	})
	f.Register(Test01Base1, func() interface{} {
		return &Base{
			Id:        "5973782bdb9a930533b05cb2",
			IsActive:  true,
			Age:       32,
			Name:      "Logan Keller",
			Gender:    "male",
			EyeColor:  nil,
			HairStyle: f.ChildNode(Test01HairStyle1).(*HairStyle),
			Salery:    float64(9007199254740991),
			Friends: []*Friends{
				f.ChildNode(Test01Friends1).(*Friends),
				f.ChildNode(Test01Friends2).(*Friends),
			},
			Groups: []Int64OrNull{
				1,
				2,
				3,
			},
			Rooms: []StringOrNull{
				"1-1",
				"1-2",
			},
			Device: f.ChildNode(Test01Device1).(*Device),
		}
	})
	f.Register(Test02Friends2, func() interface{} {
		data := f.InheritNode(Test01Friends2).(*Friends)
		data.Name = "French\nMcneil2"
		return data
	})
	f.Register(Test02Base1, func() interface{} {
		data := f.InheritNode(Test01Base1).(*Base)
		data.IsActive = false
		data.Friends[1] = f.ChildNode(Test02Friends2).(*Friends)
		data.Groups = []Int64OrNull{
			1,
			2,
			3,
			4,
		}
		return data
	})
	f.Register(Test04Friends3, func() interface{} {
		return &Friends{
			Id:   2,
			Name: "Nestor Salinas",
		}
	})
	f.Register(Test04Base1, func() interface{} {
		data := f.InheritNode(Test01Base1).(*Base)
		data.Friends = []*Friends{
			f.ChildNode(Test01Friends1).(*Friends),
			f.ChildNode(Test01Friends2).(*Friends),
			f.ChildNode(Test04Friends3).(*Friends),
		}
		return data
	})
	f.Register(Test05Device1, func() interface{} {
		return &Device{}
	})
	f.Register(Test05Base1, func() interface{} {
		return &Base{
			Id:       "05",
			Device:   f.ChildNode(Test05Device1).(*Device),
			EyeColor: nil,
		}
	})
}

var TestData = map[string]DataID{
	"test01.json": Test01Base1,
	"test02.json": Test02Base1,
	"test03.json": Test02Base1,
	"test04.json": Test04Base1,
	"test05.json": Test05Base1,
}
