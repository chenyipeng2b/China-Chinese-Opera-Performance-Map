/* ============================================
   跨浏览器 Polyfill（兼容 iOS Safari 9+、Android 4.4+）
   ============================================ */

// Element.closest()
if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

// Element.matches()
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// NodeList.forEach polyfill
if (window.NodeList && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}

// Array.from polyfill
if (!Array.from) {
  Array.from = function(arrayLike, mapFn, thisArg) {
    var arr = [];
    var len = arrayLike.length || 0;
    for (var i = 0; i < len; i++) {
      var val = arrayLike[i];
      arr.push(mapFn ? mapFn.call(thisArg, val, i) : val);
    }
    return arr;
  };
}

// String.prototype.includes polyfill
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    return this.indexOf(search, start || 0) !== -1;
  };
}

// Array.prototype.includes polyfill
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement, fromIndex) {
    var O = Object(this);
    var len = parseInt(O.length) || 0;
    if (len === 0) return false;
    var n = parseInt(fromIndex) || 0;
    var k;
    if (n >= 0) k = n;
    else { k = len + n; if (k < 0) k = 0; }
    while (k < len) {
      var currentElement = O[k];
      if (searchElement === currentElement || (searchElement !== searchElement && currentElement !== currentElement)) return true;
      k++;
    }
    return false;
  };
}

// Object.assign polyfill
if (!Object.assign) {
  Object.assign = function(target) {
    if (target === null || target === undefined) throw new TypeError('Cannot convert undefined or null to object');
    var to = Object(target);
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      if (source !== null && source !== undefined) {
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) to[key] = source[key];
        }
      }
    }
    return to;
  };
}
