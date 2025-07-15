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
    
};

const appData = App.buildData(obj);

const y = appData.key;
const yy = appData.one.k2;

App.bind('.i3', x => y.k1.l1.m1);
App.bind('.i1', x => y.k1.l1.m1);

App.repeat('.i2', x => y.k1.l1, k => y.k1.l1[k]);
var tt;
//setTimeout(() => { y.k1 = {l1:{ m1: 55 }}; }, 2000);
setTimeout(() => { y.k1.l1.m111 = 3; App.bind('.i3', x => yy.l2.m2);}, 4000);
/*setTimeout(() => {appData.key = { k2: 6, k4: 8, k9: 99 }; App.unbind('.i2')}, 4500);
setTimeout(() => appData.key.k1.l1.m1 = 5, 4000);*/