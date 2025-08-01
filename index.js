var App = new (function () {
	function getEl (el)  {
		if (el instanceof Element) 
			return el;
		else
			return document.querySelector(el);
	};

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

	function addBind(handler, resHandler, el) {
		let story = Object.create(null);
		story.upd = handler;
		story.res = resHandler;
		
		el2handlerBind.set(el, story);

		parents.get(currentObjProp.obj).forEach(function (obj) {
			const story = bindReset.get(obj);
			if (story)
				story.add(el);
			else
				bindReset.set(obj, (new Set()).add(el))
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

	function addRepeat(handler, el, group) {
		el2handlerRept.set(el, handler);
		El2group.set(el, group);

		const insertHandler = function (obj) {
			const story = repeatStore.get(obj);

			if (story)
				story.add(el);
			else
				repeatStore.set(obj, (new Set()).add(el));
		}

		insertHandler(currentObjProp.obj[currentObjProp.prop]);
		parents.get(currentObjProp.obj[currentObjProp.prop]).forEach(insertHandler);
	}

	function _unbind(el, onlyBind = false) {
		const elm = getEl(el);

		el2handlerBind.delete(elm);

		el.value = null;

		if (onlyBind) return;

		el2handlerRept.delete(elm);

		const group = El2group.get(elm);
		if (group) {
			Object.values(group).forEach(function(el) {el.remove()});
			elm.hidden = false;
		};
	}

	var needReadGetterFlag  = false;
	var skeepProxySetFlag   = false;

	function buildData (obj, prnt = null) {
		return new Proxy(obj, {
			get: function (target, prop, receiver) {
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

			set: function (target, prop, val, receiver) { 
				if ((!skeepProxySetFlag) && (val instanceof Object)) {
					var oldVal = receiver[prop];// new WeakRef ?

					if ((oldVal instanceof Object) && (oldVal[isProxy])) {
						oldVal = null;
						val = buildData(val, target);
					}
				}

				const result = Reflect.set(target, prop, val, receiver);

				if (skeepProxySetFlag) return result;

				var storeProps = bindReset.get(receiver);
				var tmp = null;

				if (storeProps) storeProps.forEach(function (el) {if (tmp = el2handlerBind.get(el)) tmp.res();});

				if ((storeProps = bindUpd.get(receiver)) && (storeProps = storeProps[prop])) 
					storeProps.forEach(function (el) {if (tmp = el2handlerBind.get(el)) tmp.upd();});

				if (repeatStore.has(receiver)) {
					storeProps = new Set(repeatStore.get(receiver));
					repeatStore.delete(receiver);
					storeProps.forEach(function (el) {if (tmp = el2handlerRept.get(el)) tmp();});
				}

				return result;
			},

			deleteProperty: function(target, prop) {
				var obj = null;
				var store = null;

				if (target[prop] instanceof Object) {
					if (target[prop][isProxy]) {
						if (obj = parents.get(target[prop])) 
							obj = obj.keys().next().value;
					}
				} else
					obj = obj2prox.get(target);

				if (store = repeatStore.get(obj))
					store.forEach(function (el) {_unbind(el)});

				if (store = bindReset.get(obj))
					store.forEach(function (el) {_unbind(el, true)});
				
				if ((store = bindUpd.get(obj)) && (store = store[prop]))
					store.forEach(function (el) {_unbind(el, true)});
				
				return Reflect.deleteProperty(target, prop);
			},
		});
	}

	return {
		buildData: function (obj) {
			return buildData(obj, null);
		},

		bind: function (elSel, hndl, args = false) {
			function callback(val, el, src) {
				return src.obj[src.prop] = val;
			};

			function handler(el) {
				return el.value = hndl(args);
			};

			return this.xrBind(elSel, handler, callback, true);
		},

		xrBind: function (el, handler, callback, __needCurrObj = false) {
			const elm = getEl(el);

			needReadGetterFlag = true;
			handler(elm);
			needReadGetterFlag = false;

			var cObjProp = null;
			if (__needCurrObj)
				cObjProp = Object.assign(Object.create(null), currentObjProp);

			addBind(handler.bind(this, elm), this.xrBind.bind(this, el, handler, callback, __needCurrObj), elm);

			const eventHandler = function (event) {
				return callback(event.currentTarget.value, event.currentTarget, cObjProp);
			};
			elm.removeEventListener('change', el2eventHandler.get(elm));
			el2eventHandler.set(elm, eventHandler);
			elm.addEventListener('change', eventHandler);
		},

		repeat: function (el, iterHandle, bindHandle) {
			var elmObj = getEl(el);

			function handler(elm, iterHndle, bindHndle, updGroup = null) {
				needReadGetterFlag = true;
				var iter = iterHndle();
				needReadGetterFlag = false;

				var group = Object.create(null);

				addRepeat(handler.bind(this, elm, iterHndle, bindHndle, group), elm, group);

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

				keys.forEach( function (key) {
					group[key] = document.querySelector(`[__key="${key}"]`);

					if (bindHandle) this.bind(group[key], bindHndle, key);
				}, this);

				keys = null;
			}

			return handler.call(this, elmObj, iterHandle, bindHandle);
		},

		unbind: _unbind,
	};
})();