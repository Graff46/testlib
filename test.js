const obj = {
    key: {
        k1: {
            l1: {m1: 1, m11: 2,}
        }, 
    },

    one: {
        k2: {
            l2: {m2: 22,}
        }
    },

    two: 5,
};

const appData = App.buildData(obj);

const y = appData.key;
const yy = appData.one.k2;

App.bind('.i3', x => y.k1.l1.m1);
App.xrBind('.i1', el => el.value = y.k1.l1.m1, e => y.k1.l1.m1 = e.currentTarget.value);

App.repeat('.i2', x => y.k1.l1, k => y.k1.l1[k]);
var tt;
setTimeout(() => { y.k1 = {l1:{ m1: 55 }}; }, 2000);
setTimeout(() => { y.k1.l1.m111 = 3; /*App.bind('.i3', x => yy.l2.m2)*/;}, 3000);
setTimeout(() => {y.k1.l1 = {m1: 1, m11: 2, m1111: 4 };}, 4000);
//setTimeout(() => delete y.k1.l1, 5000);