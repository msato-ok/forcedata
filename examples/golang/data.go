//go:build test
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
	Android Android `json:"android"`
	Ios     Ios     `json:"ios"`
}

type Base struct {
	Id        StringOrNull   `json:"id"`
	IsActive  BoolOrNull     `json:"is_active"`
	Age       Int64OrNull    `json:"age"`
	Name      StringOrNull   `json:"name"`
	Gender    StringOrNull   `json:"gender"`
	EyeColor  interface{}    `json:"eye_color"`
	HairStyle HairStyle      `json:"hair_style"`
	Salery    Int64OrNull    `json:"salery"`
	Friends   []Friends      `json:"friends"`
	Groups    []Int64OrNull  `json:"groups"`
	Rooms     []StringOrNull `json:"rooms"`
	Device    Device         `json:"device"`
}

func GetTest01Base1() Base {
	return Base{
		Id:        "5973782bdb9a930533b05cb2",
		IsActive:  true,
		Age:       32,
		Name:      "Logan Keller",
		Gender:    "male",
		EyeColor:  nil,
		HairStyle: GetTest01HairStyle1(),
		Salery:    9007199254740991,
		Friends: []Friends{
			GetTest01Friends1(),
			GetTest01Friends2(),
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
		Device: GetTest01Device1(),
	}
}

func GetTest01HairStyle1() HairStyle {
	return HairStyle{}
}

func GetTest01Friends1() Friends {
	return Friends{
		Id:   0,
		Name: "Colon Salazar",
	}
}

func GetTest01Friends2() Friends {
	return Friends{
		Id:   1,
		Name: "French\nMcneil",
	}
}

func GetTest01Device1() Device {
	return Device{
		Android: GetTest01Android1(),
		Ios:     GetTest01Ios1(),
	}
}

func GetTest01Android1() Android {
	return Android{
		Manufacturer: "google",
		Model:        "pixel5",
	}
}

func GetTest01Ios1() Ios {
	return Ios{
		Manufacturer: "apple",
		Model:        "iphone12",
	}
}

func GetTest02Base1() Base {
	data := GetTest01Base1()
	data.IsActive = true
	data.Friends[1] = GetTest01Friends2()
	data.Groups = []Int64OrNull{
		1,
		2,
		3,
	}
	return data
}

func GetTest02HairStyle1() HairStyle {
	return HairStyle{}
}

func GetTest02Friends2() Friends {
	data := GetTest01Friends2()
	data.Name = "French\nMcneil"
	return data
}

func GetTest04Base1() Base {
	data := GetTest01Base1()
	data.Friends = []Friends{
		GetTest01Friends1(),
		GetTest01Friends2(),
		GetTest04Friends3(),
	}
	return data
}

func GetTest04HairStyle1() HairStyle {
	return HairStyle{}
}

func GetTest04Friends3() Friends {
	return Friends{
		Id:   2,
		Name: "Nestor Salinas",
	}
}

var TestData = map[string]interface{}{
	"test01.json": GetTest01Base1(),
	"test02.json": GetTest02Base1(),
	"test04.json": GetTest04Base1(),
}
