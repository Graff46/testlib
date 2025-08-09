var App = (settingBits = 0) => {
	var getEl = el => (el instanceof Element) ? el : document.querySelector(el);

	var eventType = settingBits & 0b1 ? 'input' : 'change';

	var isProxy = Symbol('isProxy');

	var currentObjProp  = null;
	var repeatStore    	= new WeakMap();

	var el2handlerBind 	= new WeakMap();
	var el2handlerRept 	= new WeakMap();
	var El2group     	= new WeakMap();
	var el2eventHandler	= new WeakMap();

	var bindReset		= new WeakMap();
	var bindUpd			= new WeakMap();

	var parents			= new WeakMap();
	var obj2prox		= new WeakMap();

	var addBind = (handler, resHandler, el) => {
		let story = Object.create(null);
		story.upd = handler;
		story.res = resHandler;

		el2handlerBind.set(el, story);

		parents.get(currentObjProp.obj).forEach(obj => {
			const story = bindReset.get(obj);
			if (story)
				story.add(el);
			else
				bindReset.set(obj, (new Set()).add(el));
		});

		story = bindUpd.get(currentObjProp.obj);
		if (!story) {
			story = Object.create(null);
			story[currentObjProp.prop] = (new Set()).add(el);
			bindUpd.set(currentObjProp.obj, story);
		} else {
			if (story[currentObjProp.prop])
				story[currentObjProp.prop].add(el);
			else
				story[currentObjProp.prop] = (new Set()).add(el);
		}
	}

	var addRepeat = (handler, el, group) => {
		el2handlerRept.set(el, handler);
		El2group.set(el, group);

		const insertHandler = obj => {
			const story = repeatStore.get(obj);

			if (story)
				story.add(el);
			else
				repeatStore.set(obj, (new Set()).add(el));
		}

		insertHandler(currentObjProp.obj[currentObjProp.prop]);
		parents.get(currentObjProp.obj[currentObjProp.prop]).forEach(insertHandler);
	}

	var _unbind = (el, onlyBind) => {
		const elm = getEl(el);

		el2handlerBind.delete(elm);

		el.value = null;

		if (onlyBind) return;

		el2handlerRept.delete(elm);

		const group = El2group.get(elm);
		if (group) {
			Object.values(group).forEach(el => el.remove());
			elm.hidden = false;
		};
	}

	var needReadGetterFlag  = false;
	var skeepProxySetFlag   = false;

	var buildData = (obj, prnt) => {
		return new Proxy(obj, {
			get: (target, prop, receiver) => {
				if (prop === isProxy) return true;

				if (target[prop] instanceof Object) {
					if (!(target[prop][isProxy])) {
						skeepProxySetFlag = true;
						receiver[prop] = buildData(target[prop], receiver);
						skeepProxySetFlag = false;
					} 
				} else if (!(obj2prox.has(target)))
					obj2prox.set(target, receiver);

				if (prnt)
					parents.set(receiver, (new Set(parents.get(prnt) )).add(prnt));

				if (needReadGetterFlag) {
					currentObjProp 		= Object.create(null);
					currentObjProp.obj 	= receiver;
					currentObjProp.prop	= prop;
				}

				return Reflect.get(target, prop, receiver);
			},

			set: (target, prop, val, receiver) => { 
				if ((!skeepProxySetFlag) && (val instanceof Object)) {
					var oldVal = receiver[prop];

					if ((oldVal instanceof Object) && (oldVal[isProxy])) {
						oldVal = null;
						val = buildData(val, target);
					}
				}
				const result = Reflect.set(target, prop, val, receiver);

				if (skeepProxySetFlag) return result;

				var storeProps = bindReset.get(receiver);
				var tmp = null;

				if (storeProps) storeProps.forEach(el => {if (tmp = el2handlerBind.get(el)) tmp.res();});

				if ((storeProps = bindUpd.get(receiver)) && (storeProps = storeProps[prop])) 
					storeProps.forEach(el => {if (tmp = el2handlerBind.get(el)) tmp.upd();});

				if (repeatStore.has(receiver)) {
					storeProps = new Set(repeatStore.get(receiver));
					repeatStore.delete(receiver);
					storeProps.forEach(el => {if (tmp = el2handlerRept.get(el)) tmp();});
				}

				return result;
			},

			deleteProperty: (target, prop) => {
				var obj = null;
				var store = null;

				if (target[prop] instanceof Object) {
					if ((target[prop][isProxy]) && (obj = parents.get(target[prop]))) 
						obj = obj.keys().next().value;
				} else
					obj = obj2prox.get(target);

				if (store = repeatStore.get(obj)) store.forEach(el => _unbind(el));

				if (store = bindReset.get(obj)) store.forEach(el => _unbind(el, true));
				
				if ((store = bindUpd.get(obj)) && (store = store[prop])) store.forEach(el => _unbind(el, true));
				
				return Reflect.deleteProperty(target, prop);
			},
		});
	}

	var extInterface = {
		buildData: obj => buildData(obj),

		bind: (elSel, hndl, args) => {
			const callback = (el, cop) => cop.obj[cop.prop] = el.value;
			const handler = el => el.value = hndl(args);

			return extInterface.xrBind(elSel, handler, callback, true);
		},

		xrBind: (el, handler, callback, __needCurrObj = false, rptKey) => {
			const elm = getEl(el);

			needReadGetterFlag = true;
			handler(elm, rptKey);
			needReadGetterFlag = false;

			var cObjProp = null;
			if (__needCurrObj)
				cObjProp = Object.assign(Object.create(null), currentObjProp);

			addBind(handler.bind(null, elm, rptKey), extInterface.xrBind.bind(null, elm, handler, callback, __needCurrObj, rptKey), elm);

			elm.removeEventListener(eventType, el2eventHandler.get(elm));

			if (callback) {
				const eventHandler = event => callback(event.currentTarget, cObjProp || rptKey);
				el2eventHandler.set(elm, eventHandler);
				elm.addEventListener(eventType, eventHandler);
			}
		},

		repeat: (el, iterHandle, bindHandle, xrBindCallback) => {
			var elmObj = getEl(el);

			var handler = (elm, iterHndle, bindHndle, bindCallback, updGroup = null) => {
				needReadGetterFlag = true;
				var iter = iterHndle();
				needReadGetterFlag = false;

				var group = Object.create(null);

				addRepeat(handler.bind(null, elm, iterHndle, bindHndle, bindCallback, group), elm, group);

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

						if (bindCallback)
							extInterface.xrBind(newEl, bindHandle, bindCallback, false, key);
						else if (bindHandle)
							extInterface.bind(newEl, bindHndle, key);

						fragment.append(newEl);
					}
				}

				elm.hidden = true;
				elm.after(fragment);
			}

			return handler(elmObj, iterHandle, bindHandle, xrBindCallback);
		},

		unbind: _unbind,
	};

	return extInterface;
};

App.eventTypeInput = 0b1;