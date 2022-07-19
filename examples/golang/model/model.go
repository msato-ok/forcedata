// +build test

package model

type StringOrNull interface{}
type Int64OrNull interface{}
type BoolOrNull interface{}

type Base struct {
	Id             StringOrNull   `json:"id"`
	IsActive       BoolOrNull     `json:"is_active"`
	Age            Int64OrNull    `json:"age"`
	Name           StringOrNull   `json:"name"`
	Gender         StringOrNull   `json:"gender"`
	EyeColor       interface{}    `json:"eye_color"`
	HairStyle      *HairStyle     `json:"hair_style"`
	Salery         Int64OrNull    `json:"salery"`
	Friends        []*Friends     `json:"friends"`
	Groups         []Int64OrNull  `json:"groups"`
	Rooms          []StringOrNull `json:"rooms"`
	Device         *Device        `json:"device"`
	Qualifications []interface{}  `json:"qualifications"`
}

type HairStyle struct {
}

type Friends struct {
	Id   Int64OrNull  `json:"id"`
	Name StringOrNull `json:"name"`
}

type Device struct {
	Android *Android `json:"android"`
	Ios     *Ios     `json:"ios"`
}

type Android struct {
	Manufacturer StringOrNull `json:"manufacturer"`
	Model        StringOrNull `json:"model"`
}

type Ios struct {
	Manufacturer StringOrNull `json:"manufacturer"`
	Model        StringOrNull `json:"model"`
}
