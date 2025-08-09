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

const myApp = App(App.eventTypeInput);
const appData = myApp.buildData(obj);

const y = appData.key;
const yy = appData.one.k2;

myApp.xrBind('.i3', x => x.value = y.k1.l1.m1, (el) => y.k1.l1.m1 = el.value);
myApp.bind('.i1', x => y.k1.l1.m1);

myApp.repeat('.i2', x => y.k1.l1, (el, k) => el.value = y.k1.l1[k], (el, k) => y.k1.l1[k] = el.value);
var tt;
setTimeout(() => { y.k1 = {l1:{ m1: 55 }}; }, 2000);
setTimeout(() => { y.k1.l1.m111 = 3; /*App.bind('.i3', x => yy.l2.m2)*/;}, 3000);
setTimeout(() => {y.k1.l1 = {m1: 1, m11: 2, m1111: 4 };}, 4000);
//setTimeout(() => delete y.k1.l1, 5000);