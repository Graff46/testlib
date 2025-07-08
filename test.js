const obj = { key: { k2: 'test', k3: 56 }, one: 0, };

const app = App(obj);

app.bind('.i1', x => x.key.k2);

var appData = app.getData();

app.repeat('.i2', x => x.key, (x, k) => x.key[k]);
var tt;
setTimeout(() => {appData.key = { k2: 1, k3: 2, k4: 3 }; tt = appData.key}, 2000);
setTimeout(() => tt.k2 = 4, 4000);
setTimeout(() => appData.key = { k2: 6, k4: 8 }, 4500);
setTimeout(() => appData.key.k2 = 5, 6000);