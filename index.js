var getEl = (el) => el instanceof Element ? el : document.querySelector(el);

var __elID = 0;
function setID () {
    return ++__elID;
}

var App = new (function () {
    this.data2id        = new WeakMap();
    this.id2data        = new WeakMap();
    this.tempPath       = new Map();
    this.repeatStore    = new WeakMap();

    this.repeatEls      = new WeakMap();
    this.bindEls        = new WeakMap();

    this.resetTempPath = function() {
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
                this.data2id.set(obj, {[prop]: []});
            else if (!(prop in propList))
                propList[prop] = [];

            this.data2id.get(obj)[prop].push({el: el, handler: handler, arg: arg});
        });

        this.resetTempPath();
    }

    this.addRepeat = function(handler, context, el, iterHandle, bindHandle, group) {
        var storeObj = {
            handler: handler,
            args: [el, iterHandle, bindHandle, group],
            context: context,
        };

        this.tempPath.forEach((prop, obj) => {
            const story = this.repeatStore.get(obj);

            if (!story)
                this.repeatStore.set(obj, {[prop]: [storeObj]});
            else if (!(prop in story))
                    story[prop] = [storeObj];
                else
                    story[prop].push(storeObj);
        });

        this.resetTempPath();
    }

    var appEnv = this;

    var needReadGetterFlag = false;
    var skeepProxySetFlag = false;

    return {
        buildData: function(obj) {
            appEnv.resetTempPath();
            var env = this;

            return new Proxy(obj, {
                observedKeys: {},

                get: function (target, prop, receiver) {
                    if (needReadGetterFlag) {
                        if ((target[prop] instanceof Object) && (! (prop in this.observedKeys) )) {
                            skeepProxySetFlag = true;
                            receiver[prop] = env.buildData(target[prop]);
                            skeepProxySetFlag = false;
                            this.observedKeys[prop] = true;
                        }

                        appEnv.proxyGet(receiver, prop);
                    }

                    return Reflect.get(target, prop, receiver);
                },

                set: function (target, prop, val, receiver) {
                    if ((!skeepProxySetFlag) && (val instanceof Object))
                        val = env.buildData(val);

                    const result = Reflect.set(target, prop, val, receiver);

                    if (skeepProxySetFlag) return result;

                    let storeProps = appEnv.data2id.get(receiver);
                    if ((storeProps) && (prop in storeProps))
                        storeProps[prop].forEach(elId => elId.el.value = elId.handler(elId.arg));
                    
                    storeProps = appEnv.repeatStore.get(receiver);
                    if ((storeProps) && (prop in storeProps))
                        storeProps[prop].forEach(store => store.handler.apply(store.context, store.args));

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

            function handler(elm, iterHndle, bindHndle, updGroup = null ) {
                needReadGetterFlag = true;
                var iter = iterHndle();
                needReadGetterFlag = false;

                var group = Object.create(null);

                appEnv.addRepeat(handler, this, elm, iterHandle, bindHandle, group);

                var elHTML = String();
                var newEl = null
                var keys = [];

                if (updGroup) {
                    for (const k in updGroup)
                        if (!(k in iter)) iter[k].remove();

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

                for (const key of keys) {
                    group[key] = document.querySelector(`[__key="${key}"]`);
                    
                    if (bindHandle) 
                        this.bind(group[key], bindHndle, key);
                }

                keys = null;
            }

            handler.call(this, elmObj, iterHandle, bindHandle);
        },
    };
})();