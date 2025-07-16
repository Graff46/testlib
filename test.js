const obj = {
    a: {                         //a-1-1
        b: {                     //b-3-11
            c: {d: 1, d2: 2,}    //c-7-111 { d-15-1111 }
        }, 
    },

    aa: {
        bb: {
            cc: {dd: 22,}
        }
    }, 
    
};

const appData = App.buildData(obj);

const y = appData.a;
const yy = appData.aa.bb;

//App.bind('.i3', x => y.k1.l1.m1);
App.bind('.i1', x => y.b.c.d);

//App.repeat('.i2', x => y.k1.l1, k => y.k1.l1[k]);
var tt;
//setTimeout(() => { y.k1 = {l1:{ m1: 55 }}; }, 2000);
//setTimeout(() => { y.b.c.d = 3; /*App.bind('.i3', x => yy.cc.dd)*/;}, 2000);
setTimeout(() => { y.b.c = {d: 4, d2: 5, d3: 6 }; /*App.unbind('.i2')*/}, 3000);
//setTimeout(() => y.b.c = {d : 7}, 4000);