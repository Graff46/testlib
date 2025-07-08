const obj = { key: { k2: 'test', k3: 56 }, one: 0, };

const appData = App.buildData(obj);

App.bind('.i1', x => appData.key.k2);

App.repeat('.i2', x => appData.key, k => appData.key[k]);
var tt;
setTimeout(() => {appData.key = { k2: 1, k3: 2, k4: 3 }; tt = appData.key}, 2000);
setTimeout(() => tt.k2 = 4, 4000);
setTimeout(() => appData.key = { k2: 6, k4: 8 }, 4500);
setTimeout(() => appData.key.k2 = 5, 6000);