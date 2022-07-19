// +build test

package data

import (
	"forcedata/examples/golang/data/initial"
	"forcedata/examples/golang/model"
)

// データ登録
func RegisterData() {
	initial.RegisterAndroid()
	initial.RegisterIos()
	initial.RegisterHairStyle()
	initial.RegisterFriends()
	initial.RegisterDevice()
	initial.RegisterBase()
}

var TestData = map[string]model.DataID{
	"test01.json": initial.Test01Base1,
	"test02.json": initial.Test02Base1,
	"test03.json": initial.Test03Base1,
	"test04.json": initial.Test04Base1,
	"test05.json": initial.Test05Base1,
	"test06.json": initial.Test06Base1,
}
