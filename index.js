var getEl = (el) => el instanceof Element ? el : document.querySelector(el);

var isProxy = Symbol('isProxy');

var __elID = 0;
function setID() {
    return ++__elID;
}

var App = new (function () {
    this.data2id = new WeakMap();
    this.id2data = new WeakMap();
    this.tempPath = new Map();
    this.repeatStore = new WeakMap();

    this.repeatEls = new WeakMap();
    this.bindEls = new WeakMap();

    this.resetTempPath = function () {
        this.tempPath.clear();
    }

    this.proxyGet = function (obj, prop) {
        this.tempPath.set(obj, prop);
    };

    this.getData = (obj) => {
        return this.data2id.get(obj);
    };

    this.addBind = function (el, handler, arg) {
        var i = 0;
        var cnt = this.tempPath.size;

        this.tempPath.forEach((prop, obj) => {
            if (++i == cnt)
                this.id2data.set(el, (new WeakMap()).set(obj, prop));

            let propList = this.data2id.get(obj);

            if (!propList)
                this.data2id.set(obj, { [prop]: [] });
            else if (!(prop in propList))
                propList[prop] = [];

            this.data2id.get(obj)[prop].push({ el: el, handler: handler, arg: arg });
        });

        this.resetTempPath();
    }

    this.addRepeat = function (handler, context, el, iterHandle, bindHandle, group) {
        var storeObj = {
            handler: handler,
            args: [el, iterHandle, bindHandle, group],
            context: context,
        };

        this.tempPath.forEach((prop, obj) => {
            let story = this.repeatStore.get(obj);

            if (!story)
                return this.repeatStore.set(obj, [storeObj]);

            /*if (!(prop in story))
                story[prop] = [];*/

            story.push(storeObj);
        });

        this.resetTempPath();
    }

    var appEnv = this;

    var needReadGetterFlag = false;
    var skeepProxySetFlag = false;

    return {
        buildData: function (obj) {
            appEnv.resetTempPath();
            var env = this;

            return new Proxy(obj, {
                get: function (target, prop, receiver) {
                    if (prop === isProxy) return true;

                    if (needReadGetterFlag) {
                        if ((target[prop] instanceof Object) && (!(target[prop][isProxy]))) {
                            skeepProxySetFlag = true;
                            receiver[prop] = env.buildData(target[prop]);
                            skeepProxySetFlag = false;
                        }

                        appEnv.proxyGet(receiver, prop);
                    }

                    return Reflect.get(target, prop, receiver);
                },

                set: function (target, prop, val, receiver) {
                    const cond = (!skeepProxySetFlag) && (val instanceof Object);
                    if (cond)
                        val = env.buildData(val);

                    if (cond) {
                        var prp = Object.create(null);

                        var vl = appEnv.data2id.get(receiver[prop]);
                        const vl2 = appEnv.repeatStore.get(receiver[prop]);

                        if (vl) {
                            for (const k in target[prop]) {
                                if (k in val) prp[k] = vl[k];
                            }
                        }

                        appEnv.data2id.set(val, prp);
                        appEnv.data2id.delete(receiver[prop]);

                        if (vl2) {
                            appEnv.repeatStore.set(val, vl2);
                            appEnv.repeatStore.delete(receiver[prop]);
                        }
                    }

                    const result = Reflect.set(target, prop, val, receiver);

                    if (skeepProxySetFlag) return result;

                    let storeProps = appEnv.data2id.get(receiver);
                    if ((storeProps) && (prop in storeProps))
                        storeProps[prop].forEach(elId => elId.el.value = elId.handler(elId.arg));

                    storeProps = appEnv.repeatStore.get(receiver);

                    if (storeProps) {
                        appEnv.repeatStore.delete(receiver);
                        storeProps.forEach(store => store.handler.apply(store.context, store.args));
                    }

                    return result;
                },
            });
        },

        bind: function (el, handler, arg = false) {
            const elm = getEl(el);

            needReadGetterFlag = true;
            elm.value = handler(arg);
            needReadGetterFlag = false;

            appEnv.addBind(elm, handler, arg);

            elm.addEventListener('change', function (event) {
                const store = appEnv.id2data[event.currentTarget.id];

                store.target[store.prop] = event.currentTarget.value;
            });
        },

        repeat: function (el, iterHandle, bindHandle) {
            var elmObj = getEl(el);

            function handler(elm, iterHndle, bindHndle, updGroup = null) {
                needReadGetterFlag = true;
                var iter = iterHndle();
                needReadGetterFlag = false;

                var group = Object.create(null);

                appEnv.addRepeat(handler, this, elm, iterHandle, bindHandle, group);

                var elHTML = String();
                var newEl = null
                var keys = [];
                var tmpKeys = Object.create(null);

                if (updGroup) {
                    for (const k in updGroup) {
                        if (!(k in iter))
                            updGroup[k].remove();
                        else
                            group[k] = document.querySelector(`[__key="${k}"]`);
                    }

                    const obj = Object.create(null);
                    for (const k in iter)
                        if (!(k in updGroup)) obj[k] = iter[k];

                    iter = obj;
                }

                for (const key in iter) {
                    newEl = elm.cloneNode(true);
                    newEl.hidden = false;
                    newEl.setAttribute('__key', key);

                    elHTML += newEl.outerHTML;

                    keys.push(key);
                }

                elm.hidden = true;
                elm.insertAdjacentHTML('afterEnd', elHTML);

                keys.forEach(function (key) {
                    group[key] = document.querySelector(`[__key="${key}"]`);

                    if (bindHandle) this.bind(group[key], bindHndle, key);
                }, this);

                keys = tmpKeys = null;
            }

            handler.call(this, elmObj, iterHandle, bindHandle);
        },
    };
})();