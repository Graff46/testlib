function App (wobj) {
    var getEl = el => el instanceof Element ? el : document.querySelector(el);
    var isProxy = Symbol('isProxy');

    this.data2id        = new Set();
    this.id2data        = new WeakMap();
    this.tempPath       = new Map();
    this.repeatStore    = new Set();

    this.repeatEls      = new WeakMap();
    this.bindEls        = new WeakMap();

    this.resetTempPath = function () {
        this.tempPath.clear();
    }

    this.addBind = function (handler) {
        this.data2id.add(handler)
        this.resetTempPath();
    }

    this.addRepeat = function (handler) {
        this.repeatStore.add(handler);
        this.resetTempPath();
    }

    var appEnv = this;

    var needReadGetterFlag = false;
    var skeepProxySetFlag = false;

    function buildData(obj) {
        appEnv.resetTempPath();

        return new Proxy(obj, {
            get: function (target, prop, receiver) {
                if (prop === isProxy) return true;

                if (needReadGetterFlag) {
                    if ((target[prop] instanceof Object) && (!(target[prop][isProxy]))) {
                        skeepProxySetFlag = true;
                        receiver[prop] = buildData(target[prop]);
                        skeepProxySetFlag = false;
                    }

                    appEnv.tempPath.set(receiver, prop);
                }

                return Reflect.get(target, prop, receiver);
            },

            set: function (target, prop, val, receiver) {
                const cond = (!skeepProxySetFlag) && (val instanceof Object);

                if (cond) val = buildData(val);

                const result = Reflect.set(target, prop, val, receiver);

                if (skeepProxySetFlag) return result;

                appEnv.data2id.forEach(handler => handler());
                const tmp = Array.from(appEnv.repeatStore);
                appEnv.repeatStore.clear();
                tmp.forEach(handler => handler());

                return result;
            },
        });
    }

    var workData = buildData(wobj);

    return {
        getData: function() {
            return workData;
        },

        bind: function (el, handler, arg = null) {
            const elm = getEl(el);

            needReadGetterFlag = true;
            elm.value = handler(workData, arg);
            needReadGetterFlag = false;

            const propPath = Array.from(appEnv.tempPath.values());

            appEnv.addBind(() => elm.value = handler(workData, arg));

            elm.addEventListener('change', function (event) {
                propPath.reduce(
                    (stack, prop, i) => ++i === propPath.length ? stack[prop] = event.currentTarget.value : stack[prop],
                    arg,
                );
            });
        },

        repeat: function (el, iterHandle, bindHandle) {
            var elmObj = getEl(el);

            function handler(elm, iterHndle, bindHndle, updGroup = null) {
                needReadGetterFlag = true;
                var iter = iterHndle(workData);
                needReadGetterFlag = false;

                var group = Object.create(null);

                if (updGroup) {
                    for (const k in updGroup) {
                        if (!(k in iter))
                            updGroup[k].remove();
                        else
                            group[k] = document.querySelector(`[__key="${k}"]`);
                    }
                }

                var elHTML = String();
                var newEl = null
                var keys = [];

                for (const key in iter) {
                    if ((!updGroup) || (!(key in updGroup))) {
                        newEl = elm.cloneNode(true);
                        newEl.hidden = false;
                        newEl.setAttribute('__key', key);

                        elHTML = elHTML.concat(newEl.outerHTML);

                        keys.push(key);
                    }
                }

                elm.hidden = true;
                elm.insertAdjacentHTML('afterEnd', elHTML);

                keys.forEach(key => {
                    group[key] = document.querySelector(`[__key="${key}"]`);

                    if (bindHandle) this.bind(group[key], bindHndle, key);
                });

                appEnv.addRepeat(() => handler.call(this, elm, iterHndle, bindHndle, group));

                keys = null;
            }

            handler.call(this, elmObj, iterHandle, bindHandle);
        },
    };
};