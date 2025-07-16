var App = new (function () {
	var getEl = el => el instanceof Element ? el : document.querySelector(el);

	var isProxy = Symbol('isProxy');
	var mask 	= Symbol('mask');

	var currentObjProp  = null;
	var repeatStore    	= new WeakMap();

	var el2handlerBind 	= new WeakMap();
	var el2handlerRept 	= new WeakMap();
	var El2group     	= new WeakMap();
	var el2eventHandler	= new WeakMap();

	var bindReset		= Object.create(null);
	var bindUpd			= Object.create(null);

	var maxDeep			= 1;

	function addBind(handler, resHandler, el) {
		let story = Object.create(null);
		story.upd = handler;
		story.res = resHandler;

		el2handlerBind.set(el, story);

		if ((story = bindUpd[currentObjProp.obj[mask].code])) {
			if (story = story[currentObjProp.prop])
				story.push(handler);
			else
				story[currentObjProp.prop] = [handler];
		} else {
			story = Object.create(null);
			story[currentObjProp.prop] = [handler];
			bindUpd[currentObjProp.obj[mask].code] = story;
		}

		if (story = bindReset[currentObjProp.obj[mask].code])
			story.add(resHandler);
		else
			bindReset[currentObjProp.obj[mask].code] = (new Set()).add(resHandler);
	}

	function addRepeat(handler, el, group) {
		el2handlerRept.set(el, handler);
		El2group.set(el, group);

		const insertHandler = obj => {
			const story = repeatStore.get(obj);

			if (story)
				story.add(el);
			else
				repeatStore.set(obj, (new Set()).add(el));
		}

		insertHandler(currentObjProp.obj);
		insertHandler(currentObjProp.obj[currentObjProp.prop]);
		currentObjProp.obj[parents].forEach(insertHandler);
	}

	function _unbind(el, onlyBind = false) {
		const elm = getEl(el);

		el2handlerBind.delete(elm);

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

	function buildData (obj, msk = {code: 1, prop: null}) {
		let length = 0;
		let num = msk.code;
		do {
			length++;
			num >>= 1; // сдвигаем вправо на 1 бит
		} while (num !== 0);

		maxDeep = Math.max(length, maxDeep);

		return new Proxy(obj, {
			mask: Object.assign(Object.create(null), msk),

			get: function (target, prop, receiver) {
				if (prop === isProxy) return true;
				if (prop === mask) return this.mask;

				if ((target[prop] instanceof Object) && (!(target[prop][isProxy]))) {
					skeepProxySetFlag = true;

					receiver[prop] = buildData(target[prop], {code: ((this.mask.code << 1) | 1), prop: prop});
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
				var storeProps = null;

				if ((!skeepProxySetFlag) && (val instanceof Object)) {
					var oldVal = receiver[prop];// new WeakRef ?

					if ((oldVal instanceof Object) && (oldVal[isProxy])) {
						oldVal = null;
						val = buildData(val, {code: ((this.mask.code << 1) | 1), prop: prop});
					}

					var code = receiver[mask].code;
					while (code < (2 ** maxDeep)) {
						code = code << 1 | 1;
						
						if (bindReset[code]) storeProps = new Set(bindReset[code]);
					}
				}

				const result = Reflect.set(target, prop, val, receiver);

				if (skeepProxySetFlag) return result;

				if (storeProps) storeProps.forEach(h => h());

				/*var storeProps = bindReset.get(receiver);
				var tmp = null;

				if (storeProps)
					storeProps.forEach(el => {
					if (tmp = el2handlerBind.get(el)) tmp.res();
				});*/

				//if ((storeProps = bindUpd[receiver]) && (storeProps = storeProps[prop])) 
				//	storeProps.forEach((h, i) => i % 2 ? null : h());

				/*if (repeatStore.has(receiver)) {
					storeProps = new Set(repeatStore.get(receiver));
					repeatStore.delete(receiver);
					storeProps.forEach(el => {
						if (tmp = el2handlerRept.get(el)) tmp();
					});
				}*/

				return result;
			},
		});
	}

	return {
		buildData: obj => buildData(obj),

		bind: function (elSel, hndl, args = false) {
			function bindHandler(el, handler, arg = false) {
				const elm = getEl(el);

				needReadGetterFlag = true;
				elm.value = handler(arg) ?? null;
				needReadGetterFlag = false;

				addBind(() => elm.value = handler(arg) ?? null, () => bindHandler(el, handler, arg), elm);

				var src = Object.assign(Object.create(null), currentObjProp);

				const eventHandler = event => src.obj[src.prop] = event.currentTarget.value ?? null;
				elm.removeEventListener('change', el2eventHandler.get(elm));
				el2eventHandler.set(elm, eventHandler);
				elm.addEventListener('change', eventHandler);
			}

			return bindHandler(elSel, hndl, args);
		},

		repeat: function (el, iterHandle, bindHandle) {
			var elmObj = getEl(el);

			function handler(elm, iterHndle, bindHndle, updGroup = null) {
				needReadGetterFlag = true;
				var iter = iterHndle();
				needReadGetterFlag = false;

				var group = Object.create(null);

				addRepeat(() => handler.call(this, elm, iterHndle, bindHndle, group), elm, group);

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

			return handler.call(this, elmObj, iterHandle, bindHandle);
		},

		unbind: _unbind,
	};
})();