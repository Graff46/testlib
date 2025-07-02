const obj = {key: {k2: 'test', k3: 56}};

const appData = App.buildData(obj);

App.bind('.i1', x => appData.key.k2);

App.repeat('.i2', x => appData.key, k => appData.key[k]);

setTimeout(() => appData.key = {k2: 1, k3: 2, k4: 3}, 4000);
setTimeout(() => appData.key.k2 = 4, 2000);