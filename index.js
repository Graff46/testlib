var App = (() => {
	var getEl = el => el instanceof Element ? el : document.querySelector(el);
	var isProxy = Symbol('isProxy');

	return (wobj, settingBits = 0) => {
		var eventType = settingBits & 0b1 ? 'input' : 'change';

		var data2id         = new Set();
		var tempPath        = new Map();
		var repeatStore     = new Set();
		var el2eventHandler = new Map();

		var addBind = handler => data2id.add(handler);

		var addRepeat = handler => repeatStore.add(handler);

		var needReadGetterFlag = false;
		var skeepProxySetFlag = false;

		var buildData = obj => {
		   tempPath.clear();

			return new Proxy(obj, {
				get: (target, prop, receiver) => {
					if (prop === isProxy) return true;

					if (needReadGetterFlag) {
						if ((target[prop] instanceof Object) && (!(target[prop][isProxy]))) {
							skeepProxySetFlag = true;
							receiver[prop] = buildData(target[prop]);
							skeepProxySetFlag = false;
						}

						tempPath.set(receiver, prop);
					}

					return Reflect.get(target, prop, receiver);
				},

				set: (target, prop, val, receiver) => {
					const cond = (!skeepProxySetFlag) && (val instanceof Object);

					if (cond) val = buildData(val);

					const result = Reflect.set(target, prop, val, receiver);

					if (skeepProxySetFlag) return result;
					
					const tmp = new Set(repeatStore);
					repeatStore.clear();
					tmp.forEach(handler => handler());

					data2id.forEach(handler => handler());

					return result;
				},
			});
		}

		var workData = buildData(wobj);

		var extInterface = {
			getData: () => workData,

			bind: (el, handler, args) => {
				const collback = (el, cop) => cop.reduce(
					(stack, prop, i, arr) => ++i === arr.length ? stack[prop] = el.value : stack[prop],
					workData,
				);

				const handlr = (workData, arg, elm) => elm.value = handler(workData, arg, elm);

				return extInterface.xrBind(el, handlr, collback, true, args);
			},

			xrBind: (el, handler, collback, __needCurrObj, arg) => {
				const elm = getEl(el);

				tempPath.clear();
				needReadGetterFlag = true;
				handler(workData, arg, elm);
				needReadGetterFlag = false;

				var cObjProp = __needCurrObj ? Array.from(tempPath.values()) : null;

				addBind(handler.bind(null, workData, arg, elm));

				elm.removeEventListener(eventType, el2eventHandler.get(elm));

				if (collback) {
					const eventHandler = event => collback(event.currentTarget, cObjProp || arg);
					el2eventHandler.set(elm, eventHandler);
					elm.addEventListener(eventType, eventHandler);
				}
			},

			repeat: (el, iterHandle, bindHandle, xrBindCallback, updGroup) => {
				const elm = getEl(el);

				needReadGetterFlag = true;
				var iter = iterHandle(workData);
				needReadGetterFlag = false;

				var group = Object.create(null);

				if (updGroup) {
					for (const k in updGroup) {
						if (iter[k])
							group[k] = updGroup[k];
						else
							updGroup[k].remove();
					}
				}

				var newEl = null
				var fragment = new DocumentFragment();

				for (const key in iter) {
					if ((!updGroup) || (!(key in updGroup))) {
						newEl = elm.cloneNode(true);
						newEl.hidden = false;
						newEl.setAttribute('__key', key);

						group[key] = newEl;

						if (xrBindCallback)
							extInterface.xrBind(newEl, bindHandle, xrBindCallback, false, key);
						else if (bindHandle)
							extInterface.bind(newEl, bindHandle, key);

						fragment.append(newEl);
					}
				}

				elm.hidden = true;
				elm.after(fragment);

				addRepeat(extInterface.repeat.bind(null, elm, iterHandle, bindHandle, xrBindCallback, group));
			},
		};

		return extInterface;
	};
})();