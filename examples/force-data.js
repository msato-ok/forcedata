var forceData = [
  {
    "dataId": "TEST01_ANDROID_1",
    "properties": []
  },
  {
    "dataId": "TEST01_IOS_1",
    "properties": []
  },
  {
    "dataId": "TEST01_HAIR_STYLE_1",
    "properties": []
  },
  {
    "dataId": "TEST01_FRIENDS_1",
    "properties": []
  },
  {
    "dataId": "TEST01_FRIENDS_2",
    "properties": []
  },
  {
    "dataId": "TEST02_FRIENDS_2",
    "inheritDataId": "TEST01_FRIENDS_2",
    "properties": []
  },
  {
    "dataId": "TEST04_FRIENDS_3",
    "properties": []
  },
  {
    "dataId": "TEST01_DEVICE_1",
    "properties": [
      "TEST01_ANDROID_1",
      "TEST01_IOS_1"
    ]
  },
  {
    "dataId": "TEST05_DEVICE_1",
    "properties": []
  },
  {
    "dataId": "TEST01_BASE_1",
    "properties": [
      "TEST01_HAIR_STYLE_1",
      "TEST01_FRIENDS_1",
      "TEST01_FRIENDS_2",
      "TEST01_DEVICE_1"
    ]
  },
  {
    "dataId": "TEST02_BASE_1",
    "inheritDataId": "TEST01_BASE_1",
    "properties": [
      "TEST02_FRIENDS_2"
    ]
  },
  {
    "dataId": "TEST03_BASE_1",
    "inheritDataId": "TEST02_BASE_1",
    "properties": []
  },
  {
    "dataId": "TEST04_BASE_1",
    "inheritDataId": "TEST01_BASE_1",
    "properties": [
      "TEST01_FRIENDS_1",
      "TEST01_FRIENDS_2",
      "TEST04_FRIENDS_3"
    ]
  },
  {
    "dataId": "TEST05_BASE_1",
    "properties": [
      "TEST05_DEVICE_1"
    ]
  },
  {
    "dataId": "TEST06_BASE_1",
    "properties": []
  }
];
