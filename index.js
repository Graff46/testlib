var App = (() => { 
	var getEl = el => el instanceof Element ? el : document.querySelector(el);
	var isProxy = Symbol('isProxy');
	var mask 	= Symbol('mask');

	return (settingBits = 0) => {
		var eventType = settingBits & 0b1 ? 'input' : 'change';
		var currentObjProp  = null;

		var el2handlerBind 	= new WeakMap();
		var el2handlerRept 	= new WeakMap();
		var El2group     	= new WeakMap();
		var el2eventHandler	= new WeakMap();

		var repeatStore    	= Object.create(null);
		var bindReset		= Object.create(null);
		var bindUpd			= Object.create(null);

		var _eachBit = (code, collector, el) => {
			var insert = bcode => {
				if (story = collector[bcode])
					story.push(el);
				else
					collector[bcode] = [el];
			}

			var nullCnt = 0;
			while(code !== 1) {
				code >>= 1;
				if (code % 2) {
					if ((code === 1) && (nullCnt))
						insert(code << nullCnt);
					else
						insert(code);

					nullCnt = 0;
				} else
					nullCnt++;
			}
		}

		var addBind = (handler, resHandler, el) => {
			let story = Object.create(null);
			story.upd = handler;
			story.res = resHandler;

			el2handlerBind.set(el, story);

			var code = currentObjProp.obj[mask];

			if ((story = bindUpd[code])) {
				if (story[currentObjProp.prop])
					story[currentObjProp.prop].push(el);
				else
					story[currentObjProp.prop] = [el];
			} else {
				story = Object.create(null);
				story[currentObjProp.prop] = [el];
				bindUpd[code] = story;
			}

			return _eachBit(code, bindReset, el);
		}

		var addRepeat = (handler, el, group) => {
			el2handlerRept.set(el, handler);
			El2group.set(el, group);

			return _eachBit(
				currentObjProp.obj[currentObjProp.prop][mask],
				repeatStore,
				el
			);
		}

		var _unbind = (el, onlyBind = false) => {
			const elm = getEl(el);

			el2handlerBind.delete(elm);

			el.value = null;

			if (onlyBind) return;

			el2handlerRept.delete(elm);

			const group = El2group.get(elm);
			if (group) {
				Object.values(group).forEach(el => el.remove())
				elm.hidden = false;
			};
		}

		var needReadGetterFlag  = false;
		var skeepProxySetFlag   = false;

		var buildData = (obj, code = 1) => {
			let length = 0;
			let num = code;
			do {
				length++;
				num >>= 1; // сдвигаем вправо на 1 бит
			} while (num !== 0);

			return new Proxy(obj, {
				mask: code,
				props: new Set(),

				get: function (target, prop, receiver) {
					if (prop === isProxy)	return true;
					if (prop === mask)		return this.mask;

					if ((target[prop] instanceof Object) && (!(target[prop][isProxy]))) {
						skeepProxySetFlag = true;

						this.props.add(prop);
						this.mask <<= this.props.size - 1;

						receiver[prop] = buildData(target[prop], ((this.mask << 1) | 1));
						skeepProxySetFlag = false;
					}

					if (needReadGetterFlag) {
						currentObjProp 		= Object.create(null);
						currentObjProp.obj 	= receiver;
						currentObjProp.prop	= prop;
					}

					return Reflect.get(target, prop, receiver);
				},

				set: function (target, prop, val, receiver) {
					var storebinds 		= null;
					var storeRepeats	= null;

					if ((!skeepProxySetFlag) && (val instanceof Object)) {
						var oldVal = receiver[prop];

						if ((oldVal instanceof Object) && (oldVal[isProxy])) {
							oldVal = null;
							
							val = buildData(val, ((this.mask << 1) | 1));
						}

						var code = receiver[mask];
						if (bindReset[code]) {
							storebinds = Array.from(bindReset[code]);
							bindReset[code] = [];
						};

						if (repeatStore[code]) {
							storeRepeats = Array.from(repeatStore[code]);
							repeatStore[code] = [];
						}
						
					}
					const result = Reflect.set(target, prop, val, receiver);

					if (skeepProxySetFlag) return result;

					if (storeRepeats) storeRepeats.forEach(el => {if (el2handlerRept.has(el)) el2handlerRept.get(el)();});

					if (storebinds) storebinds.forEach(el => {if (el2handlerBind.has(el)) el2handlerBind.get(el).res();});

					if ((storebinds = bindUpd[receiver[mask]]) && (storebinds = storebinds[prop]))
						storebinds.forEach(el => {if (el2handlerBind.has(el)) el2handlerBind.get(el).upd();});

					return result;
				},

				deleteProperty: (target, prop) => {
					var obj = null;
					var store = null;

					if (target[prop] instanceof Object) {
						if (target[prop][isProxy]) {
							if (obj = parents.get(target[prop]))
								obj = obj[prop];
						}
					} else
						obj = obj2prox.get(target);

					var code = obj[mask];

					if (store = repeatStore[code])
						store.forEach(el => _unbind(el));

					if (store = bindReset[code])
						store.forEach(el => _unbind(el, true));
					
					if ((store = bindUpd[code]) && (store = store[prop]))
						store.forEach(el => _unbind(el, true));
					
					return Reflect.deleteProperty(target, prop);
				},
			});
		}

		var extInterface = {
			buildData: obj => buildData(obj),

			bind: (elSel, hndl, args = false) => {
				const callback = (el, src) => src.obj[src.prop] = el.value;

				const handler = el => el.value = hndl(args);

				return extInterface.xrBind(elSel, handler, callback, true);
			},

			xrBind: (el, handler, callback, __needCurrObj, rptKey) => {
				const elm = getEl(el);

				needReadGetterFlag = true;
				handler(elm, rptKey);
				needReadGetterFlag = false;

				var cObjProp = null;
				if (__needCurrObj)
					cObjProp = Object.assign(Object.create(null), currentObjProp);

				addBind(handler.bind(extInterface, elm, rptKey), extInterface.xrBind.bind(extInterface, el, handler, callback, __needCurrObj, rptKey), elm);

				elm.removeEventListener(eventType, el2eventHandler.get(elm));

				if (callback) {
					const eventHandler = event => callback(event.currentTarget, cObjProp || rptKey);
					el2eventHandler.set(elm, eventHandler);
					elm.addEventListener(eventType, eventHandler);
				}
			},

			repeat: (el, iterHandle, bindHandle, xrBindCallback) => {
				var elmObj = getEl(el);

				const handler = (elm, iterHndle, bindHndle, bindCallback, updGroup = null) => {
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
})();

App.eventTypeInput = 0b1;