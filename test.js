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
const yy = appData.aa;

App.bind('.i3', x => yy.bb.cc.dd);
App.bind('.i1', x => y.b.c.d);

App.repeat('.i2', x => y.b.c, k => y.b.c[k]);
var tt;
setTimeout(() => { y.b = {c: { d: 55 }}; }, 2000);
setTimeout(() => { y.b.c.d = 3; /*App.bind('.i3', x => yy.bb.cc.dd)*/;}, 3000);
setTimeout(() => { y.b.c = {d: 4, d2: 5, d3: 6 }; App.unbind('.i2')}, 4000);
setTimeout(() => { yy.bb = {cc: {dd: 44, dd2: 5, dd3: 6 }}; App.unbind('.l3')}, 5000);
setTimeout(() => yy.bb = {cc: {dd : 7}}, 6000);