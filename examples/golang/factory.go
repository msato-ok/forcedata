package golang

import (
	"fmt"
	"log"
	"reflect"
	"runtime"
)

// -------------------------------------------------------
// データのファクトリー
//
// データを関数で登録して、データの関連をノードツリーにして
// 可視化できるように管理する
//
var Factory = NewDataFactory()

type DataID string

// DataFactory データのファクトリー
type DataFactory interface {
	Get(dataID DataID) interface{}
	Register(dataID DataID, dataFn func() interface{})
	InheritNode(dataID DataID) interface{}
	ChildNode(dataID DataID) interface{}
	NodeList() []*DataNode
}

type dataFactoryImpl struct {
	cacheFn   map[DataID]func() interface{}
	cacheData map[DataID]interface{}
	nodes     map[DataID]*DataNode
	nodeStack []*DataNode
}

func NewDataFactory() DataFactory {
	f := &dataFactoryImpl{
		cacheFn:   make(map[DataID]func() interface{}),
		cacheData: make(map[DataID]interface{}),
		nodes:     make(map[DataID]*DataNode),
		nodeStack: []*DataNode{},
	}
	return f
}

func (d *dataFactoryImpl) getData(dataID DataID) interface{} {
	data, ok := d.cacheData[dataID]
	if !ok {
		panic(fmt.Errorf("%s は未登録", dataID))
	}
	return data
}

func (d *dataFactoryImpl) getDataFn(dataID DataID) func() interface{} {
	dataFn, ok := d.cacheFn[dataID]
	if !ok {
		panic(fmt.Errorf("%s は未登録", dataID))
	}
	return dataFn
}

func (d *dataFactoryImpl) pushNode(node *DataNode) {
	d.nodeStack = append(d.nodeStack, node)
}

func (d *dataFactoryImpl) popNode() {
	d.nodeStack = d.nodeStack[:len(d.nodeStack)-1]
}

func (d *dataFactoryImpl) lastNode() *DataNode {
	return d.nodeStack[len(d.nodeStack)-1]
}

func (d *dataFactoryImpl) execNode(dataID DataID) interface{} {
	dataFn := d.getDataFn(dataID)
	node := NewDataNode(dataID)
	d.nodes[dataID] = node
	d.pushNode(node)
	data := dataFn()
	d.popNode()
	return data
}

func (d *dataFactoryImpl) Get(dataID DataID) interface{} {
	return d.getData(dataID)
}

func (d *dataFactoryImpl) Register(dataID DataID, dataFn func() interface{}) {
	d.cacheFn[dataID] = dataFn
	data := d.execNode(dataID)
	d.cacheData[dataID] = data
}

func (d *dataFactoryImpl) InheritNode(dataID DataID) interface{} {
	node := d.lastNode()
	node.InheritDataID = dataID
	return d.execNode(dataID)
}

func (d *dataFactoryImpl) ChildNode(dataID DataID) interface{} {
	node := d.lastNode()
	found := false
	for _, id := range node.Properties {
		if id == dataID {
			found = true
			break
		}
	}
	if !found {
		node.Properties = append(node.Properties, dataID)
	}
	return d.execNode(dataID)
}

func (d *dataFactoryImpl) NodeList() []*DataNode {
	nodes := []*DataNode{}
	for _, node := range d.nodes {
		nodes = append(nodes, node)
	}
	return nodes
}

// --------------------------------------------
//

type DataNode struct {
	DataID        DataID   `json:"dataId"`
	InheritDataID DataID   `json:"inheritDataId"`
	Properties    []DataID `json:"properties"`
}

func NewDataNode(dataID DataID) *DataNode {
	return &DataNode{
		DataID:     dataID,
		Properties: []DataID{},
	}
}

// -------------------------------------------------------
// ユーティリティ

func GetTypeName(obj interface{}) string {
	if t := reflect.TypeOf(obj); t.Kind() == reflect.Ptr {
		return t.Elem().Name()
	} else {
		return t.Name()
	}
}

func GetFunctionName(fn interface{}) string {
	return runtime.FuncForPC(reflect.ValueOf(fn).Pointer()).Name()
}

func GetCallerName(skip int) string {
	pc, _, _, ok := runtime.Caller(skip)
	if !ok {
		log.Panicf("unknown caller")
	}
	fn := runtime.FuncForPC(pc)
	return fn.Name()
}
