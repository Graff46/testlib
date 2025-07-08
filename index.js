var App = new (function () {
    var getEl = el => el instanceof Element ? el : document.querySelector(el);
    var isProxy = Symbol('isProxy');

    var data2id        = new WeakMap();
    var id2data        = new WeakMap();
    var tempPath       = new Map();
    var repeatStore    = new WeakMap();

    function resetTempPath() {
        tempPath.clear();
    }

    function addBind(el, handler, arg) {
        var i = 0;
        var cnt = tempPath.size;

        tempPath.forEach((prop, obj) => {
            if (++i == cnt)
                id2data.set(el, (new WeakMap()).set(obj, prop));

            let propList = data2id.get(obj);

            if (!propList)
                data2id.set(obj, { [prop]: [] });
            else if (!(prop in propList))
                propList[prop] = [];

            data2id.get(obj)[prop].push({ el: el, handler: handler, arg: arg });
        });

        resetTempPath();
    }

    function addRepeat(handler, context, el, iterHandle, bindHandle, group) {
        var storeObj = {
            handler: handler,
            args: [el, iterHandle, bindHandle, group],
            context: context,
        };

        tempPath.forEach((prop, obj) => {
            let story = repeatStore.get(obj);

            if (!story)
                return repeatStore.set(obj, [storeObj]);

            story.push(storeObj);
        });

        resetTempPath();
    }

    var needReadGetterFlag  = false;
    var skeepProxySetFlag   = false;

    return {
        buildData: function (obj) {
            resetTempPath();
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

                        tempPath.set(receiver, prop);
                    }

                    return Reflect.get(target, prop, receiver);
                },

                set: function (target, prop, val, receiver) {
                    const cond = (!skeepProxySetFlag) && (val instanceof Object);

                    if (cond) {
                        val = env.buildData(val);

                        var prp = Object.create(null);

                        var bindStory = data2id.get(receiver[prop]);
                        const rpStory = repeatStore.get(receiver[prop]);

                        if (bindStory) {
                            for (const k in target[prop]) {
                                if (k in val) prp[k] = bindStory[k];
                            }
                        }

                        data2id.set(val, prp);
                        data2id.delete(receiver[prop]);

                        if (rpStory) {
                            repeatStore.set(val, rpStory);
                            repeatStore.delete(receiver[prop]);
                        }
                    }

                    const result = Reflect.set(target, prop, val, receiver);

                    if (skeepProxySetFlag) return result;

                    let storeProps = data2id.get(receiver);
                    
                    if ((storeProps) && (prop in storeProps))
                        storeProps[prop].forEach(elId => elId.el.value = elId.handler(elId.arg));

                    storeProps = repeatStore.get(receiver);

                    if (storeProps) {
                        repeatStore.delete(receiver);
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

            const propPath = Array.from(tempPath.values());
            const rootObj = tempPath.keys().next().value;

            addBind(elm, handler, arg);

            elm.addEventListener('change', function (event) {
                propPath.reduce(
                    (stack, prop, i) => ++i === propPath.length ? stack[prop] = event.currentTarget.value : stack[prop],
                    rootObj
                );
            });
        },

        repeat: function (el, iterHandle, bindHandle) {
            var elmObj = getEl(el);

            function handler(elm, iterHndle, bindHndle, updGroup = null) {
                needReadGetterFlag = true;
                var iter = iterHndle();
                needReadGetterFlag = false;

                var group = Object.create(null);

                addRepeat(handler, this, elm, iterHandle, bindHandle, group);

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

                keys = null;
            }

            handler.call(this, elmObj, iterHandle, bindHandle);
        },
    };
})();