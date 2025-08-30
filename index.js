self.App = (() => {
	var getEl = el => (el instanceof Element) ? el : document.querySelector(el);
	var IS_PROXY = Symbol('isProxy');
	var MASK = Symbol('mask');

	return (settingBits = 0) => {
		var EVENT_TYPE = settingBits & 0b1 ? 'input' : 'change';
		var BINDING_PROPERTY = settingBits & 0b10 ? 'textContent' : 'value';

		var rootObj			= null;
		var currentObjProp	= null;

		var el2handlerBind	= new WeakMap();
		var el2handlerRept	= new WeakMap();
		var El2group		= new WeakMap();
		var el2eventHandler	= new WeakMap();

		var repeatStore    	= Object.create(null);
		var bindReset		= Object.create(null);
		var bindUpd			= Object.create(null);

		var obj2prox		= new WeakMap();

		var skipProxyGetFlg = false;

		var _eachBit = (code, collector, el) => {
			var insert = bcode => ((collector[bcode]) || (collector[bcode] = [])).push(el);

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

			var code = currentObjProp.obj[MASK];

			(story = bindUpd[code]) || (bindUpd[code] = story = Object.create(null));
			(story[currentObjProp.prop] = (story[currentObjProp.prop] || [])).push(el);

			currentObjProp = null;

			return _eachBit(code, bindReset, el);
		}

		var addRepeat = (handler, el, group) => {
			el2handlerRept.set(el, handler);
			El2group.set(el, group);

			skipProxyGetFlg = true;
			const msk = currentObjProp.obj[currentObjProp.prop][MASK]
			skipProxyGetFlg = false;

			currentObjProp = null;

			return _eachBit(msk, repeatStore, el);
		}

		var _unbind = (el, onlyBind) => {
			const elm = getEl(el);

			el2handlerBind.delete(elm);

			elm.value = null;

			if (onlyBind) return;

			el2handlerRept.delete(elm);

			const group = El2group.get(elm);
			if (group) {
				Object.values(group).forEach(eld => eld.remove());
				elm.hidden = false;
			};
		}

		var needStoredGetterFlg = false;
		var skipProxySetFlg = false;

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

				get: function(target, prop, receiver) {
					if (prop === IS_PROXY) return true;
					if (prop === MASK) return this.mask;

					if (!skipProxyGetFlg) {
						if ((target[prop] instanceof Object) && !(target[prop][IS_PROXY])) {
							skipProxySetFlg = true;

							this.props.add(prop);
							this.mask <<= this.props.size - 1;

							const newVal = receiver[prop] = buildData(target[prop], ((this.mask << 1) | 1));
							skipProxySetFlg = false;
						} else if (!obj2prox.has(target))
							obj2prox.set(target, receiver);

						if (needStoredGetterFlg) {
							currentObjProp 		= Object.create(null);
							currentObjProp.obj 	= receiver;
							currentObjProp.prop	= prop;
						}
					}

					return Reflect.get(target, prop, receiver);
				},

				set: function(target, prop, val, receiver)  {
					var storebinds 		= null;
					var storeRepeats	= null;

					if ((!skipProxySetFlg) && (val instanceof Object) && (!val[IS_PROXY])) {
						val = buildData(val, ((this.mask << 1) | 1));

						var code = receiver[MASK];
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

					if (skipProxySetFlg) return result;

					if (storeRepeats) storeRepeats.forEach(el => el2handlerRept.has(el) && el2handlerRept.get(el)());

					if (storebinds) storebinds.forEach(el => el2handlerBind.has(el) && el2handlerBind.get(el).res());

					if ((storebinds = bindUpd[receiver[MASK]]) && (storebinds = storebinds[prop]))
						storebinds.forEach(el => el2handlerBind.has(el) && el2handlerBind.get(el).upd());

					return result;
				},

				deleteProperty: (target, prop) => {
					var store = target[prop];
					var code;

					if ((store instanceof Object) && (code = store[MASK])) {
						var nullCnt = 0;
						while(code !== 1) {
							code >>= 1;
							if (code % 2) {
								if ((code === 1) && (nullCnt)) {
									code = (code << nullCnt);
									break;
								} else
									break;

								nullCnt = 0;
							} else
								nullCnt++;
						}
					} else
						code = obj2prox.get(target)[MASK];

					if (store = repeatStore[code]) store.forEach(el => _unbind(el));

					if (store = bindReset[code]) store.forEach(el => _unbind(el, true));

					if ((store = bindUpd[code]) && (store = store[prop])) store.forEach(el => _unbind(el, true));

					return Reflect.deleteProperty(target, prop);
				},
			});
		}

		var extInterface = {
			buildData: obj => rootObj = buildData(obj),

			bind: (elSel, hndl, args) => {
				const callback = (el, cop) => cop.obj[cop.prop] = el[BINDING_PROPERTY];
				const handler = el => el[BINDING_PROPERTY] = hndl(args);

				return extInterface.xrBind(elSel, handler, callback, true);
			},

			xrBind: (el, handler, callback, __needCurrObj = false, rptKey) => {
				const elm = getEl(el);

				needStoredGetterFlg = true;
				handler(elm, rptKey);
				needStoredGetterFlg = false;

				var cObjProp = __needCurrObj ? Object.assign(Object.create(null), currentObjProp) : null;

				if (currentObjProp)
					addBind(handler.bind(null, elm, rptKey), extInterface.xrBind.bind(null, elm, handler, callback, __needCurrObj, rptKey), elm);

				elm.removeEventListener(EVENT_TYPE, el2eventHandler.get(elm));

				if (callback) {
					const eventHandler = event => callback(event.currentTarget, cObjProp || rptKey);
					el2eventHandler.set(elm, eventHandler);
					elm.addEventListener(EVENT_TYPE, eventHandler);
				}
			},

			repeat: (el, iterHandle, bindHandle, xrBindCallbackOrFlag = true, updGroup) => {
				var elm = getEl(el);

				needStoredGetterFlg = true;
				var iter = iterHandle();
				needStoredGetterFlg = false;

				var group = Object.create(null);

				if ((currentObjProp || 1) && (xrBindCallbackOrFlag != null))
				addRepeat(extInterface.repeat.bind(null, elm, iterHandle, bindHandle, xrBindCallbackOrFlag, group), elm, group);

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

						if (xrBindCallbackOrFlag instanceof Function)
							extInterface.xrBind(newEl, bindHandle, xrBindCallbackOrFlag, false, key);
						else if (xrBindCallbackOrFlag && bindHandle)
							extInterface.bind(newEl, bindHandle, key);
						else if (bindHandle)
							bindHandle(newEl, key);

						fragment.append(newEl);
					}
				}

				elm.hidden = true;
				elm.after(fragment);
			},

			unbind: _unbind,
		};

		return extInterface;
	};
})();

App.eventTypeInput = 0b1;
App.textContentBinding = 0b10;