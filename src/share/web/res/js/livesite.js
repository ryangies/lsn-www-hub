/**
 * @class ECMAScript
 *
 * Package definition and extension manager for ECMA scripts. This 
 * implementation considers each package to be an instantiable component
 * that is provided a pointer back to the library instance for which it is 
 * being created.  The intentions are to:
 *
 * 1. Provide management which enables one to division their code into logical
 * packages and avoid clobbering global variables.
 *
 * 2. Scope the C<window> and C<document> objects such that one may instantiate
 * the library to act upon a child window, i.e., an IFRAME, without changing
 * its dependencies nor incurring the cost of additional HTTP connections to
 * script files.
 *
 * Packages may contain local private variables, classes, and functions. 
 * Namespaces are extendable, allowing the end product to avoid naming 
 * collisions. Each library instance may operate upon separate window and 
 * document objects.
 * 
 * The ECMAScript package contains minimal code, just enough to provide:
 *
 * 1. A method for creating and extending namespaces with your own packages:
 *
 *  L<ECMAScript.Extend>('namespace', package);
 *
 * 2. A way to create new library instances which act upon target windows and 
 * their documents:
 *
 *  var js = new L<ECMAScript.Class>(window, document);
 *
 * ECMAScript does not implement any namespaces itself and can be used to build
 * a library from the ground up.
 *
 */

var ECMAScript = {

  Name: "Livesite ECMAScript",

  Version: .014,

  Copyright: "Livesite (c) Livesite Networks, LLC 2006-2013.",

  /**
   * @function About
   *
   * About message is a semi-colon delimited string of informational fields,
   * which take the form:
   *
   *  <name>;<version>;<packages>
   *
   * Where:
   *
   *  <name>        Common name for this library
   *  <version>     Numeric version to three decimal places
   *  <packages>    Comma-delimited string of package namespaces
   *
   * Example output:
   *
   *  ECMAScript;0.004;lang,util,crypt,console,data,http,dom
   */

  About: function () {
    var names = {};
    for (var i = 0; i < ECMAScript.Packages.length; i++) {
      var def = ECMAScript.Packages[i];
      var ns = def.namespace;
      var idx = ns.indexOf('.');
      var name = idx > 0 ? ns.substr(0, idx) : ns;
      names[name] = true;
    }
    var pkgs = [];
    for (var ns in names) {
      pkgs.push(ns);
    }
    return [this.Name, this.Version, pkgs.sort().join(',')].join(';');
  },

  /**
   * Packages
   * Internal registry of packages.
   */

  Packages: [],

  /**
   * Instances <ECMAScript.Class>
   * Internal array of ECMAScript.Class instances.
   *
   * Instance references are collected here so that they may be updated when
   * the library is extended after their creation.
   *
   * For instance:
   *
   *  var js = new ECMAScript.Class(window, document);
   *  
   *  ECMAScript.Extend('util', function (ecma) {
   *    ...
   *  });
   *
   *  // js is automatically extended
   *
   */

  Instances: [],

  /**
   * @function Extend
   * Extend (or define) a top-level ECMAScript namespace, i.e., extend the
   * library by either adding to or creating a package.  Extensions will be
   * applied to all running instance, allowing one load additional packages
   * on demand.
   *
   *  @param namespace    <String>    e.g., 'util', 'com', 'org.gnu'
   *  @param constructor  <Function>  See "Package Constructor Function" below
   *
   =  ECMAScript.Extend('util', function (ecma) {         // namespace 'util'
   =   
   =    this.say = function (message) {                   // public function
   =      alert(message);
   =    }
   =
   =  });
   *
   * The code above specifies the namespace 'util' which is extended (or 
   * defined if it has not been). This function is now available as:
   *
   *  js.util.say('Hello World');
   *
   # Package Constructor Function
   * 
   * The package constructor function is passed a reference to the library 
   * instance L<ECMAScript.Class> which is creating it.
   *
   * Rather than using function prototypes, the package constructor function
   * defines its methods in the function body.  This creates closures which
   * brings the current ECMAScript library instance (arguments[0]) in to scope
   * and also allows the package to have private member variables.
   *
   *  ECMAScript.Extend('util', function (ecma) {
   * 
   *    var _err = "Message is undefined";                // private var
   *
   *    this.say = function (message) {
   *      if (!message) {
   =        ecma.console.log(_err);                       // ecma is used
   *      } else {
   *        alert(message);
   *      }
   *    };
   *
   *  });
   * 
   * This constructor pattern is necessary for scoping, i.e., allowing access to the
   * current ECMAScript library instance.  Creating these closures does not 
   * create a critical memory hole because these are singleton packages in
   * respect to the number of running documents.
   */

  Extend: function (ns, func) {

    /* avoid confusion */
    ns = ns.toLowerCase();

    /* fail when choosing a clobbering namespace */
    for (var n in ECMAScript.Class.prototype) {
      if (ns == n) throw new Error('illegal name-space name: ' + ns);
    }

    /* extend the package definition */
    var def = {
      'namespace': ns,
      'constructor': func
    };
    ECMAScript.Packages.push(def);

    /* extend any existing instances */
    for (var i = 0; i < ECMAScript.Instances.length; i++) {
      ECMAScript.Instances[i].extend(ns, func);
    }

  },

  /**
   * @class ECMAScript.Class
   * Construct a new library instance.
   *
   *  @param window   <HTMLWindowElement>   Only requried/used with HTML-DOM JavaScript
   *  @param document <HTMLDocumentElement> Only requried/used with HTML-DOM JavaScript
   *
   *  var js = new ECMAScript.Class(window, document);
   */

  Class: function (win, doc) {

    /* scope global variables */
    this.window = win;
    this.document = doc;
    this.id = 'ecma' + Math.floor(Math.random()*100000);

    /* create each new package with the current scope */
    for (var i = 0; i < ECMAScript.Packages.length; i++) {
      var def = ECMAScript.Packages[i];
      this.extend(def.namespace, def.constructor);
    }

    /* allow subsequent library extentions to update this runtime */
    ECMAScript.Instances.push(this);

  }

};

/**
 * Library instance
 */

ECMAScript.Class.prototype = {

  /**
   * Target window object.
   */

  window: null,

  /**
   * Target document object
   */

  document: null,

  /**
   * @function extend
   * Either create or extend this instance with the given package constructor.
   *
   *  this.extend(ns, func);
   *
   *  ns    namespace
   *  func  package constructor function
   */

  extend: function (ns, func) {
    var nses = ns.split('.');
    var name = nses.pop();
    var inst = this;
    for (var i = 0, seg; seg = nses[i]; i++) {
      if (!inst[seg]) inst[seg] = {};
      inst = inst[seg];
    }
    if (inst[name]) {
      func.apply(inst[name], [this]);
    } else {
      inst[name] = new func(this);
    }
  }

};

/**
 * @namespace lang
 * ECMA language.
 */

ECMAScript.Extend('lang', function (ecma) {

  /**
   * @function createPrototype
   * Return an instance of a proxied constructor.
   *
   * Allows one to use the basic ECMAScript inheritance model without
   * calling the base class' constructor.
   *
   *  var BaseClass = function () { ... };
   *  var MyClass = function () { ... };
   *  MyClass.prototype = js.lang.createPrototype(BaseClass);
   *
   * Also implements a multiple inheritence model.  With single inheritence,
   * the C<instanceof> operator will work as expected.  With multiple
   * inhertience, only the first base class is recognized.  As such,
   * L<ecma.util.isa> must be used to intergate all bases.
   *
   *  var BaseClass1 = function () { ... };
   *  var BaseClass2 = function () { ... };
   *  var MyClass = function () { ... };
   *  MyClass.prototype = js.lang.createPrototype(BaseClass1, BaseClass2);
   *  var myObj = new MyClass();
   *  ecma.lang.assert(myObj instanceof BaseClass1);        // Okay
   *  ecma.lang.assert(myObj instanceof BaseClass2);        // Wrong
   *  ecma.lang.assert(ecma.util.isa(myObj, BaseClass2));   // Correct
   *
   * When a duplicate base class is detected it will be ignored. For instance:
   *
   *  var A = function () {};
   *  A.prototype = ecma.lang.createPrototype();
   *
   *  var B = function () {};
   *  B.prototype = ecma.lang.createPrototype(A);
   *
   *  var C = function () {};
   *  C.prototype = ecma.lang.createPrototype(B, A);  // A is ignored
   *
   * However this only works when the methods have not yet been overlayed on to
   * the final prototype. For example:
   *
   *  var C = function () {};
   *  C.prototype = ecma.lang.createPrototype(A, B);  // A is NOT ignored
   *
   * In the above A is first integrated, then B comes along. However B is
   * already a composite which includes A's methods. TODO Scan B to see if it 
   * isa A, then prune A if so.
   *
   */


  /**
   * @private:function _cchain
   * Extract all constuctors and their underlying constructors.
   */

  function _cchain (ctors, result, depth) {
    if (depth > 100) {
      throw new Error('Deep recursion while exctracting constructors');
    }
    for (var i = 0; i < ctors.length; i++) {
      var ctor = ctors[i];
      if (typeof(ctor) != 'function') {
        throw new Error ('Constructor is not a function');
      }
      for (var j = 0; j < result.length; j++) {
        if (result[j] === ctor) {
          ctor = null;
          break;
        }
      }
      if (!ctor) continue;
      if (ctor.prototype.__constructors__) {
        _cchain(ctor.prototype.__constructors__, result, ++depth);
      }
      if (ctor) result.push(ctor);
    }
    return result;
  }

  this.createPrototype = function (ctor) {
    var methods = null;
    if (!arguments.length) {
      // No inheritence
      methods = new Object();
    } else {
      var ctors = _cchain(arguments, [], 0);
      for (var i = 0, ctor; ctor = ctors[i]; i++) {
        var Class = function () {};
        Class.prototype = ctor.prototype;
        if (methods) {
          var stub = new Class();
          for (var k in stub) {
            if (k == '__constructors__') continue;
            methods[k] = stub[k];
          }
        } else {
          methods = new Class(); // call new to comply with instanceof
        }
      }
      methods.__constructors__ = ctors;
    }
    return methods;
  };

  /**
   * @function hasMethods
   *
   * Test a given object for the presence of member functions. This is
   * related to supporting an interface.
   *
   *  @param obj <Object> That which is to be queried
   *  @param methods <Array> Names of members which must be functions
   *
   * Example:
   *
   *  var obj = new Object();
   *  ecma.lang.hasMethods(obj, ['toString', 'hasOwnProperty']); // returns true
   *  ecma.lang.hasMethods(obj, ['apply', 'toString']); // returns false
   */

  this.hasMethods = function (obj, methods) {
    ecma.lang.assert(ecma.util.isArray(methods));
    ecma.lang.assert(ecma.util.isObject(obj));
    for (var i = 0; i < methods.length; i++) {
      var methodName = methods[i];
      if (!methodName in obj || typeof(obj[methodName]) != 'function') {
        return false;
      }
    }
    return true;
  };

  /**
   * @function createConstructor
   * Wrapper which calls the class' construct function.
   *
   * A class' constructor function should not be a member of its prototype
   * if you want it to be a base-class of a multiply-inhertited sub-class.
   *
   * Example:
   *
   *  CAlpha = ecma.lang.createConstructor();
   *  CAlpha.prototype = {
   *    construct: function (arg1) {
   *      this.value = arg1;
   *    },
   *    toString: function () {
   *      return '[A] ' + this.value;
   *    }
   *  };
   *
   *  CBravo = ecma.lang.createConstructor(CAlpha);
   *  CBravo.prototype.toString = function () {
   *    return '[B] ' + this.value;
   *  };
   */

  this.createConstructor = function () {
    var c = function Constructor () {
      if (this.construct) this.construct.apply(this, arguments);
    };
    c.prototype = ecma.lang.createPrototype.apply(this, arguments);
    return c;
  };

  /**
   * @function createObject
   *
   * Creates a new instance of the specified class.  Behaves as C<apply> does,
   * i.e., passing the C<args> array as arguments to the class constructor.
   *
   * @param klass <Function> Constructor function
   * @param args <Array> Arguments
   *
   *  function Point2D (x, y) {
   *    this.x = x;
   *    this.y = y;
   *  };
   *
   *  function Point3D (x, y, z) {
   *    this.x = x;
   *    this.y = y;
   *    this.z = z;
   *  };
   *
   *  function createPoint () {
   *    if (arguments.length == 3)
   *      return ecma.lang.createObject(Point3D, arguments);
   *    if (arguments.length == 2)
   *      return ecma.lang.createObject(Point2D, arguments);
   *    throw new Exception();
   *  }
   */

  this.createObject = function (klass, args) {
    var ctor = function () {};
    ctor.prototype = klass.prototype;
    var obj = new ctor();
    klass.apply(obj, args || []);
    return obj;
  };

  /**
   * @function createCallback
   * Create a callback function.
   *
   * @param func <Function> to call back
   * @param scope <Scope> to apply the callback
   * @param args <Array> (optional) arguments which will be passed *after* the caller's.
   *
   *  var cb = ecma.lang.createCallback(this.refresh, this, [arg1, arg2]);
   *
   * Note that window.setTimeout and window.setInterval pass the number of
   * seconds late as the first argument.  To avoid this, use L<ecma.dom.setTimeout>
   * and L<ecma.dom.setInterval>.
   */

  this.createCallback = function () {
    var cbarr = ecma.lang.createCallbackArray.apply(null, arguments);
    var func = cbarr[0];
    var scope = cbarr[1];
    var args = cbarr[2];
    return function () {
      var argx = ecma.util.args(arguments);
      return func.apply(scope || this, argx.concat(args));
    }
  };

  /**
   * @function createCallbackArray
   * Create a callback array.
   *
   *  [func, scope, args] = ecma.lang.createCallbackArray(func, scope, args);
   *
   * This method unwraps C<func> when it is already a callback array.
   *
   * See L<ecma.lang.callback>
   */

  this.createCallbackArray = function (func, scope, args) {
    if (!args) args = [];
    if (!func) throw new Error('Missing callback function (or array)');
    // Note, ecma.util.isArray is not used, as it (more specifically 
    // `Array.isArray`) will return false when func is an `arguments` object.
    if (typeof(func) != 'function' && func.length) {
      if (func[2]) args = args.concat(func[2]);
      scope = func[1] || scope;
      func = func[0];
    }
    return [func, scope, args];
  }

  /**
   * @function callback
   * Apply a callback function.
   *
   *  var result = ecma.lang.callback(func);
   *  var result = ecma.lang.callback(func, scope);
   *  var result = ecma.lang.callback(func, scope, args);
   *
   * @param func    <Function|Array> Callback function L<1>
   * @param scope   <Object> Default scope
   * @param args    <Array> Arguments L<2>
   *
   * N<1> When C<func> is an array, it is taken to conform to this standard
   * structure:
   *
   *  func[0]       <Function>  Callback function
   *  func[1]       <Object>    Scope (optional) L<2>
   *  func[2]       <Array>     Arguments (optional) L<3>
   *
   * This allows one to pass around callbacks as arrays, then use this method to
   * apply them.
   *
   * N<2> If the inner scope is not defined, the outer is used.
   *
   * N<3> The parameters in the outer C<args> array precede those in the inner
   * C<func> array should C<func> be an array.  This is done as the inner
   * arguments are caller-defined, and hence more variable.
   *
   # Example
   *
   *  function MyClass () {};
   *  MyClass.prototype = {
   *    'run': function (cb) {
   *      // do something
   *      ecma.lang.callback(cb, this, [1, 2, 3]);
   *    }
   *  };
   *
   *  function onComplete () {
   *    for (var i = 0; i < arguments.length; i++) {
   *      ecma.console.log('arguments [' + i + '] = ' + arguments[i]);
   *    }
   *  }
   *
   *  var obj = new MyClass();
   #  obj.run([onComplete, this, ['a', 'b', 'c']])
   *
   * Will output:
   *
   *  arguments[0] = 1
   *  arguments[1] = 2
   *  arguments[2] = 3
   *  arguments[3] = a
   *  arguments[4] = b
   *  arguments[5] = c
   *
   * Additionally, the calling code could also:
   *
   #  obj.run(onComplete);
   *
   * Which would output:
   *
   *  arguments[0] = 1
   *  arguments[1] = 2
   *  arguments[2] = 3
   * 
   * Or, say it creates its own callback function:
   *
   *  var cb = ecma.lang.createCallback(onComplete, this, ['x', 'y']);
   #  obj.run(cb);
   *
   * Which would output:
   *
   *  arguments[0] = 1
   *  arguments[1] = 2
   *  arguments[2] = 3
   *  arguments[3] = x
   *  arguments[4] = y
   *
   */

  this.callback = function (func, scope, args) {
    var cbarr = ecma.lang.createCallbackArray(func, scope, args);
    return cbarr[0] ? cbarr[0].apply(cbarr[1], cbarr[2]) : undefined;
  };

  /**
   * @function assert
   * Throw an exception if expression is false.
   */

  this.assert = function (expression, msg) {
    if (expression) return;
    if (!msg) msg = 'Assertion failed';
    var ex = new ecma.error.Assertion(msg);
    ecma.error.reportError(ex); // For good measure
    throw ex;
  };

  /**
   * @function createAbstractFunction
   * Creates a function which throws an exception when called.
   *  this.method = ecma.lang.createAbstractFunction();
   */

  this.createAbstractFunction = function () {
    return function () {
      throw new Error('Abstract function not implemented');
    };
  };

  /**
   * @function createProxyFunction
   *
   *  real = {
   *    'invoke': function () { },
   *    'toString': function () { }
   *  };
   *
   *  facade = {};
   *
   *  // Create entries in facade which forward to real
   *  js.lang.createProxyFunction('invoke', facade, real);
   *  js.lang.createProxyFunction('toString', facade, real);
   *
   *  // Or, pass all function names at once
   *  js.lang.createProxyFunction(['invoke', 'toString'], facade, real);
   *
   */

  this.createProxyFunction = function (name, fromObject, toObject) {
    if (ecma.util.isArray(name)) {
      var result = [];
      for (var i = 0; i < name.length; i++) {
        result.push(
          ecma.lang.createProxyFunction(name[i], fromObject, toObject)
        );
      }
      return result;
    }
    return fromObject[name] = function Proxy () {
      return toObject[name].apply(toObject, arguments);
    };
  };

});

/** @namespace lang */

ECMAScript.Extend('lang', function (ecma) {

  /**
   * @deprecated Constructor (Use ecma.lang.createConstructor)
   * @deprecated Callback (Use ecma.lang.createCallback)
   * @deprecated Methods (Use ecma.lang.createPrototype)
   * @deprecated createMethods (Use ecma.lang.createPrototype)
   */

  this.Constructor = ecma.lang.createConstructor;
  this.Callback = ecma.lang.createCallback;
  this.Methods = ecma.lang.createPrototype;
  this.createMethods = ecma.lang.createPrototype;

});

/** @namespace impl */
ECMAScript.Extend('impl', function (ecma) {

  /** @class Parameters
   */

  this.Parameters = function CParameters (initialParameters) {
    this.parameters = initialParameters
      ? js.util.clone(initialParameters)
      : new Object();
  };

  var Parameters = this.Parameters.prototype = ecma.lang.createPrototype();

  /**
   * @function getParameter
   * Return a single parameter value.
   */

  Parameters.getParameter = function (key) {
    return this.parameters[key];
  };

  /**
   * @function setParameter
   * Set a single parameter value.
   */

  Parameters.setParameter = function (key, value) {
    return this.parameters[key] = value;
  };

  /**
   * @function getParameters
   * Return the underlying object.
   */

  Parameters.getParameters = function () {
    return this.parameters;
  };

  /**
   * @function setParameters
   * Set the underlying object.
   */

  Parameters.setParameters = function (parameters) {
    return this.parameters = js.util.clone(parameters);
  };

  /**
   * @function overlayParameters
   * Overlay the provided parameters on to the underlying object.
   */

  Parameters.overlayParameters = function (parameters) {
    ecma.util.overlay(this.parameters, parameters);
    return this.parameters;
  };

});

/** @namespace impl */
ECMAScript.Extend('impl', function (ecma) {

  /** @class Options
   */

  this.Options = function COptions (initialOptions) {
    this.options = this.options
      ? this.overlayOptions(initialOptions) // Multiple inhertance
      : js.util.clone(initialOptions);
  };

  var _proto = this.Options.prototype = ecma.lang.createPrototype();

  /**
   * @function getOption
   * Return a single option value.
   */

  _proto.getOption = function (key) {
    return this.options[key];
  };

  /**
   * @function setOption
   * Set a single option value.
   */

  _proto.setOption = function (key, value) {
    if (key in this.options) {
      return this.options[key] = value;
    } else {
      throw new Error('Not an option:' + key);
    }
  };

  /**
   * @function getOptions
   * Return the underlying object.
   */

  _proto.getOptions = function () {
    return this.options;
  };

  /**
   * @function setOptions
   * Set the underlying object.
   */

  _proto.setOptions = function (options) {
    return this.options = js.util.clone(options);
  };

  /**
   * @function overlayOptions
   * Overlay the provided options on to the underlying object.
   */

  _proto.overlayOptions = function (options) {
    ecma.util.overlay(this.options, options);
    return this.options;
  };

});

/**
 * @namespace util
 * Common utility functions.
 */

ECMAScript.Extend('util', function (ecma) {

  var _toString = Object.prototype.toString;

  /**
   * @function isDefined
   * @function defined
   * Return true unless the variable type is 'undefined'
   *  @param variable
   */

  this.isDefined =
  this.defined = function (unk) {
    return  unk === null                ? false :
            typeof(unk) === 'undefined' ? false :
                                          true;
  };

  /**
   * @function firstDefined
   * Return the first defined agument.
   */

  this.firstDefined = function (unk) {
    for (var i = 0; i < arguments.length; i++) {
      var unk = arguments[i];
      if (unk !== null && typeof(unk) !== 'undefined') {
        return unk;
      }
    }
  };

  /**
   * @function isa
   * Is the unkown an instance of (or derived from) this class
   *
   *  isa(unk, klass);
   *
   * @param unk     <Any>           The unknown
   * @param klass   <Function>      The constructor class
   *
   * Objects with multiple inheritence created using the function
   * L<ecma.lang.createPrototype> will have a prototype member named
   * C<__constructors__>, which will be inspected if it exists.
   */

  this.isa = function (unk, klass) {
    try {
      if (!unk) return false;
      if (unk instanceof klass) return true;
      var ctors = unk.__constructors__;
      if (ctors) {
        for (var i = 0, ctor; ctor = ctors[i]; i++) {
          if (ctor === klass) return true;
        }
      }
    } catch (ex) {
      return false;
    }
    return false;
  };

  /**
   * @function isString
   * Is the unknown a string?
   */

  this.isString = function (unk) {
    return _toString.call(unk) == '[object String]';
  };

  /**
   * @function isObject
   * Is the unknown a JavaScript object?  Note that arrays are objects.
   *
   *  isObject(unk)
   *
   * @param unk <Any> The unknown
   */

  this.isObject = function (unk) {
    return unk && unk.constructor && typeof(unk) == 'object';
  };

  /**
   * @function isFunction
   * Is the unknown a JavaScript function?
   *
   *  bool = ecma.util.isFunction(unk);
   *
   * @param unk <Any> The unknown
   */

  this.isFunction = function (unk) {
    return unk && _toString.call(unk) == '[object Function]';
  };

  /**
   * @function isCallback
   * Is the unknown a callback function which can be used by C<ecma.lang.callback>?
   *
   *  bool = ecma.util.isCallback(unk);
   *
   * @param unk <Any> The unknown
   */

  this.isCallback = function (unk) {
    return ecma.util.isFunction(unk) ||
      (ecma.util.isArray(unk) && ecma.util.isFunction(unk[0]));
  };

  /**
   * @function isArray
   * Is the unknown a pure JavaScript array?
   *
   *  isArray(unk)
   *
   * @param unk <Any> The unknown
   */

  // Array.isArray was introducted in JavaScript 1.8.5
  this.isArray = Array.isArray || function (unk) {
    return _toString.call(unk) == '[object Array]';
  };

  /**
   * @function isNumber
   * Is the unknown a `Number`?
   * @param unk <Any> The unknown
   */

  this.isNumber = function (unk) {
    return typeof(unk) == 'number';
  }

  /**
   * @function isDate
   * Is the unknown a `Date`?
   * @param unk <Any> The unknown
   */

  this.isDate = function (unk){
    return _toString.call(unk) == '[object Date]';
  }

  /**
   * @function isAssociative
   * Is the unknown an associative array?  Meaning an object which is not
   * an array.
   *
   *  isAssociative(unk)
   *
   * @param unk <Any> The unknown
   */

  this.isAssociative = function (unk) {
    if (!ecma.util.isObject(unk)) return false;
    return unk.__constructors__
      ? true
      : !ecma.util.isArray(unk);
  };

  /**
   * @function args
   * Create an Array comprised of Function.arguments elements.
   *  @param args arguments object
   */

  this.args = function (args) {
    if (!args) return [];
    var len = args.length || 0;
    var result = new Array(len);
    while (len--) result[len] = args[len];
    return result;
  };

  /**
   * @function use
   * Export variables into the given namespace.
   *  ecma.util.use(object, object);
   * For example:
   *  ecma.util.use(this, ecma.dom.constants);
   * Would make the L<ecma.dom.constants> available as C<this.____>.
   */

  this.use = function () {
    var args = this.args(arguments);
    var scope = args.shift();
    for (var i = 0; i < args.length; i++) {
      var ns = args[i];
      for (var name in ns) {
        if (ecma.util.defined(scope[name])) {
          throw new Error("'" + name + "' is already defined in this scope: " + scope);
        }
        scope[name] = ns[name];
      }
    }
  };

  /**
   * @function evar
   * Evaluate a variable.
   *
   *  var href = evar('document.location.href');
   *  var href = evar('this.location.href', document); // with scope
   *
   * Convenience method which eats the traversal exceptions which occur while
   * accessing the value.
   *
   * This line:
   *    evar('document.documentElement.clientWidth');
   * is eqivalent to:
   *    document.documentElement ? this.doc.documentElement.clientWidth : undefined;
   */

  this.evar = function (unk, scope) {
    if (!unk || typeof(unk) != 'string') throw new Error('Provide a String');
    if (!unk.match(/[A-Za-z_\$][A-Za-z_\$\.0-9]+/)) throw new Error('Illegal object address');
    var result = undefined;
    try {
      if (scope) {
        var func = function () { return eval(unk); }
        result = func.apply(scope, []);
      } else {
        result = eval(unk);
      }
    } catch (ex) {
      // An exception indicates the value is not defined
      return null;
    }
    return result;
  };

  /**
   * @function asInt
   * Integer representation of the provided unkown
   *
   *  @param unk The unknown
   *  @param gez true|false, only return a value greater-than or equal to zero
   *
   = NaN is returned as 0.
   = When 'gez' is in effect, negative numbers are returned as 0.
   */

  this.asInt = function (unk, gez) {
    var i = unk;
    if (typeof(unk) == 'string') {
      i = parseInt(unk.replace("\w", ""));
    } else {
      i = parseInt(unk);
    }
    return isNaN(i) ? 0 : gez && i < 0 ? 0 : i;
  };

  /**
   * @function randomId
   * Produce a random identifier.
   * 
   *  var id = randomId(); // id is ~ 8234
   *  var id = randomId('tbl_'); // id is ~ tbl_8234
   *  var id = randomId('tbl_', 100); // id is ~ tbl_82 (no greater than 99)
   *
   *  @param prefix
   *  @param multiplier (default 100,000)
   */

  this.randomId = function (prefix, multiplier) {
    if (!multiplier) multiplier = 100000;
    var w = new String(multiplier).length;
    var n = ecma.util.pad(Math.floor(Math.random()*multiplier), w);
    return prefix ? prefix + n : n;
  };

  /**
   * @function incrementalId
   * Produce an incremented identifier for a given prefix.
   *
   *  var id = ecma.util.incrementalId(prefix, width);
   *
   * Where:
   *
   * @param id    <String> Identifier prefix (and key)
   * @param width <Number> Number width, zero padded (optional)
   *
   * Identifiers begin at 1.
   *
   * Example:
   *
   *  var id1 = ecma.util.incrementalId('foo');
   *  var id2 = ecma.util.incrementalId('foo');
   *  var id3 = ecma.util.incrementalId('foo', 3);
   *
   *  foo1
   *  foo2
   *  foo003
   */

  var _incrementalIdMap = new Object();

  this.incrementalId = function (prefix, width) {
    var idx = _incrementalIdMap[prefix];
    idx = _incrementalIdMap[prefix] = idx == null ? 1 : idx + 1;
    return width ? prefix + ecma.util.pad(idx, width) : prefix + idx;
  };

  /**
   * @function rand4
   *
   * Create a 4-character hex identifier. For example:
   *
   *  96df
   *
   * See also L<rand8>
   * See also L<createUUID>, aka L<createGUID>.
   */

  var rand4 =
  this.rand4 = function () {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };

  /**
   * @function rand8
   *
   * Create an 8-character hex identifier. For example:
   *
   *  6ebeaca4
   *
   * See also L<createUUID>, aka L<createGUID>.
   */

  this.rand8 = function () {
    return rand4() + rand4();
  };

  /**
   * @function createUUID
   * @function createGUID
   *
   * Create a 36-character hex identifier. For example:
   *
   *  6ebeaca4-96df-b9d1-331f-c07fa13d7167
   */

  this.createUUID =
  this.createGUID = function () {
    return [
      rand4() + rand4(),
      rand4(),
      rand4(),
      rand4(),
      rand4() + rand4() + rand4()
    ].join('-');
  };

  /**
   * @function pad
   * Return a padded string of the specified width.
   *
   *  var str = ecma.util.pad(src, width);
   *  var str = ecma.util.pad(src, width, chr);
   *  var str = ecma.util.pad(src, width, chr, rtl);
   *
   * Where:
   *
   *  @param src <String|Number> The source value to pad
   *  @param width <Number> The desired width (1 < width < 100)
   *  @param chr <String> The padding character (default is 0)
   *  @param rtl <Boolean> Right-to-left? (default is false)
   *
   * If the source length is greater than the specified width, it is returned
   * without modification.
   *
   * For example:
   *
   *  ecma.util.pad('a', 3);              // 00a
   *  ecma.util.pad('a', 3, '-');         // --a
   *  ecma.util.pad('a', 3, '-', true);   // a--
   */

  this.pad = function (src, width, chr, rtl) {
    if (!chr) chr = '0';
    if (!rtl) rtl = false;
    if (width > 100) throw new ecma.error.IllegalArg('width');
    if (width < 1) throw new ecma.error.IllegalArg('width');
    if (chr.length != 1) throw new ecma.error.IllegalArg('chr');
    var len = new String(src).length;
    if (len > width) return src;
    var result = rtl ? '' + src : '';
    for (var i = len; i < width; i++) {
       result += chr;
    }
    return rtl ? result : result + src;
  };

  /**
   * @function grep
   * Return an array of matching items.
   *  var result = grep (value, list);
   *  var result = grep (function, list);
   *
   * Example using match function:
   *
   *  function isPrime (num) { ... }
   *  var primes =  grep (isPrime, [1, 2, 3, 4]);
   *
   * Example using match value:
   *
   *  var value =  grep ('abc', ['abc', 'def', 'ghi']);
   */

  this.grep = function (target, a) {
    if (!a || !ecma.util.defined(a.length)) return null;
    var result = [];
    var func = target instanceof Function
      ? target
      : function (a) {return a == target;};
    for (var i = 0; i < a.length; i++) {
      if (func(a[i])) result.push(a[i]);
    }
    return result.length > 0 ? result : null;
  };

  /**
   * @function overlay
   * Recursively copy members of one object to another by key.
   *  @param dest object
   *  @param src object
   *  @param ... more sources
   *
   *  var dest = {a:1};
   *  overlay(dest, {b:2}, {c:3});
   *  // dest is now {a:1, b:2, c:3}
   */

  this.overlay = function () {
    var args = ecma.util.args(arguments);
    var dest = args.shift();
    if (typeof(dest) != 'object') throw new Error('invalid argument');
    for (var i = 0; i < args.length; i++) {
      var src = args[i];
      if (!ecma.util.defined(src)) continue;
      if (typeof(dest) != typeof(src)) throw new Error('type mismatch');
      if (dest === src) continue;
      for (var k in src) {
        if (typeof(dest[k]) == 'function') {
          dest[k] = src[k];
        } else if (typeof(dest[k]) == 'object') {
          this.overlay(dest[k], src[k]);
        } else {
          dest[k] = src[k];
        }
      }
    }
    return dest;
  };

  /**
   * @function clone
   * Convenience method for overlaying properties into an empty object.
   */

  this.clone = function (arg1) {
    var args = ecma.util.args(arguments);
    if (typeof(arg1) != 'object') throw new Error('invalid argument');
    var obj = ecma.util.isAssociative(arg1) ? {} : [];
    args.unshift(obj);
    return ecma.util.overlay.apply(this, args);
  };

  /**
   * @function equals
   *
   * Derived from:
   *  @license AngularJS v1.0.4
   *  (c) 2010-2012 Google, Inc. http://angularjs.org
   *  License: MIT
   *
   */

  this.equals = function (arg1, arg2) {
    if (arg1 === arg2) return true;
    if (arg1 === null || arg2 === null) return false;
    if (arg1 !== arg1 && arg2 !== arg2) return true; // NaN === NaN
    var t1 = typeof arg1, t2 = typeof arg2, length, key, keySet;
    if (t1 == t2) {
      if (t1 == 'object') {
        if (ecma.util.isArray(arg1)) {
          if ((length = arg1.length) == arg2.length) {
            for(key=0; key<length; key++) {
              if (!ecma.util.equals(arg1[key], arg2[key])) return false;
            }
            return true;
          }
        } else if (ecma.util.isDate(arg1)) {
          return ecma.util.isDate(arg2) && arg1.getTime() == arg2.getTime();
        } else {
          // if (ecma.util.isWindow(arg1) || ecma.util.isWindow(arg2)) return false;
          keySet = {};
          for(key in arg1) {
            if (ecma.util.isFunction(arg1[key])) continue;
            if (!ecma.util.equals(arg1[key], arg2[key])) return false;
            keySet[key] = true;
          }
          for(key in arg2) {
            if (!keySet[key] &&
                arg2[key] !== undefined &&
                !ecma.util.isFunction(arg2[key])) return false;
          }
          return true;
        }
      }
    }
    return false;
  };

  /**
   * @function keys
   * Create an array of the Object's keys.
   *  @param obj <Object>
   */

  this.keys = function (obj) {
    if (!(obj instanceof Object)) return null;
    var result = [];
    for (var k in obj) {
      result.push(k);
    }
    return result;
  };

  /**
   * @function values
   * Create an array of the Object's values.
   *  @param obj <Object>
   */

  this.values = function (obj) {
    if (!(obj instanceof Object)) return null;
    var result = [];
    for (var k in obj) {
      result.push(obj[k]);
    }
    return result;
  };

  /**
   * @function step
   * Step carefully over each item in an array, applying the callback.
   *
   *  ecma.util.step(arr, func);
   *  ecma.util.step(arr, func, scope);
   *  ecma.util.step(arr, func, scope, args);
   *
   * The first parameter passed to C<func> is always the array item of the
   * current step.
   *
   * Exceptions which are thrown by C<func> are caught and stored in an array.
   * After all items have been stepped through, a L<ecma.error.Multiple>
   * exception is thrown if necessary.  This "safe-stepping" is the purpose
   * of this function.
   */

  this.step = function (arr, func, scope, args) {
    if (!ecma.util.isArray(arr)) throw new ecma.error.IllegalArg('arr');
    if (!ecma.util.isFunction(func)) throw new ecma.error.IllegalArg('func');
    if (!args) args = [];
    if (!ecma.util.isFunction(args.shift)) args = ecma.util.args(args);
    if (!ecma.util.isArray(args)) throw new ecma.error.IllegalArg('args');
    var errors = [];
    for (var i = 0; i < arr.length; i++) {
      try {
        args.unshift(arr[i]);
        func.apply(scope, args);
      } catch (ex) {
        ecma.error.reportError(ex);
        errors.push(ex);
      } finally {
        args.shift();
        continue;
      }
    }
    if (errors.length) {
      throw errors.length > 1
        ? new ecma.error.Multiple(errors)
        : errors[0];
    }
  };

  /**
   * @function associateArrays
   *
   * Create an object from two arrays
   *
   *  @param values <Array> Values for the object
   *  @param names <Array>  Names (or keys) for the object
   *
   * For example:
   *
   *  a1 = ['Alpha', 'Bravo', 'Charlie'];
   *  a2 = ['a', 'b', 'c'];
   *  o = ecma.util.associateArrays(a1, a2);
   *
   * produces:
   *
   *  o = {
   *    'a': 'Alpha',
   *    'b': 'Bravo',
   *    'c': 'Charlie'
   *  };
   *
   */

  this.associateArrays = function (values, names) {
    var result = new Object();
    if (!(values && names)) return result;
    for (var i = 0; i < names.length && i < values.length; i++) {
      result[names[i]] = values[i];
    }
    return result;
  };

});

/** @namespace util */
ECMAScript.Extend('util', function (ecma) {

  var _package = this;
  var _proto;
  var _defaultParameters = {
    'min_interval': 250,
    'elapsed_multiplier': 0
  };

  var CParameters = ecma.impl.Parameters;

  /**
   * @class Monitor
   *
   * var monitor = new ecma.util.Monitor();
   * monitor.setParameters({
   *  'min_interval': 250,          // Minimum milliseconds between C<poll>s
   *  'elapsed_multiplier': 0       // Multiply the last C<poll>'s elapsed time times this to determine interval
   * });
   *
   * TOCONSIDER - `elapsed_multiplier` should be used in conjunction with an average
   * of the last (oh say, 5) `poll` elapsed-times.
   */

  _package.Monitor = function () {
    CParameters.apply(this);
    this.overlayParameters(_defaultParameters);
    this.timeoutId = null;
    this.targets = [];
    this.beginDate = null;
    this.elapsedTime = null;
  }

  _proto = _package.Monitor.prototype = ecma.lang.createPrototype(
    CParameters
  );

  _proto.addTarget = function (instance, method) {
    if (!instance) throw new Error('Missing target instance');
    if (!method) method = 'refresh';
    this.targets.push([instance, method]);
  };

  _proto.removeTarget = function (instance, method) {
    if (!instance) throw new Error('Missing target instance');
    if (!method) method = 'refresh';
    var len = this.targets.length;
    for (var i = 0; i < this.targets.length; i++) {
      var target = this.targets[i];
      var targetInstance = target[0];
      var targetMethod = target[1];
      if ((instance === targetInstance) && (method === targetMethod)) {
        this.targets.splice(i--, 1);
        break;
      }
    }
    return this.targets.length != len; // true when items removed
  };

  /**
   * @function start
   * @parameter bAsynchronous <Boolean> Caller must invoke L<resume> manually
   */

  _proto.start = function (bAsynchronous) {
    this.asynchronous = bAsynchronous ? true: false;
    this.stop();
    this.poll(!this.asynchronous);
  };

  _proto.stop = function () {
    this.beginDate = null;
    if (this.timeoutId === null) return;
    ecma.dom.clearTimeout(this.timeoutId);
    this.timeoutId = null;
  };

  _proto.poll = function (bContinue) {
    this.beginDate = new Date();
    for (var i = 0; i < this.targets.length; i++) {
      var target = this.targets[i];
      var instance = target[0];
      var method = target[1];
      try {
        instance[method].apply(instance);
      } catch (ex) {
        ecma.console.log(ex);
      }
    }
    if (bContinue) this.resume();
  };

  _proto.getLastElapsed = function () {
    return this.elapsedTime;
  };

  _proto.resume = function () {
    if (this.beginDate === null) return; // Has been stopped (or not started)
    this.elapsedTime = new Date() - this.beginDate;
    var interval = Math.max(
      this.getParameter('min_interval'),
      (this.elapsedTime * this.getParameter('elapsed_multiplier'))
    );
    //js.console.log('elapsedTime', this.elapsedTime, 'interval', interval);
    this.timeoutId = ecma.dom.setTimeout(this.poll, interval, this, [!this.asynchronous]);
  };

});

/**
 * @namespace units
 * Common functions for converting and formatting units.
 */

ECMAScript.Extend('units', function (ecma) {

  this.ONE_KiB = Math.pow(2, 10); // kibi
  this.ONE_MiB = Math.pow(2, 20); // mebi
  this.ONE_GiB = Math.pow(2, 30); // gibi
  this.ONE_TiB = Math.pow(2, 40); // tebi
  this.ONE_PiB = Math.pow(2, 50); // pebi
  this.ONE_EiB = Math.pow(2, 60); // exbi
  this.ONE_ZiB = Math.pow(2, 70); // zebi
  this.ONE_YiB = Math.pow(2, 80); // yobi

  var _units = [
    [this.ONE_KiB, 'K'],
    [this.ONE_MiB, 'M'],
    [this.ONE_GiB, 'G'],
    [this.ONE_TiB, 'T'],
    [this.ONE_PiB, 'P'],
    [this.ONE_EiB, 'E'],
    [this.ONE_ZiB, 'Z'],
    [this.ONE_YiB, 'Y']
  ];

  /**
   * @function bytesize
   *
   * Return a human-readable size given a number of bytes.
   *
   *  sz = ecma.units.bytesize(bytes);
   *  sz = ecma.units.bytesize(bytes, digits);
   *  sz = ecma.units.bytesize(bytes, digits, min);
   *
   * Where:
   *
   *  bytes   <Number>      The number of bytes to represent
   *  digits  <Number>      Significant digits (default=2)
   *  min     <Number>      Minimum representation size (default=ONE_KiB)
   */

  this.bytesize = function (bytes, digits, min) {
    bytes = ecma.util.asInt(bytes);
    var denominator = 1;
    var sym = 'B';
    var unit;
    for (var i = 0; unit = _units[i]; i++) {
      if ((!min || unit[0] >= min) && bytes < unit[0]) break;
      denominator = unit[0];
      sym = unit[1];
    }
    var num = bytes / denominator;
    return(num.toFixed(digits) + sym);
  }

});

/**
 * @namespace date
 *
 * Adopted from:
 *  http://blog.stevenlevithan.com/archives/date-time-format
 */

ECMAScript.Extend('date', function (ecma) {

    /*
     * Date Format 1.2.3
     * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
     * MIT license
     *
     * Includes enhancements by Scott Trenda <scott.trenda.net>
     * and Kris Kowal <cixar.com/~kris.kowal/>
     *
     * Accepts a date, a mask, or a date and a mask.
     * Returns a formatted version of the given date.
     * The date defaults to the current date/time.
     * The mask defaults to dateFormat.masks.default.
     */

    var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
    timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
    timezoneClip = /[^-+\dA-Z]/g,
    pad = function (val, len) {
    val = String(val);
    len = len || 2;
    while (val.length < len) val = "0" + val;
    return val;
    };

var dateFormat = new Object();

// Some common format strings
dateFormat.masks = {
  "default":      "ddd mmm dd yyyy HH:MM:ss",
  shortDate:      "m/d/yy",
  mediumDate:     "mmm d, yyyy",
  longDate:       "mmmm d, yyyy",
  fullDate:       "dddd, mmmm d, yyyy",
  shortTime:      "h:MM TT",
  mediumTime:     "h:MM:ss TT",
  longTime:       "h:MM:ss TT Z",
  isoDate:        "yyyy-mm-dd",
  isoTime:        "HH:MM:ss",
  isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
  isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
dayNames: [
            "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
          "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
            ],
          monthNames: [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
            ]
};

/**
 * @function format
 * Return a formatted version of the given date.
 * Taken from: L<http://blog.stevenlevithan.com/archives/date-time-format>
 *
 *  var str = ecma.date.format(date, mask, utc);
 *
 * Where:
 *
 *  @param date <Date> Date to format (optional)
 *  @param mask <String> The format string L<1>
 *  @param utc <Boolean> Use UTC
 *
 * For example:
 *
 *  ecma.date.format(date, 'm/dd/yy'); *  // B<6/09/07>
 *  ecma.date.format(date, 'dddd, mmmm dS, yyyy, h:MM:ss TT'); // B<Saturday, June 9th, 2007, 5:46:21 PM>
 */

// Regexes and supporting functions are cached through closure
this.format = function (date, mask, utc) {
  var dF = dateFormat;

  // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
  if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
    mask = date;
    date = undefined;
  }

  // Passing date through Date applies Date.parse, if necessary
  date = date ? new Date(date) : new Date;
    if (isNaN(date))
      throw SyntaxError("invalid date");

    mask = String(dF.masks[mask] || mask || dF.masks["default"]);

    // Allow setting the utc argument via the mask
    if (mask.slice(0, 4) == "UTC:") {
      mask = mask.slice(4);
      utc = true;
    }

    var	_ = utc ? "getUTC" : "get",
      d = date[_ + "Date"](),
      D = date[_ + "Day"](),
      m = date[_ + "Month"](),
      y = date[_ + "FullYear"](),
      H = date[_ + "Hours"](),
      M = date[_ + "Minutes"](),
      s = date[_ + "Seconds"](),
      L = date[_ + "Milliseconds"](),
      o = utc ? 0 : date.getTimezoneOffset(),
      flags = {
        d:    d,
        dd:   pad(d),
        ddd:  dF.i18n.dayNames[D],
        dddd: dF.i18n.dayNames[D + 7],
        m:    m + 1,
        mm:   pad(m + 1),
        mmm:  dF.i18n.monthNames[m],
        mmmm: dF.i18n.monthNames[m + 12],
        yy:   String(y).slice(2),
        yyyy: y,
        h:    H % 12 || 12,
        hh:   pad(H % 12 || 12),
        H:    H,
        HH:   pad(H),
        M:    M,
        MM:   pad(M),
        s:    s,
        ss:   pad(s),
        l:    pad(L, 3),
        L:    pad(L > 99 ? Math.round(L / 10) : L),
        t:    H < 12 ? "a"  : "p",
        tt:   H < 12 ? "am" : "pm",
        T:    H < 12 ? "A"  : "P",
        TT:   H < 12 ? "AM" : "PM",
        Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
        o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
        S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
      };

    return mask.replace(token, function ($0) {
      return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
    });
  };

});

/** @namespace error */
ECMAScript.Extend('error', function (ecma) {

  var _package = this;

  /**
   * @function reportCaller - For tracing who called your function
   * @status Experimental
   *
   *  func1 () {
   *    func2();
   *  }
   *
   *  func2 () {
   *    ecma.error.reportCaller();
   *  }
   *
   * Should show this at the console:
   *
   *  at func1 (http://example.com/scripts.js:123:4)
   *
   * Note, designed for Webkit (no other tested)
   */

  _package.reportCaller = function () {
    var stack = new Error().stack;
    ecma.console.log(stack.split("\n")[3]);
  };

  /**
   * @function reportError
   * Report each `Error` object for debugging.
   */
  _package.reportError = function () {
    var console = ecma.console ? ecma.console : ecma.window.console;
    if (!(console && console.debug)) return; // Giving up
    for (var i = 0; i < arguments.length; i++) {
      var ex = arguments[i];
      console.debug(ex.stack ? ex.stack : ex);
    }
  };

});

/** @namespace error */
ECMAScript.Extend('error', function (ecma) {

  /**
   * @class Assertion
   * Indicates an assertion failed.
   *
   *  throw new ecma.error.Assertion();
   *  throw new ecma.error.Assertion(message);
   */

  this.Assertion = function (message) {
    Error.apply(this);
    this.message = message;
  };
  this.Assertion.prototype = new Error();

  /**
   * @class MissingArg
   * Indicates a required function argument was not provided.
   *
   *  throw new ecma.error.MissingArg(name);
   *
   * Where C<name> indicates the name of the missing argument.
   */

  this.MissingArg = function (name) {
    this.message = 'Missing argument: ' + name;
  };
  this.MissingArg.prototype = new TypeError();

  /**
   * @class IllegalArg
   * Indicates a function argument is not correct.
   *
   *  throw new ecma.error.IllegalArg(name);
   *
   * Where C<name> indicates the name of the offending argument.
   */

  this.IllegalArg = function (name) {
    this.message = 'Illegal argument: ' + name;
  };
  this.IllegalArg.prototype = new TypeError();

  /**
   * @class Multiple
   * Indicates multiple exceptions occured.  Used in the case where throwing
   * each exception at the time would prevent critical code from executing.
   * For instance, when applying callback functions (listeners).
   *
   *  throw new ecma.error.Multiple(array);
   */

  this.Multiple = function (errors) {
    this.errors = errors;
    this.message = 'Multiple exceptions';
  };
  this.Multiple.prototype = new Error();
  this.Multiple.prototype.toString = function () {
    var result = this.message + "\n";
    for (var i = 0, ex; ex = this.errors[i]; i++) {
      result += '  Exception #' + i + ': ' + ex.toString() + "\n";
    }
    return result;
  };

});

/**
 * @namespace error
 *
 * XXX Depricated. Instead, use:
 *
 *  throw new ecma.error.Assertion(...);
 *  throw new ecma.error.MissingArg(...);
 *  throw new ecma.error.IllegalArg(...);
 *  throw new ecma.error.Multiple(...);
 *
 * This is a collection of exception strings.  What I'm seeing is that
 * throwing custom Error objects (error/programatic.js) does not yield
 * the same results as when simply throwing a string.
 *
 * The advantage of throwing an error object is that in a catch method
 * one can test for instanceof a particular exception class.
 *
 * The advantage of throwing a string is that the debugger* gives a
 * nice stack trace and points you to the line where the exception
 * was raised.  However, one has no choice but to interrogate the
 * exception string to find out what kind of error it is.  Which sucks
 * if you want to be say, multilingual.
 *
 * These strings are implemented as functions for two reasons: first,
 * it allows you to pass arguments so we can provide formatted messages;
 * and second, upgrading to custom Error-derived objects is an in-place
 * refactor (should call toString() so to ensure the return type is
 * the same).
 */

ECMAScript.Extend('error', function (ecma) {

  function _errprintf (str, args) {
    var result = new String(str);
    for (var i = 0; i < args.length; i++) {
      var param = new RegExp('\\$' + (i + 1));
      result = result.replace(param, args[i]);
    }
    result = result.replace(/\$@/, args.join(';'));
    return result;
  }

  function _errstr (str) {
    return function () {
      return new Error(_errprintf(str, ecma.util.args(arguments)));
    }
  }

  // TODO if ecma.platform.isEnglish()

  this.assertion = _errstr('Assertion failed');
  this['abstract'] = _errstr('Abstract function not implemented');
  this.illegalArgument = _errstr('Illegal argument: $1');
  this.missingArgument = _errstr('Missing argument: $1');
  this.multiple = _errstr('Multiple exceptions: $@');

});

/**
 * @namespace thread
 * Threading model.
 *
 # This creates an unwanted dependency on L<ecma.dom.setTimeout> because the
 # we need to surpress the number-of-seconds-late argument from being inserted
 # into the argument stack.
 *
 * Maybe not the best idea in the world, however the intention is to give the
 * programmer the function of creating and managing threads.
 *
 * Currently this uses the C<setTimeout> function of the window object.  This
 * is obviously a browser-based solution.  However, the understanding is that
 * the window object is the browser's "platform" and that any "platform" will
 * implement a C<setTimeout> function.
 *
 * TODO Determine if there is a better way to achieve this goal, if the
 * C<setTimeout> presumption is valid, and research what it would take to 
 * incorporate suport for other platforms.
 */

ECMAScript.Extend('thread', function (ecma) {

  /**
   * @function spawn
   * Spawn a new thread.
   *
   *  ecma.thread.spawn(func);
   *  ecma.thread.spawn(func, scope);
   *  ecma.thread.spawn(func, scope, args);
   *
   * @param func    <Function|Array> Callback function
   * @param scope   <Object> Default scope (optional)
   * @param args    <Array> Arguments (optional)
   * @param excb    <Function> Exception handler (optional)
   */

  this.spawn = function (func, scope, args, excb) {
    var cb = ecma.lang.createCallbackArray(func, scope, args);
    ecma.dom.setTimeout(cb[0], 0, cb[1], cb[2], excb);
  }

});

/**
 * @namespace crypt
 *
 # Secure Hash Algorithms
 *
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 *
 * @function hex_sha1
 * @function b64_sha1
 * @function str_sha1
 * @function hex_hmac_sha1
 * @function b64_hmac_sha1
 * @function str_hmac_sha1
 */

/*!
 *  SHA1 Algorithms
 *  Version 2.1a Copyright Paul Johnston 2000 - 2002.
 *  Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *  Distributed under the BSD License
 *  See L<http://pajhome.org.uk/crypt/md5> for details.
 */

ECMAScript.Extend('crypt', function (ecma) {

  /*
   * Configurable variables. You may need to tweak these to be compatible with
   * the server-side, but the defaults work in most cases.
   */
  var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
  var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
  var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

  /*
   * These are the functions you'll usually want to call
   * They take string arguments and return either hex or base-64 encoded strings
   */

  this.hex_sha1 = function(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
  this.b64_sha1 = function(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
  this.str_sha1 = function(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
  this.hex_hmac_sha1 = function(key, data){ return binb2hex(core_hmac_sha1(key, data));}
  this.b64_hmac_sha1 = function(key, data){ return binb2b64(core_hmac_sha1(key, data));}
  this.str_hmac_sha1 = function(key, data){ return binb2str(core_hmac_sha1(key, data));}

  /*
   * Perform a simple self-test to see if the VM is working
   */
  function sha1_vm_test()
  {
    return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
  }

  /*
   * Calculate the SHA-1 of an array of big-endian words, and a bit length
   */
  function core_sha1(x, len)
  {
    /* append padding */
    x[len >> 5] |= 0x80 << (24 - len % 32);
    x[((len + 64 >> 9) << 4) + 15] = len;

    var w = Array(80);
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
    var e = -1009589776;

    for(var i = 0; i < x.length; i += 16)
    {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
      var olde = e;

      for(var j = 0; j < 80; j++)
      {
        if(j < 16) w[j] = x[i + j];
        else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
        var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                         safe_add(safe_add(e, w[j]), sha1_kt(j)));
        e = d;
        d = c;
        c = rol(b, 30);
        b = a;
        a = t;
      }

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
      e = safe_add(e, olde);
    }
    return Array(a, b, c, d, e);

  }

  /*
   * Perform the appropriate triplet combination function for the current
   * iteration
   */
  function sha1_ft(t, b, c, d)
  {
    if(t < 20) return (b & c) | ((~b) & d);
    if(t < 40) return b ^ c ^ d;
    if(t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }

  /*
   * Determine the appropriate additive constant for the current iteration
   */
  function sha1_kt(t)
  {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }

  /*
   * Calculate the HMAC-SHA1 of a key and some data
   */
  function core_hmac_sha1(key, data)
  {
    var bkey = str2binb(key);
    if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

    var ipad = Array(16), opad = Array(16);
    for(var i = 0; i < 16; i++)
    {
      ipad[i] = bkey[i] ^ 0x36363636;
      opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
    return core_sha1(opad.concat(hash), 512 + 160);
  }

  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  function safe_add(x, y)
  {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  function rol(num, cnt)
  {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  /*
   * Convert an 8-bit or 16-bit string to an array of big-endian words
   * In 8-bit function, characters >255 have their hi-byte silently ignored.
   */
  function str2binb(str)
  {
    var bin = Array();
    var mask = (1 << chrsz) - 1;
    for(var i = 0; i < str.length * chrsz; i += chrsz)
      bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
    return bin;
  }

  /*
   * Convert an array of big-endian words to a string
   */
  function binb2str(bin)
  {
    var str = "";
    var mask = (1 << chrsz) - 1;
    for(var i = 0; i < bin.length * 32; i += chrsz)
      str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
    return str;
  }

  /*
   * Convert an array of big-endian words to a hex string.
   */
  function binb2hex(binarray)
  {
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i++)
    {
      str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
             hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
    }
    return str;
  }

  /*
   * Convert an array of big-endian words to a base-64 string
   */
  function binb2b64(binarray)
  {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i += 3)
    {
      var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                  | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                  |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
      for(var j = 0; j < 4; j++)
      {
        if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
        else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
      }
    }
    return str;
  }

});

/**
 * @namespace console
 * Access to the client's console.  When no console is present calls are
 * silently ignored.
 */

ECMAScript.Extend('console', function (ecma) {

  var _package = this;

  /** Local stack of output consoles */
  var _consoles = [];

  /** Messages are spooled until an initial console is [attached and] flushed */
  var _spool = [];
  var _haveFlushed = false;

  /** 
   * @function tee
   * Add an output console to the stack. Output consoles are objects which
   * have C<log> and C<trace> methods.
   */
  _package.tee = function (console) {
    if (!console) throw new Error('Missing argument');
    _consoles.push(console);
  };

  /**
   * @function log
   * Log a message to all consoles
   */
  _package.log = function () {
    var args = ecma.util.args(arguments);
    var text = args.join(' ');
    if (!_haveFlushed) _spool.push(text);
    for (var i = 0, c; c = _consoles[i]; i++) {
      c.log(text);
    }
  };

  /**
   * @function trace
   * Log a trace message to all consoles
   */
  _package.trace = function () {
    if (arguments.length) ecma.console.log.apply(this, arguments);
    for (var i = 0, c; c = _consoles[i]; i++) {
      if (typeof(c.trace) == 'function') {
        c.trace();
      }
    }
  };

  /**
   * @function error
   * Passed to all consoles
   */
  _package.error = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.error;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function warn
   * Passed to all consoles
   */
  _package.warn = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.warn;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function info
   * Passed to all consoles
   */
  _package.info = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.info;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function dir
   * Passed to all consoles
   */
  _package.dir = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.dir;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function debug
   * Passed to all consoles
   */
  _package.debug = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.debug;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function trace
   * Passed to all consoles
   */
  _package.trace = function (/*...*/) {
    for (var i = 0, c; c = _consoles[i]; i++) {
      var func = c.trace;
      if (ecma.util.isFunction(func)) {
        func.apply(c, arguments);
      }
    }
  }

  /**
   * @function flush
   * Output all log-history items.
   */
  _package.flush = function () {
    for (var i = 0; i < _spool.length; i++) {
      var text = _spool[i];
      for (var j = 0, c; c = _consoles[j]; j++) {
        c.log(text);
      }
      _spool = [];
      _haveFlushed = true;
    }
  };

});

/** @namespace action */
ECMAScript.Extend('action', function (ecma) {

  /**
   * addActionListener - Add a GLOBAL action listener.
   * Called on all class and derived instances.
   */

  this.addActionListener = function (klass, name, listener, scope, args) {
    if (!klass.prototype.globalActionListeners) {
      klass.prototype.globalActionListeners = [];
    }
    var inst = new klass();
    var al = inst.createActionListener(name, listener, scope, args);
    klass.prototype.globalActionListeners.push(al);
    return al;
  };

  /**
   * removeActionListener - Remove a GLOBAL action listener.
   *
   * TODO Looks like a script error, klass is not defined?!
   */

  this.removeActionListener = function (name, listener, scope) {
    if (!klass.prototype.globalActionListeners) return;
    var inst = new klass();
    return inst.removeActionListenerFrom(this.globalActionListeners, arguments);
  };

  /** ----------------------------------------------------------------------- */

  var proto = {};

  /**
   * @class ActionDispatcher
   * Base class for classes which wish to implement action callbacks.
   *
   *  function MyClass () {
   *    ecma.action.ActionDispatcher.apply(this);
   *  }
   *  var proto = ecma.lang.createPrototype(ecma.action.ActionDispatcher);
   *  MyClass.prototype = proto;
   */

  this.ActionDispatcher = function CActionDispatcher () {
    // Do not stomp during multiple inheritance
    if (!this.actionListeners) this.actionListeners = [];
  };

  this.ActionDispatcher.prototype = proto;

  /**
   * @function normalizeActionName
   * Used to allow fuzzy action names, e.g., C<'onComplete' == 'complete'>.
   *
   *  var name1 = object.normalizeActionName('onComplete');
   *  var name2 = object.normalizeActionName('complete');
   *  ecma.lang.assert(name1 == name2);
   */

  proto.normalizeActionName = function (name) {
    if (!name) return;
    if (!name.toLowerCase) return;
    return name.toLowerCase().replace(/^on/, '');
  };


  /**
   * createActionListener - Create a listener object
   */

  proto.createActionListener = function (name, listener, scope, args) {
    name = this.normalizeActionName(name);
    if (!listener) throw new Error('Action listener callback function required');
    if (typeof(listener) != 'function') throw new Error('Action listener callback must be a function');
    this.removeActionListener(name, listener, scope);
    return new ecma.action.ActionListener(this, name, listener, scope, args);
  };

  /**
   * @function addActionListener
   * Add add a callback for the given action name.
   *
   *  object.addActionListener(name, listener);
   *  object.addActionListener(name, listener, scope);
   *  object.addActionListener(name, listener, scope, args);
   *
   * Where:
   *
   *  name        <String>    Name of the action
   *  listener    <Function>  Callback function
   *  scope       <Object>    Callback scope
   *  args        <Array>     Callback arguments L<1>
   *
   * N<1> The provided arguments are concatenated B<after> any arguments
   * provided by the code which invokes the event.
   */

  proto.addActionListener = function (name, listener, scope, args) {
    var cbarr = ecma.lang.createCallbackArray(listener, scope, args);
    var al = this.createActionListener.apply(this, [name].concat(cbarr));
    this.actionListeners.push(al);
    return al;
  };

  /**
   * @function removeActionListener
   * Remove an action listener.
   *
   *  object.removeActionListener(name, listener);
   *  object.removeActionListener(name, listener, scope);
   *
   * Where:
   *
   *  name        <String>    Name of the action
   *  listener    <Function>  Callback function
   *  scope       <Object>    Callback scope
   *
   * All arguments must be the same as provided to the L<.addActionListener>
   * function.
   */

  proto.removeActionListener = function (name, listener, scope) {
    return this.removeActionListenerFrom(this.actionListeners, arguments);
  };

  proto.removeActionListenerFrom = function (listeners, argv) {
    var args = ecma.util.args(argv);
    var name = args.shift();
    var listener = args.shift();
    var scope = args.shift();
    if (typeof(name) == 'string') {
      name = this.normalizeActionName(name);
    } else {
      al = name;
      name = al.name;
      listener = al.listener;
      scope = al.scope;
    }
    for (var i = 0, props; props = listeners[i]; i++) {
      if (props.name !== name) continue;
      if (props.listener !== listener) continue;
      if (props.scope !== scope) continue;
      listeners.splice(i--, 1);
      break;
    }
  };

  proto.getActionListenersByName = function (name) {
    var result = [];
    if (this.globalActionListeners) {
      for (var i = 0, props; props = this.globalActionListeners[i]; i++) {
        if (props.name == name || props.name === '*') result.push(props);
      }
    }
    for (var i = 0, props; props = this.actionListeners[i]; i++) {
      if (props.name == name || props.name === '*') result.push(props);
    }
    return result;
  }

  /**
   * @function executeAction
   * Invoke the given action synchronously.
   *
   *  this.executeAction(name);
   *  this.executeAction(name, arg1...);
   *
   * @see L<.dispatchAction>
   */

  proto.executeAction = function () {
    var args = ecma.util.args(arguments);
    var actionEvent = this.createActionEvent(args.shift());
    var name = actionEvent.name;
    var group = this.getActionListenersByName(name);
    if (!group.length) return;
    args.unshift(actionEvent);
    ecma.util.step(group, this.executeActionListener, this, args);
  };

  proto.executeActionListener = function () {
    var argz = ecma.util.args(arguments);
    var listener = argz.shift();
    return listener.invoke.apply(listener, argz);
  };

  /**
   * @function dispatchAction
   * Invoke the given action synchronously.
   *
   *  this.dispatchAction(name);
   *  this.dispatchAction(name, arg1...);
   *
   * The difference between L<.dispatchAction> and L<.executeAction> is that
   * L<.dispatchAction> will apply each listener callback in a separate thread,
   * allowing the current thread to continue.  While this is ideal in most
   * situations, time-critical routines will prefer L<.executeAction>.
   */

  proto.dispatchAction = function (name) {
    var args = ecma.util.args(arguments);
    var actionEvent = this.createActionEvent(args.shift());
    var name = actionEvent.name;
    var group = this.getActionListenersByName(name);
    if (!group.length) return;
    args.unshift(actionEvent);
    ecma.util.step(group, this.dispatchActionListener, this, args);
  };

  proto.dispatchActionListener = function () {
    var argz = ecma.util.args(arguments);
    var listener = argz.shift();
    listener.spawn.apply(listener, argz);
  };

  proto.createActionEvent = function (arg1) {
    var actionEvent = null;
    if (ecma.util.isa(arg1, ecma.action.ActionEvent)) {
      actionEvent = arg1;
      actionEvent.setDispatcher(this);
    } else if (ecma.util.isAssociative(arg1)) {
      actionEvent = new ecma.action.ActionEvent();
      js.util.overlay(actionEvent, arg1);
      var name = this.normalizeActionName(arg1.name);
      actionEvent.setName(name);
      actionEvent.setDispatcher(this);
    } else {
      var name = this.normalizeActionName(arg1);
      actionEvent = new ecma.action.ActionEvent(name, this);
    }
    return actionEvent;
  };

  /**
   * @function dispatchClassAction
   *
   *  dispatchClassAction('onClick', ...);
   *
   * * Calls this instances C<onClick> method (case sensitive)
   * * Then executes the action listeners (not case sensitive)
   * * Only action listeners receive the C<ActionEvent> as their first-argument.
   */

  proto.dispatchClassAction = function () {
    var args = ecma.util.args(arguments);
    var action = args.shift();
    var funcName = ecma.util.isAssociative(action)
      ? action.name
      : action;
    var funcEx = undefined;
    try {
      if (typeof(this[funcName]) == 'function') {
        this[funcName].apply(this, args);
      }
    } catch (ex) {
      funcEx = ex;
    }
    this.dispatchAction.apply(this, arguments);
    if (funcEx) {
      throw funcEx;
    }
  };

  /**
   * @function executeClassAction
   *
   *  executeClassAction('onClick', ...);
   *
   * * Calls this instances C<onClick> method (case sensitive)
   * * Then executes the action listeners (not case sensitive)
   * * Only action listeners receive the C<ActionEvent> as their first-argument.
   */

  proto.executeClassAction = function () {
    var args = ecma.util.args(arguments);
    var action = args.shift();
    var funcName = ecma.util.isAssociative(action)
      ? action.name
      : action;
    var funcEx = undefined;
    try {
      if (typeof(this[funcName]) == 'function') {
        this[funcName].apply(this, args);
      }
    } catch (ex) {
      funcEx = ex;
    }
    this.executeAction.apply(this, arguments);
    if (funcEx) {
      throw funcEx;
    }
  };

});

/*
if (!(listener.listener instanceof Function)) {
  this.actionListeners.splice(i--, 1);
  continue;
}
*/

/** @namespace action */
ECMAScript.Extend('action', function (ecma) {

  var proto = {};

  /**
   * @class ActionListener
   * Represents a listener which has been added to an L<ecma.action.ActionDispatcher>
   */

  this.ActionListener = function (dispatch, name, listener, scope, args) {
    // Create callback array so to support single-argument-callback-bundles
    var cb = ecma.lang.createCallbackArray(listener, scope, args);
    this.dispatch = dispatch;
    this.name = name;
    this.listener = cb[0];
    this.scope = cb[1];
    this.args = cb[2];
//  this.stack = ecma.error.getStackTrace(); // capture for later
  };

  this.ActionListener.prototype = proto;

  /**
   * @function invoke
   * Execute this listener.
   */

  proto.invoke = function () {
    var argz = ecma.util.args(arguments);
    if (this.args && this.args.length) argz = argz.concat(this.args);
    return this.listener.apply(this.scope || this, argz);
  };

  /**
   * @function spawn
   * Spawn a new thread which invokes this listener.
   */

  proto.spawn = function () {
    var argz = ecma.util.args(arguments);
    if (this.args) argz = argz.concat(this.args);
    ecma.thread.spawn(this.listener, this.scope || this, argz);
//  ecma.thread.spawn(this.listener, this.scope || this, argz, [this.onException, this]);
  };

  /**
   * @function remove
   * Remove this listener from its dispatcher.
   */

  proto.remove = function (name) {
    return this.dispatch.removeActionListener(this);
  };

  /**
   * @function onException
   * Handle exceptions which occur while invoking this listener.  One fatal
   * exception is when the listener function as been freed.  Either way, we
   * will remove ourselves from the dispatcher.
   *
   *  @param ex <Error> the exception
   */

  proto.onException = function (ex) {
    var logMessage = ex.toString() + ' (while invoking an action listener)';
    if (ex.toString().match(/freed script/)) return this.remove();
    throw ex;
  };

});

/** @namespace action */
ECMAScript.Extend('action', function (ecma) {

  /**
   * @class ActionEvent
   * Event object for ActionListener dispatched events.
   * @param name        <String>                        The normalized name of the action.
   * @param dispatcher  <ecma.action.ActionDispatcher>  The invoking dispatcher object.
   */

  var proto = {};

  this.ActionEvent = function (name, dispatcher) {
    this.name = null;
    this.dispatcher = null;
    this.setName(name);
    this.setDispatcher(dispatcher);
  };

  this.ActionEvent.prototype = proto;

  proto.getName = function () {
    return this.name;
  };

  proto.setName = function (name) {
    return this.name = name;
  };

  proto.getDispatcher = function () {
    return this.dispatcher;
  };

  proto.setDispatcher = function (dispatcher) {
    return this.dispatcher = dispatcher;
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  var _package = this;

  var _inspect = function (unk, name, ctrl, sep) {
    var result = '';
    if (!ecma.util.defined(sep)) sep = "\n";
    if (typeof(unk) == 'function') {
      unk = '(function)';
    } else if (ecma.util.isObject(unk)) {
      if (!ecma.util.grep(function (i) {return i === unk}, ctrl)) {
        ctrl.push(unk);
        var pName = ecma.util.defined(name) && name != '' ? name + '/' : '';
        for (var k in unk) {
          var v = unk[k];
          result += _inspect(v, pName + k, ctrl, sep);
        }
        return result;
      }
    }
    result += name + ':' + unk + sep;
    return result;
  };

  /**
   * @function inspect
   * Return a string representing each recursive value in an object
   *
   *  var str = ecma.data.inspect(val);
   */

  _package.inspect = function (unk, name, sep) {
    return _inspect(unk, name || '', [], sep);
  };

  /**
   * @function fromObject
   *
   */

  _package.fromObject = function (obj) {
    if (!js.util.isDefined(obj)) return obj;
    var result;
    if (js.util.isAssociative(obj)) {
      result = new ecma.data.HashList();
      for (var k in obj) {
        result.setValue(k, _package.fromObject(obj[k]));
      }
    } else if (js.util.isArray(obj)) {
      result = new ecma.data.Array();
      for (var i = 0; i < obj.length; i++) {
        result.setValue(i, _package.fromObject(obj[i]));
      }
    } else {
      // XXX Dates, Numbers, Etc are stringified (Not intentionally)
      // TODO Clone Dates, Numbers, and other predefined Objects
      result = obj.toString();
    }
    return result;
  };

});

/** @namespace data.utf8 */
ECMAScript.Extend('data.utf8', function (ecma) {

  /**
   * @function encode
   */

  this.encode = function (str) {
    if (typeof(str) != 'string') {
      str = new String(str);
    }
    str = str.replace(/\r\n/g,"\n");
    var utftext = "";
    for (var n = 0; n < str.length; n++) {
      var c = str.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }

    }
    return utftext;
  };

  /**
   * @function decode
   */

  this.decode = function (utftext) {
    var str = "";
    var i = 0;
    var c = c2 = c3 = 0;
    while ( i < utftext.length ) {
      c = utftext.charCodeAt(i);
      if (c < 128) {
        str += String.fromCharCode(c);
        i++;
      }
      else if((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i+1);
        str += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i+1);
        c3 = utftext.charCodeAt(i+2);
        str += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }
    }
    return str;
  };

});

/**
*
*  MD5 (Message-Digest Algorithm)
*  http://www.webtoolkit.info/
*
**/
 
/** @namespace data.md5 */
ECMAScript.Extend('data.md5', function (ecma) {

  function RotateLeft(lValue, iShiftBits) {
    return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
  }
 
  function AddUnsigned(lX,lY) {
    var lX4,lY4,lX8,lY8,lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
    if (lX4 & lY4) {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      } else {
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
    } else {
      return (lResult ^ lX8 ^ lY8);
    }
   }
 
  function F(x,y,z) { return (x & y) | ((~x) & z); }
  function G(x,y,z) { return (x & z) | (y & (~z)); }
  function H(x,y,z) { return (x ^ y ^ z); }
  function I(x,y,z) { return (y ^ (x | (~z))); }
 
  function FF(a,b,c,d,x,s,ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  };
 
  function GG(a,b,c,d,x,s,ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  };
 
  function HH(a,b,c,d,x,s,ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  };
 
  function II(a,b,c,d,x,s,ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  };
 
  function ConvertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1=lMessageLength + 8;
    var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
    var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
    var lWordArray=Array(lNumberOfWords-1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while ( lByteCount < lMessageLength ) {
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount-(lByteCount % 4))/4;
    lBytePosition = (lByteCount % 4)*8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
    lWordArray[lNumberOfWords-2] = lMessageLength<<3;
    lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
    return lWordArray;
  };
 
  function WordToHex(lValue) {
    var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
    for (lCount = 0;lCount<=3;lCount++) {
      lByte = (lValue>>>(lCount*8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
    }
    return WordToHexValue;
  };
 
  this.sum = function (string) {

    var x=Array();
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
   
    string = ecma.data.utf8.encode(string);
   
    x = ConvertToWordArray(string);
   
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
   
    for (k=0;k<x.length;k+=16) {
      AA=a; BB=b; CC=c; DD=d;
      a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
      d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
      c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
      b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
      a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
      d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
      c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
      b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
      a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
      d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
      c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
      b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
      d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
      c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
      b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
      d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
      c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
      b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
      a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
      d=GG(d,a,b,c,x[k+10],S22,0x2441453);
      c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
      b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
      a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
      d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
      c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
      b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
      a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
      d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
      c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
      b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
      d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
      c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
      b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
      d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
      c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
      b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
      d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
      c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
      b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
      a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
      d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
      c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
      b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
      a=II(a,b,c,d,x[k+0], S41,0xF4292244);
      d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
      c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
      b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
      a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
      d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
      c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
      b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
      a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
      d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
      c=II(c,d,a,b,x[k+6], S43,0xA3014314);
      b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
      d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
      c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
      b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
      a=AddUnsigned(a,AA);
      b=AddUnsigned(b,BB);
      c=AddUnsigned(c,CC);
      d=AddUnsigned(d,DD);
    }
 
    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
    return temp.toLowerCase();
  };

});

/**
 * Base64 encode / decode
 * L<http://www.webtoolkit.info/>
 */

/** @namespace data.base64 */
ECMAScript.Extend('data.base64', function (ecma) {

  // private property
  var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  /**
   * @function encode
   * public method for encoding
   */

  this.encode = function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = ecma.data.utf8.encode(input);

    while (i < input.length) {

      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output = output +
      _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
      _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

    }

    return output;
  };

  /**
   * @function decode
   * public method for decoding
   */

  this.decode = function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

      enc1 = _keyStr.indexOf(input.charAt(i++));
      enc2 = _keyStr.indexOf(input.charAt(i++));
      enc3 = _keyStr.indexOf(input.charAt(i++));
      enc4 = _keyStr.indexOf(input.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3);
      }

    }

    output = ecma.data.utf8.decode(output);

    return output;

  };

});

/** @namespace data.entities */
ECMAScript.Extend('data.entities', function (ecma) {

  /**
   * @private _isAllowed
   * Return true if the character-code is a HTML and SGML standard code point.
   * http://www.w3.org/TR/REC-html40/sgml/sgmldecl.html
   *
   * TODO: http://en.wikipedia.org/wiki/Valid_characters_in_XML
   */

  function _isAllowed (cc) {
    if (cc >= 0 && cc <= 8) return false;
    if (cc >= 11 && cc <= 12) return false;
    if (cc >= 14 && cc <= 31) return false;
    if (cc == 127) return false;
    if (cc >= 128 && cc <= 159) return false;
    if (cc >= 55296 && cc <= 57343) return false;
    return true;
  }

  function _isMarkup (cc) {
    return cc == 34 // "
      || cc == 38   // &
      || cc == 60   // <
      || cc == 62;  // >
  }

  function _isLower (cc) {
    return cc < 32 && cc != 9 && cc != 10 && cc != 13;
  }

  function _isUpper (cc) {
    return cc >= 127;
  }

  var charCodeToNamedMap = {};
  charCodeToNamedMap[34] = 'quot';
  charCodeToNamedMap[38] = 'amp';
  charCodeToNamedMap[60] = 'lt';
  charCodeToNamedMap[62] = 'gt';
  charCodeToNamedMap[160] = 'nbsp';
  charCodeToNamedMap[161] = 'iexcl';
  charCodeToNamedMap[162] = 'cent';
  charCodeToNamedMap[163] = 'pound';
  charCodeToNamedMap[164] = 'curren';
  charCodeToNamedMap[165] = 'yen';
  charCodeToNamedMap[166] = 'brvbar';
  charCodeToNamedMap[167] = 'sect';
  charCodeToNamedMap[168] = 'uml';
  charCodeToNamedMap[169] = 'copy';
  charCodeToNamedMap[170] = 'ordf';
  charCodeToNamedMap[171] = 'laquo';
  charCodeToNamedMap[172] = 'not';
  charCodeToNamedMap[173] = 'shy';
  charCodeToNamedMap[174] = 'reg';
  charCodeToNamedMap[175] = 'macr';
  charCodeToNamedMap[176] = 'deg';
  charCodeToNamedMap[177] = 'plusmn';
  charCodeToNamedMap[178] = 'sup2';
  charCodeToNamedMap[179] = 'sup3';
  charCodeToNamedMap[180] = 'acute';
  charCodeToNamedMap[181] = 'micro';
  charCodeToNamedMap[182] = 'para';
  charCodeToNamedMap[183] = 'middot';
  charCodeToNamedMap[184] = 'cedil';
  charCodeToNamedMap[185] = 'sup1';
  charCodeToNamedMap[186] = 'ordm';
  charCodeToNamedMap[187] = 'raquo';
  charCodeToNamedMap[188] = 'frac14';
  charCodeToNamedMap[189] = 'frac12';
  charCodeToNamedMap[190] = 'frac34';
  charCodeToNamedMap[191] = 'iquest';
  charCodeToNamedMap[192] = 'Agrave';
  charCodeToNamedMap[193] = 'Aacute';
  charCodeToNamedMap[194] = 'Acirc';
  charCodeToNamedMap[195] = 'Atilde';
  charCodeToNamedMap[196] = 'Auml';
  charCodeToNamedMap[197] = 'Aring';
  charCodeToNamedMap[198] = 'AElig';
  charCodeToNamedMap[199] = 'Ccedil';
  charCodeToNamedMap[200] = 'Egrave';
  charCodeToNamedMap[201] = 'Eacute';
  charCodeToNamedMap[202] = 'Ecirc';
  charCodeToNamedMap[203] = 'Euml';
  charCodeToNamedMap[204] = 'Igrave';
  charCodeToNamedMap[205] = 'Iacute';
  charCodeToNamedMap[206] = 'Icirc';
  charCodeToNamedMap[207] = 'Iuml';
  charCodeToNamedMap[208] = 'ETH';
  charCodeToNamedMap[209] = 'Ntilde';
  charCodeToNamedMap[210] = 'Ograve';
  charCodeToNamedMap[211] = 'Oacute';
  charCodeToNamedMap[212] = 'Ocirc';
  charCodeToNamedMap[213] = 'Otilde';
  charCodeToNamedMap[214] = 'Ouml';
  charCodeToNamedMap[215] = 'times';
  charCodeToNamedMap[216] = 'Oslash';
  charCodeToNamedMap[217] = 'Ugrave';
  charCodeToNamedMap[218] = 'Uacute';
  charCodeToNamedMap[219] = 'Ucirc';
  charCodeToNamedMap[220] = 'Uuml';
  charCodeToNamedMap[221] = 'Yacute';
  charCodeToNamedMap[222] = 'THORN';
  charCodeToNamedMap[223] = 'szlig';
  charCodeToNamedMap[224] = 'agrave';
  charCodeToNamedMap[225] = 'aacute';
  charCodeToNamedMap[226] = 'acirc';
  charCodeToNamedMap[227] = 'atilde';
  charCodeToNamedMap[228] = 'auml';
  charCodeToNamedMap[229] = 'aring';
  charCodeToNamedMap[230] = 'aelig';
  charCodeToNamedMap[231] = 'ccedil';
  charCodeToNamedMap[232] = 'egrave';
  charCodeToNamedMap[233] = 'eacute';
  charCodeToNamedMap[234] = 'ecirc';
  charCodeToNamedMap[235] = 'euml';
  charCodeToNamedMap[236] = 'igrave';
  charCodeToNamedMap[237] = 'iacute';
  charCodeToNamedMap[238] = 'icirc';
  charCodeToNamedMap[239] = 'iuml';
  charCodeToNamedMap[240] = 'eth';
  charCodeToNamedMap[241] = 'ntilde';
  charCodeToNamedMap[242] = 'ograve';
  charCodeToNamedMap[243] = 'oacute';
  charCodeToNamedMap[244] = 'ocirc';
  charCodeToNamedMap[245] = 'otilde';
  charCodeToNamedMap[246] = 'ouml';
  charCodeToNamedMap[247] = 'divide';
  charCodeToNamedMap[248] = 'oslash';
  charCodeToNamedMap[249] = 'ugrave';
  charCodeToNamedMap[250] = 'uacute';
  charCodeToNamedMap[251] = 'ucirc';
  charCodeToNamedMap[252] = 'uuml';
  charCodeToNamedMap[253] = 'yacute';
  charCodeToNamedMap[254] = 'thorn';
  charCodeToNamedMap[255] = 'yuml';
  charCodeToNamedMap[338] = 'OElig';
  charCodeToNamedMap[339] = 'oelig';
  charCodeToNamedMap[352] = 'Scaron';
  charCodeToNamedMap[353] = 'scaron';
  charCodeToNamedMap[376] = 'Yuml';
  charCodeToNamedMap[402] = 'fnof';
  charCodeToNamedMap[710] = 'circ';
  charCodeToNamedMap[732] = 'tilde';
  charCodeToNamedMap[913] = 'Alpha';
  charCodeToNamedMap[914] = 'Beta';
  charCodeToNamedMap[915] = 'Gamma';
  charCodeToNamedMap[916] = 'Delta';
  charCodeToNamedMap[917] = 'Epsilon';
  charCodeToNamedMap[918] = 'Zeta';
  charCodeToNamedMap[919] = 'Eta';
  charCodeToNamedMap[920] = 'Theta';
  charCodeToNamedMap[921] = 'Iota';
  charCodeToNamedMap[922] = 'Kappa';
  charCodeToNamedMap[923] = 'Lambda';
  charCodeToNamedMap[924] = 'Mu';
  charCodeToNamedMap[925] = 'Nu';
  charCodeToNamedMap[926] = 'Xi';
  charCodeToNamedMap[927] = 'Omicron';
  charCodeToNamedMap[928] = 'Pi';
  charCodeToNamedMap[929] = 'Rho';
  charCodeToNamedMap[931] = 'Sigma';
  charCodeToNamedMap[932] = 'Tau';
  charCodeToNamedMap[933] = 'Upsilon';
  charCodeToNamedMap[934] = 'Phi';
  charCodeToNamedMap[935] = 'Chi';
  charCodeToNamedMap[936] = 'Psi';
  charCodeToNamedMap[937] = 'Omega';
  charCodeToNamedMap[945] = 'alpha';
  charCodeToNamedMap[946] = 'beta';
  charCodeToNamedMap[947] = 'gamma';
  charCodeToNamedMap[948] = 'delta';
  charCodeToNamedMap[949] = 'epsilon';
  charCodeToNamedMap[950] = 'zeta';
  charCodeToNamedMap[951] = 'eta';
  charCodeToNamedMap[952] = 'theta';
  charCodeToNamedMap[953] = 'iota';
  charCodeToNamedMap[954] = 'kappa';
  charCodeToNamedMap[955] = 'lambda';
  charCodeToNamedMap[956] = 'mu';
  charCodeToNamedMap[957] = 'nu';
  charCodeToNamedMap[958] = 'xi';
  charCodeToNamedMap[959] = 'omicron';
  charCodeToNamedMap[960] = 'pi';
  charCodeToNamedMap[961] = 'rho';
  charCodeToNamedMap[962] = 'sigmaf';
  charCodeToNamedMap[963] = 'sigma';
  charCodeToNamedMap[964] = 'tau';
  charCodeToNamedMap[965] = 'upsilon';
  charCodeToNamedMap[966] = 'phi';
  charCodeToNamedMap[967] = 'chi';
  charCodeToNamedMap[968] = 'psi';
  charCodeToNamedMap[969] = 'omega';
  charCodeToNamedMap[977] = 'thetasym';
  charCodeToNamedMap[978] = 'upsih';
  charCodeToNamedMap[982] = 'piv';
  charCodeToNamedMap[8194] = 'ensp';
  charCodeToNamedMap[8195] = 'emsp';
  charCodeToNamedMap[8201] = 'thinsp';
  charCodeToNamedMap[8204] = 'zwnj';
  charCodeToNamedMap[8205] = 'zwj';
  charCodeToNamedMap[8206] = 'lrm';
  charCodeToNamedMap[8207] = 'rlm';
  charCodeToNamedMap[8211] = 'ndash';
  charCodeToNamedMap[8212] = 'mdash';
  charCodeToNamedMap[8216] = 'lsquo';
  charCodeToNamedMap[8217] = 'rsquo';
  charCodeToNamedMap[8218] = 'sbquo';
  charCodeToNamedMap[8220] = 'ldquo';
  charCodeToNamedMap[8221] = 'rdquo';
  charCodeToNamedMap[8222] = 'bdquo';
  charCodeToNamedMap[8224] = 'dagger';
  charCodeToNamedMap[8225] = 'Dagger';
  charCodeToNamedMap[8226] = 'bull';
  charCodeToNamedMap[8230] = 'hellip';
  charCodeToNamedMap[8240] = 'permil';
  charCodeToNamedMap[8242] = 'prime';
  charCodeToNamedMap[8243] = 'Prime';
  charCodeToNamedMap[8249] = 'lsaquo';
  charCodeToNamedMap[8250] = 'rsaquo';
  charCodeToNamedMap[8254] = 'oline';
  charCodeToNamedMap[8260] = 'frasl';
  charCodeToNamedMap[8364] = 'euro';
  charCodeToNamedMap[8465] = 'image';
  charCodeToNamedMap[8472] = 'weierp';
  charCodeToNamedMap[8476] = 'real';
  charCodeToNamedMap[8482] = 'trade';
  charCodeToNamedMap[8501] = 'alefsym';
  charCodeToNamedMap[8592] = 'larr';
  charCodeToNamedMap[8593] = 'uarr';
  charCodeToNamedMap[8594] = 'rarr';
  charCodeToNamedMap[8595] = 'darr';
  charCodeToNamedMap[8596] = 'harr';
  charCodeToNamedMap[8629] = 'crarr';
  charCodeToNamedMap[8656] = 'lArr';
  charCodeToNamedMap[8657] = 'uArr';
  charCodeToNamedMap[8658] = 'rArr';
  charCodeToNamedMap[8659] = 'dArr';
  charCodeToNamedMap[8660] = 'hArr';
  charCodeToNamedMap[8704] = 'forall';
  charCodeToNamedMap[8706] = 'part';
  charCodeToNamedMap[8707] = 'exist';
  charCodeToNamedMap[8709] = 'empty';
  charCodeToNamedMap[8711] = 'nabla';
  charCodeToNamedMap[8712] = 'isin';
  charCodeToNamedMap[8713] = 'notin';
  charCodeToNamedMap[8715] = 'ni';
  charCodeToNamedMap[8719] = 'prod';
  charCodeToNamedMap[8721] = 'sum';
  charCodeToNamedMap[8722] = 'minus';
  charCodeToNamedMap[8727] = 'lowast';
  charCodeToNamedMap[8730] = 'radic';
  charCodeToNamedMap[8733] = 'prop';
  charCodeToNamedMap[8734] = 'infin';
  charCodeToNamedMap[8736] = 'ang';
  charCodeToNamedMap[8743] = 'and';
  charCodeToNamedMap[8744] = 'or';
  charCodeToNamedMap[8745] = 'cap';
  charCodeToNamedMap[8746] = 'cup';
  charCodeToNamedMap[8747] = 'int';
  charCodeToNamedMap[8756] = 'there4';
  charCodeToNamedMap[8764] = 'sim';
  charCodeToNamedMap[8773] = 'cong';
  charCodeToNamedMap[8776] = 'asymp';
  charCodeToNamedMap[8800] = 'ne';
  charCodeToNamedMap[8801] = 'equiv';
  charCodeToNamedMap[8804] = 'le';
  charCodeToNamedMap[8805] = 'ge';
  charCodeToNamedMap[8834] = 'sub';
  charCodeToNamedMap[8835] = 'sup';
  charCodeToNamedMap[8836] = 'nsub';
  charCodeToNamedMap[8838] = 'sube';
  charCodeToNamedMap[8839] = 'supe';
  charCodeToNamedMap[8853] = 'oplus';
  charCodeToNamedMap[8855] = 'otimes';
  charCodeToNamedMap[8869] = 'perp';
  charCodeToNamedMap[8901] = 'sdot';
  charCodeToNamedMap[8968] = 'lceil';
  charCodeToNamedMap[8969] = 'rceil';
  charCodeToNamedMap[8970] = 'lfloor';
  charCodeToNamedMap[8971] = 'rfloor';
  charCodeToNamedMap[9001] = 'lang';
  charCodeToNamedMap[9002] = 'rang';
  charCodeToNamedMap[9674] = 'loz';
  charCodeToNamedMap[9824] = 'spades';
  charCodeToNamedMap[9827] = 'clubs';
  charCodeToNamedMap[9829] = 'hearts';
  charCodeToNamedMap[9830] = 'diams';

  var namedToCharCodeMap = {};
  namedToCharCodeMap['quot'] = 34;
  namedToCharCodeMap['amp'] = 38;
  namedToCharCodeMap['lt'] = 60;
  namedToCharCodeMap['gt'] = 62;
  namedToCharCodeMap['nbsp'] = 160;
  namedToCharCodeMap['iexcl'] = 161;
  namedToCharCodeMap['cent'] = 162;
  namedToCharCodeMap['pound'] = 163;
  namedToCharCodeMap['curren'] = 164;
  namedToCharCodeMap['yen'] = 165;
  namedToCharCodeMap['brvbar'] = 166;
  namedToCharCodeMap['sect'] = 167;
  namedToCharCodeMap['uml'] = 168;
  namedToCharCodeMap['copy'] = 169;
  namedToCharCodeMap['ordf'] = 170;
  namedToCharCodeMap['laquo'] = 171;
  namedToCharCodeMap['not'] = 172;
  namedToCharCodeMap['shy'] = 173;
  namedToCharCodeMap['reg'] = 174;
  namedToCharCodeMap['macr'] = 175;
  namedToCharCodeMap['deg'] = 176;
  namedToCharCodeMap['plusmn'] = 177;
  namedToCharCodeMap['sup2'] = 178;
  namedToCharCodeMap['sup3'] = 179;
  namedToCharCodeMap['acute'] = 180;
  namedToCharCodeMap['micro'] = 181;
  namedToCharCodeMap['para'] = 182;
  namedToCharCodeMap['middot'] = 183;
  namedToCharCodeMap['cedil'] = 184;
  namedToCharCodeMap['sup1'] = 185;
  namedToCharCodeMap['ordm'] = 186;
  namedToCharCodeMap['raquo'] = 187;
  namedToCharCodeMap['frac14'] = 188;
  namedToCharCodeMap['frac12'] = 189;
  namedToCharCodeMap['frac34'] = 190;
  namedToCharCodeMap['iquest'] = 191;
  namedToCharCodeMap['Agrave'] = 192;
  namedToCharCodeMap['Aacute'] = 193;
  namedToCharCodeMap['Acirc'] = 194;
  namedToCharCodeMap['Atilde'] = 195;
  namedToCharCodeMap['Auml'] = 196;
  namedToCharCodeMap['Aring'] = 197;
  namedToCharCodeMap['AElig'] = 198;
  namedToCharCodeMap['Ccedil'] = 199;
  namedToCharCodeMap['Egrave'] = 200;
  namedToCharCodeMap['Eacute'] = 201;
  namedToCharCodeMap['Ecirc'] = 202;
  namedToCharCodeMap['Euml'] = 203;
  namedToCharCodeMap['Igrave'] = 204;
  namedToCharCodeMap['Iacute'] = 205;
  namedToCharCodeMap['Icirc'] = 206;
  namedToCharCodeMap['Iuml'] = 207;
  namedToCharCodeMap['ETH'] = 208;
  namedToCharCodeMap['Ntilde'] = 209;
  namedToCharCodeMap['Ograve'] = 210;
  namedToCharCodeMap['Oacute'] = 211;
  namedToCharCodeMap['Ocirc'] = 212;
  namedToCharCodeMap['Otilde'] = 213;
  namedToCharCodeMap['Ouml'] = 214;
  namedToCharCodeMap['times'] = 215;
  namedToCharCodeMap['Oslash'] = 216;
  namedToCharCodeMap['Ugrave'] = 217;
  namedToCharCodeMap['Uacute'] = 218;
  namedToCharCodeMap['Ucirc'] = 219;
  namedToCharCodeMap['Uuml'] = 220;
  namedToCharCodeMap['Yacute'] = 221;
  namedToCharCodeMap['THORN'] = 222;
  namedToCharCodeMap['szlig'] = 223;
  namedToCharCodeMap['agrave'] = 224;
  namedToCharCodeMap['aacute'] = 225;
  namedToCharCodeMap['acirc'] = 226;
  namedToCharCodeMap['atilde'] = 227;
  namedToCharCodeMap['auml'] = 228;
  namedToCharCodeMap['aring'] = 229;
  namedToCharCodeMap['aelig'] = 230;
  namedToCharCodeMap['ccedil'] = 231;
  namedToCharCodeMap['egrave'] = 232;
  namedToCharCodeMap['eacute'] = 233;
  namedToCharCodeMap['ecirc'] = 234;
  namedToCharCodeMap['euml'] = 235;
  namedToCharCodeMap['igrave'] = 236;
  namedToCharCodeMap['iacute'] = 237;
  namedToCharCodeMap['icirc'] = 238;
  namedToCharCodeMap['iuml'] = 239;
  namedToCharCodeMap['eth'] = 240;
  namedToCharCodeMap['ntilde'] = 241;
  namedToCharCodeMap['ograve'] = 242;
  namedToCharCodeMap['oacute'] = 243;
  namedToCharCodeMap['ocirc'] = 244;
  namedToCharCodeMap['otilde'] = 245;
  namedToCharCodeMap['ouml'] = 246;
  namedToCharCodeMap['divide'] = 247;
  namedToCharCodeMap['oslash'] = 248;
  namedToCharCodeMap['ugrave'] = 249;
  namedToCharCodeMap['uacute'] = 250;
  namedToCharCodeMap['ucirc'] = 251;
  namedToCharCodeMap['uuml'] = 252;
  namedToCharCodeMap['yacute'] = 253;
  namedToCharCodeMap['thorn'] = 254;
  namedToCharCodeMap['yuml'] = 255;
  namedToCharCodeMap['OElig'] = 338;
  namedToCharCodeMap['oelig'] = 339;
  namedToCharCodeMap['Scaron'] = 352;
  namedToCharCodeMap['scaron'] = 353;
  namedToCharCodeMap['Yuml'] = 376;
  namedToCharCodeMap['fnof'] = 402;
  namedToCharCodeMap['circ'] = 710;
  namedToCharCodeMap['tilde'] = 732;
  namedToCharCodeMap['Alpha'] = 913;
  namedToCharCodeMap['Beta'] = 914;
  namedToCharCodeMap['Gamma'] = 915;
  namedToCharCodeMap['Delta'] = 916;
  namedToCharCodeMap['Epsilon'] = 917;
  namedToCharCodeMap['Zeta'] = 918;
  namedToCharCodeMap['Eta'] = 919;
  namedToCharCodeMap['Theta'] = 920;
  namedToCharCodeMap['Iota'] = 921;
  namedToCharCodeMap['Kappa'] = 922;
  namedToCharCodeMap['Lambda'] = 923;
  namedToCharCodeMap['Mu'] = 924;
  namedToCharCodeMap['Nu'] = 925;
  namedToCharCodeMap['Xi'] = 926;
  namedToCharCodeMap['Omicron'] = 927;
  namedToCharCodeMap['Pi'] = 928;
  namedToCharCodeMap['Rho'] = 929;
  namedToCharCodeMap['Sigma'] = 931;
  namedToCharCodeMap['Tau'] = 932;
  namedToCharCodeMap['Upsilon'] = 933;
  namedToCharCodeMap['Phi'] = 934;
  namedToCharCodeMap['Chi'] = 935;
  namedToCharCodeMap['Psi'] = 936;
  namedToCharCodeMap['Omega'] = 937;
  namedToCharCodeMap['alpha'] = 945;
  namedToCharCodeMap['beta'] = 946;
  namedToCharCodeMap['gamma'] = 947;
  namedToCharCodeMap['delta'] = 948;
  namedToCharCodeMap['epsilon'] = 949;
  namedToCharCodeMap['zeta'] = 950;
  namedToCharCodeMap['eta'] = 951;
  namedToCharCodeMap['theta'] = 952;
  namedToCharCodeMap['iota'] = 953;
  namedToCharCodeMap['kappa'] = 954;
  namedToCharCodeMap['lambda'] = 955;
  namedToCharCodeMap['mu'] = 956;
  namedToCharCodeMap['nu'] = 957;
  namedToCharCodeMap['xi'] = 958;
  namedToCharCodeMap['omicron'] = 959;
  namedToCharCodeMap['pi'] = 960;
  namedToCharCodeMap['rho'] = 961;
  namedToCharCodeMap['sigmaf'] = 962;
  namedToCharCodeMap['sigma'] = 963;
  namedToCharCodeMap['tau'] = 964;
  namedToCharCodeMap['upsilon'] = 965;
  namedToCharCodeMap['phi'] = 966;
  namedToCharCodeMap['chi'] = 967;
  namedToCharCodeMap['psi'] = 968;
  namedToCharCodeMap['omega'] = 969;
  namedToCharCodeMap['thetasym'] = 977;
  namedToCharCodeMap['upsih'] = 978;
  namedToCharCodeMap['piv'] = 982;
  namedToCharCodeMap['ensp'] = 8194;
  namedToCharCodeMap['emsp'] = 8195;
  namedToCharCodeMap['thinsp'] = 8201;
  namedToCharCodeMap['zwnj'] = 8204;
  namedToCharCodeMap['zwj'] = 8205;
  namedToCharCodeMap['lrm'] = 8206;
  namedToCharCodeMap['rlm'] = 8207;
  namedToCharCodeMap['ndash'] = 8211;
  namedToCharCodeMap['mdash'] = 8212;
  namedToCharCodeMap['lsquo'] = 8216;
  namedToCharCodeMap['rsquo'] = 8217;
  namedToCharCodeMap['sbquo'] = 8218;
  namedToCharCodeMap['ldquo'] = 8220;
  namedToCharCodeMap['rdquo'] = 8221;
  namedToCharCodeMap['bdquo'] = 8222;
  namedToCharCodeMap['dagger'] = 8224;
  namedToCharCodeMap['Dagger'] = 8225;
  namedToCharCodeMap['bull'] = 8226;
  namedToCharCodeMap['hellip'] = 8230;
  namedToCharCodeMap['permil'] = 8240;
  namedToCharCodeMap['prime'] = 8242;
  namedToCharCodeMap['Prime'] = 8243;
  namedToCharCodeMap['lsaquo'] = 8249;
  namedToCharCodeMap['rsaquo'] = 8250;
  namedToCharCodeMap['oline'] = 8254;
  namedToCharCodeMap['frasl'] = 8260;
  namedToCharCodeMap['euro'] = 8364;
  namedToCharCodeMap['image'] = 8465;
  namedToCharCodeMap['weierp'] = 8472;
  namedToCharCodeMap['real'] = 8476;
  namedToCharCodeMap['trade'] = 8482;
  namedToCharCodeMap['alefsym'] = 8501;
  namedToCharCodeMap['larr'] = 8592;
  namedToCharCodeMap['uarr'] = 8593;
  namedToCharCodeMap['rarr'] = 8594;
  namedToCharCodeMap['darr'] = 8595;
  namedToCharCodeMap['harr'] = 8596;
  namedToCharCodeMap['crarr'] = 8629;
  namedToCharCodeMap['lArr'] = 8656;
  namedToCharCodeMap['uArr'] = 8657;
  namedToCharCodeMap['rArr'] = 8658;
  namedToCharCodeMap['dArr'] = 8659;
  namedToCharCodeMap['hArr'] = 8660;
  namedToCharCodeMap['forall'] = 8704;
  namedToCharCodeMap['part'] = 8706;
  namedToCharCodeMap['exist'] = 8707;
  namedToCharCodeMap['empty'] = 8709;
  namedToCharCodeMap['nabla'] = 8711;
  namedToCharCodeMap['isin'] = 8712;
  namedToCharCodeMap['notin'] = 8713;
  namedToCharCodeMap['ni'] = 8715;
  namedToCharCodeMap['prod'] = 8719;
  namedToCharCodeMap['sum'] = 8721;
  namedToCharCodeMap['minus'] = 8722;
  namedToCharCodeMap['lowast'] = 8727;
  namedToCharCodeMap['radic'] = 8730;
  namedToCharCodeMap['prop'] = 8733;
  namedToCharCodeMap['infin'] = 8734;
  namedToCharCodeMap['ang'] = 8736;
  namedToCharCodeMap['and'] = 8743;
  namedToCharCodeMap['or'] = 8744;
  namedToCharCodeMap['cap'] = 8745;
  namedToCharCodeMap['cup'] = 8746;
  namedToCharCodeMap['int'] = 8747;
  namedToCharCodeMap['there4'] = 8756;
  namedToCharCodeMap['sim'] = 8764;
  namedToCharCodeMap['cong'] = 8773;
  namedToCharCodeMap['asymp'] = 8776;
  namedToCharCodeMap['ne'] = 8800;
  namedToCharCodeMap['equiv'] = 8801;
  namedToCharCodeMap['le'] = 8804;
  namedToCharCodeMap['ge'] = 8805;
  namedToCharCodeMap['sub'] = 8834;
  namedToCharCodeMap['sup'] = 8835;
  namedToCharCodeMap['nsub'] = 8836;
  namedToCharCodeMap['sube'] = 8838;
  namedToCharCodeMap['supe'] = 8839;
  namedToCharCodeMap['oplus'] = 8853;
  namedToCharCodeMap['otimes'] = 8855;
  namedToCharCodeMap['perp'] = 8869;
  namedToCharCodeMap['sdot'] = 8901;
  namedToCharCodeMap['lceil'] = 8968;
  namedToCharCodeMap['rceil'] = 8969;
  namedToCharCodeMap['lfloor'] = 8970;
  namedToCharCodeMap['rfloor'] = 8971;
  namedToCharCodeMap['lang'] = 9001;
  namedToCharCodeMap['rang'] = 9002;
  namedToCharCodeMap['loz'] = 9674;
  namedToCharCodeMap['spades'] = 9824;
  namedToCharCodeMap['clubs'] = 9827;
  namedToCharCodeMap['hearts'] = 9829;
  namedToCharCodeMap['diams'] = 9830;

  /**
   * @function decode
   * Decode ISO88591 characters, producing HTML Named Entities.  If no named
   * entity is available for the character code, a Numeric Character Entity
   * is produced instead.
   *
   *  var str = emca.data.entities.decode(src);
   *  var str = emca.data.entities.decode(src, bool);
   *
   * Where
   *
   *  src   <String>  Source text to decode
   *  bool  <Boolean> Also decode HTML markup characters (optional)
   *
   * In this example:
   *  var str = emca.data.entities.decode(“Hellagood”);
   * C<str> will be:
   *  &amp;ldquo;Hellagood&amp;rdquo;
   */

  this.decode = function (s, bHtml) {
    if (!js.util.isString(s)) return;
    var result = '';
    for (var i = 0; i < s.length; i++) {
      var cc = s.charCodeAt(i);
      if (!_isAllowed(cc)) continue;
      if (_isLower(cc) || _isUpper(cc) || (bHtml && _isMarkup(cc))) {
        var named = charCodeToNamedMap[cc];
        if (named) {
          result += '&' + named + ';';
        } else {
          result += '&#' + cc + ';';
        }
      } else {
        result += s.charAt(i);
      }
    }
    return result;
  };

  function _encodeEntity(entity, name, offset, str) {
    var cc = namedToCharCodeMap[name];
    return cc ? _encodeNumeric(entity, cc, offset, str) : entity;
  }

  function _encodeNumeric(entity, cc, offset, str) {
    return _isAllowed(cc) ? String.fromCharCode(cc) : entity;
  }

  function _encodeHex(entity, hexVal, offset, str) {
    var cc = parseInt(hexVal, 16); // Hexidecimal to decimal
    return _isAllowed(cc) ? String.fromCharCode(cc) : entity;
  }

  /**
   * @function encode
   */

  this.encode = function (str) {
    if (!js.util.isString(str)) return str;
    str = str.replace(/&([a-z]+);/ig, _encodeEntity);
    str = str.replace(/&#([0-9]+);/g, _encodeNumeric);
    str = str.replace(/&#x([0-9A-F]+);/gi, _encodeHex);
    return str;
  }

});


/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @class Pool
   *  var object = new ecma.data.Pool();
   */

  this.Pool = function CPool () {
    this.clear();
  };

  var _proto = this.Pool.prototype = ecma.lang.Methods();

  /**
   * @function clear - Remove all items from the pool
   *
   *  pool.clear();
   *
   */

  _proto.clear = function () {
    this.poolItems = [];
  };

  /**
   * @function get - Get an item from the pool
   *
   */

  _proto.get = function (cb) {
    if (!ecma.util.isCallback(cb)) {
      throw new TypeError('Callback function expected.');
    }
    for (var i = 0; i < this.poolItems.length; i++) {
      var item = this.poolItems[i];
      if (ecma.lang.callback(cb, null, [item])) {
        return item;
      }
    }
  };

  _proto.getIndex = function (cb) {
    for (var i = 0; i < this.poolItems.length; i++) {
      var item = this.poolItems[i];
      if (ecma.lang.callback(cb, null, [item])) {
        return i;
      }
    }
  };

  _proto.getAt = function (i) {
    return this.poolItems[i];
  };

  _proto.getAll = function () {
    return this.poolItems;
  };

  _proto.add = function (item) {
    return this.poolItems.push(item);
  };

  _proto.remove = function (item) {
    var i = this.getIndex(function (unk) {
      return unk === item;
    });
    if (ecma.util.defined(i)) {
      return this.poolItems.splice(i, 1);
    }
  };

  _proto.forEach = function (cb, scope) {
    var length = this.poolItems.length >>> 0;
    for (var i = 0; i < length; i++) {
      var item = this.poolItems[i];
      ecma.lang.callback(cb, scope, [item, i, this.poolItems]);
    }
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @class Node
   * A data structure and wrapper with an interface akin to the HTML and XML DOM.
   *
   *  var node = new ecma.data.Node();
   *  var node = new ecma.data.Node(data); // data may be any value type
   *
   * This class implements node insertion and removal, maintaining the child 
   * and sibling member references.
   *
   *  var list = ecma.data.createNode();
   *  list.appendChild('Alpha');
   *  list.appendChild(3.14);
   *  list.appendChild(false);
   *  var node = list.firstChild;
   *  while (node) {
   *    ecma.console.log(node.index, node.data);
   *    node = node.nextSibling;
   *  }
   *
   * The above example will write the following output to the console:
   *
   *  0 Alpha
   *  1 3.14
   *  2 false
   *
   * When child nodes are inserted they are first checked to see if they are
   * already derived from L<ecma.data.Node>.  If not, they are considered
   * data and passed to L<ecma.data.Node.createNode> for construction.
   *
   * Nodes which are appended or inserted will be removed from their
   * originating containers.  For example:
   *
   *  var l1 = ecma.data.Node();
   *  var a = l1.appendChild('a');
   *  var l2 = ecma.data.Node();
   *  l2.appendChild(a);              // a will be removed from l1
   *
   * @member data
   * Gets/sets the data associated with this node.
   *
   * @member childNodes
   * All child nodes of this node.
   *
   * @member rootNode
   * The root node of this hierarchy.
   *
   * @member parentNode
   * The parent node of this node or C<null> if this is a not a child of 
   * another node.
   *
   * @member previousSibling
   * The node immediately preceding this node in the tree, or C<null> if this
   * is the first child.
   *
   * @member nextSibling
   * The node immediately following this node in the tree, or C<null> if this
   * is the last child.
   *
   * @member firstChild
   * The first direct child node of this node or C<null> if there are no child
   * nodes.
   *
   * @member lastChild
   * The last direct child node of this node or C<null> if there are no child
   * nodes.
   *
   * @member index
   * The index of this node in the tree or C<null> if this is a not a child of 
   * another node.
   *
   */

  var CNode = this.Node = function (data) {
    ecma.action.ActionDispatcher.apply(this);
    this.id = this.generateId();
    this.data = data;
    this.layerDefinitions = {};
    this.layers = {};
    this.childNodes = [];
    this.rootNode = this;
    this.parentNode = null;
    this.previousSibling = null;
    this.nextSibling = null;
    this.firstChild = null;
    this.lastChild = null;
    this.index = null;
  };

  var _proto = this.Node.prototype = ecma.lang.createPrototype(
    ecma.action.ActionDispatcher
  );

  /**
   * Private Class Functions
   * These are designed be executed via C<call> or C<apply> with the scope of
   * a C<ecma.data.Node> instance.
   */

  function _crossCheck (node) {
    if (!ecma.util.isa(node, CNode)) {
      throw new Error('child is not a data node');
    }
    if (node.parentNode !== this) {
      throw new Error('child belongs to another parent');
    }
  }

  function _setChildMembers () {
    this.firstChild = this.childNodes[0];
    this.lastChild = this.childNodes[this.childNodes.length - 1];
  }

  function _instantiateLayer (name) {
    var layer = this.layers[name];
    if (!layer) {
      var klass = this.layerDefinitions[name];
      if (typeof(klass) == 'function') {
        layer = this.layers[name] = new klass(this, name);
      } else if (ecma.util.isObject(klass)) {
        layer = this.layers[name] = klass.createLayer(this, name);
      } else {
        throw new Error('Cannot instantiate layer: ' + name);
      }
    }
    return layer;
  }

  /**
   * Both prev/next members must be set for the prev, current, and next nodes.
   * Take for example a node which is moved as such:
   *
   *  -a- -b- -c- -d-
   *        __-^
   *       v
   *  -a- -c- -b- -d-
   *
   *    ^ ^ ^ ^ ^ ^   (need to be updated)
   *
   */
  function _relink (index) {
    for (var i = index - 1; i <= index + 1; i++) {
      if (i < 0) continue;
      if (i >= this.childNodes.length) break;
      var prevNode = i < 1 ? null : this.childNodes[i - 1];
      var currNode = i < this.childNodes.length ? this.childNodes[i] : null;
      var nextNode = i <= this.childNodes.length ? this.childNodes[i + 1] : null;
      if (prevNode) prevNode.nextSibling = currNode;
      if (currNode) currNode.previousSibling = prevNode;
      if (currNode) currNode.nextSibling = nextNode;
      if (nextNode) nextNode.previousSibling = currNode;
    }
  }

  function _unlink (node, bSilent) {
    return node.parentNode ? node.parentNode.removeChild(node, bSilent) : node;
  }

  function _vivify (node) {
    return ecma.util.isa(node, CNode)
      ? node
      : this.createNode.apply(this, arguments);
  }

  function _vivifyLayers () {
    this.layerDefinitions = ecma.util.clone(this.parentNode.layerDefinitions);
    for (var name in this.layerDefinitions) {
      _instantiateLayer.call(this, name);
    }
    return this.layers;
  }

  /** 
   * Event's are triggered on the container (parent) node, then the child.
   *
   * For example, if this is executed:
   *
   *    parentNode.removeChild(childNode);
   *
   * Then the following is triggered:
   *
   *    parentNode.onOrphan(childNode);   // First the parent
   *    childNode.onOrphaned();           // Then the child
   *
   * Notice that the action name (or class method) invoked on the child uses
   * the past participle. (As nodes are made to be nested.) In hindsight, it
   * would have been better to have named `onOrphan` as `onOrphanChild`.
   */

  function _trigger (actionName, node) {
    this.executeClassAction(actionName, node);
    _layerTrigger.call(this, actionName, node);
    node.executeClassAction(actionName + 'ed');
    _layerChildTrigger.call(node, actionName + 'ed');
  }

  function _nodeOnlyTrigger (actionName, node) {
    this.executeClassAction(actionName, node);
    node.executeClassAction(actionName + 'ed');
  }

  function _layerOnlyTrigger (actionName, node) {
    _layerTrigger.call(this, actionName, node);
    _layerChildTrigger.call(node, actionName + 'ed');
  }

  function _layerTrigger (actionName, node) {
    for (var name in this.layers) {
      var parentLayer = this.layers[name];
      if (parentLayer) {
        var childLayer = node.getLayer(name);
        if (childLayer) {
          parentLayer.executeClassAction(actionName, childLayer);
        }
      }
    }
  }

  function _layerChildTrigger (actionName) {
    for (var name in this.layers) {
      var layer = this.getLayer(name);
      if (layer) {
        layer.executeClassAction(actionName);
      }
    }
  }

  function _actionTrigger (actionName) {
    this.executeClassAction(actionName);
    for (var name in this.layers) {
      var layer = this.layers[name];
      if (layer) {
        layer.executeClassAction(actionName);
      }
    }
  }

  /**
   * Public Class Functions
   */

  /**
   * @function addLayer
   *
   *  addLayer(name, constructor);
   *  addLayer(name, object);
   *
   * @param name <String> A name unique to this node hierarchy for the layer
   * @param constructor <Function> The layer constructor function
   * @param object <Object> An object with a `createLayer` function
   *
   * Otherwise, its `createLayer` function is called immediately for this
   * [top-level] node to which it is being added.
   */

  _proto.addLayer = function (name, klass) {
    if (this.layerDefinitions[name]) {
      throw new Error('Layer named "' + name + '" exists');
    }
    this.layerDefinitions[name] = klass;
    var newLayer = _instantiateLayer.call(this, name);
    var childNode = this.firstChild;
    while (childNode) {
      var childLayer = childNode.addLayer(name, klass);
      if (childLayer) {
        if (newLayer) {
          newLayer.executeClassAction('onAdopt', childLayer);
        }
        childLayer.executeClassAction('onAdopted');
      }
      childNode = childNode.nextSibling;
    }
    return newLayer;
  };

  /**
   * @function removeLayer
   */

  _proto.removeLayer = function (name) {
    var layer = this.layers[name];
    delete this.layers[name];
    var childNode = this.firstChild;
    while (childNode) {
      var childLayer = childNode.removeLayer(name);
      if (childLayer) {
        layer.executeClassAction('onRemove', childLayer);
        childLayer.executeClassAction('onRemoved');
      }
      childNode = childNode.nextSibling;
    }
    delete this.layerDefinitions[name];
    return layer;
  };

  /**
   * @function getLayer
   */

  _proto.getLayer = function (name) {
    return this.layers[name];
  };

  _proto.getDataNode = function () {
    return this.data && js.util.isFunction(this.data.getDataNode)
      ? this.data.getDataNode()
      : this.data;
  };

  /**
   * @function getParentLayer
   */

  _proto.getParentLayer = function (name) {
    var layer = null;
    while (node.parentNode && !layer) {
      node = node.parentNode;
      layer = node.getLayer(name);
    }
    return layer;
  };

  /**
   * @function generateId
   * Create an identifier unique to each instance
   * Used internally however available for override.
   */

  _proto.generateId = function () {
    return js.util.randomId('n', 100000);
  };

  /**
   * @function createNode
   * Creates a new node for placement as a child of this node.
   *  var newNode = node.createNode();
   *  var newNode = node.createNode(data);
   */

  _proto.createNode = function (data) {
    return new CNode(data);
  };

  /**
   * @function appendChild
   * Adds a node to the end of the list of children of a specified parent 
   * node.
   *  var appendedNode = node.appendChild(data);
   *  var appendedNode = node.appendChild(newNode);
   * If the new node already exists it is removed from its parent node, then 
   * added to the specified parent node.
   */

  _proto.appendChild = function (node) {
    node = _vivify.apply(this, arguments);
    var isChild = node.parentNode === this;
    _unlink.call(this, node, isChild);
    node.previousSibling = this.lastChild;
    node.nextSibling = null;
    if (this.lastChild) this.lastChild.nextSibling = node;
    this.childNodes.push(node);
    node.index = this.childNodes.length - 1;
    node.parentNode = this;
    node.rootNode = this.rootNode || this;
    _setChildMembers.call(this);
    if (!isChild) _nodeOnlyTrigger.call(this, 'onAdopt', node);
    _vivifyLayers.call(node);
    if (!isChild) _layerOnlyTrigger.call(this, 'onAdopt', node);
    return node;
  };

  /**
   * @function appendChildren
   * Appends multiple child nodes to this node.
   *  var appendedNodes = node.appendChildren([data1, data2, ...]);
   * See also L<appendChild>
   */

  _proto.appendChildren = function (nodes) {
    if (!nodes || !ecma.util.isArray(nodes)) {
      return undefined;
    }
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      result.push(this.appendChild(nodes[i]));
    }
    return result;
  };

  /**
   * @function sortCompare
   */

  _proto.sortCompare = function (a, b) {
    return a && b
      ? a.toString().localeCompare(b.toString())
      : a ? -1 : b ? 1 : 0;
  };

  /**
   * @function sort
   */

  _proto.sort = function () {
    var sorted = [].concat(this.childNodes).sort(this.sortCompare);
    var hasChanged = false;
    for (var i = 0; i < sorted.length; i++) {
      var child = sorted[i];
      if (this.childNodes[i] !== child) {
        hasChanged = true;
        this.insertBefore(child, this.childNodes[i]);
        _actionTrigger.call(child, 'onReordered');
//      _trigger.call(this, 'onReorder', child);
      }
    }
    if (hasChanged) _actionTrigger.call(this, 'onReorder');
  };

  /**
   * @function insertChild
   * Insert a child according to this node's sort order.
   */

  _proto.insertChild = function (node) {
    node = _vivify.apply(this, arguments);
    var child = this.firstChild;
    var prev, next;
    while (child) {
      var delta = this.sortCompare(node, child);
      if (delta < 0) {
        next = child;
        break;
      } else if (delta == 0) {
        next = child;
        break;
      } else {
        prev = child;
      }
      child = child.nextSibling;
    }
    return next
      ? this.insertBefore(node, next)
      : prev
        ? this.insertAfter(node, prev)
        : this.appendChild(node);
  };

  /**
   * @function insertChildren
   * Insert multiple child nodes to this node.
   *  var insertedNodes = node.insertChildren([data1, data2, ...]);
   * See also L<insertChild>
   */

  _proto.insertChildren = function (nodes) {
    if (!nodes || !ecma.util.isArray(nodes)) {
      return undefined;
    }
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      result.push(this.insertChild(nodes[i]));
    }
    return result;
  };

  /**
   * @function insertBefore
   * Inserts the specified node before a reference node as a child of the 
   * current node. 
   *  var insertedNode = parentNode.insertBefore(data, referenceNode)
   *  var insertedNode = parentNode.insertBefore(newNode, referenceNode)
   * If the newNode already exists it is removed from its parent node, then 
   * inserted into the specified parent node.
   */

  _proto.insertBefore = function (node, child, args) {
    _crossCheck.call(this, child);
    if (args) {
      args.unshift(node)
    } else {
      args = [node];
    }
    node = _vivify.apply(this, args);
    var isChild = node.parentNode === this;
    _unlink.call(this, node, isChild);
    var index = child.index;
    this.childNodes.splice(index, 0, node);
    result = node;
    for (var i = index; i < this.childNodes.length; i++) {
      this.childNodes[i].index = i;
    }
    _relink.call(this, index);
    node.parentNode = this;
    node.rootNode = this.rootNode || this;
    _setChildMembers.call(this);
    if (!isChild) _nodeOnlyTrigger.call(this, 'onAdopt', node);
    _vivifyLayers.call(node);
    if (!isChild) _layerOnlyTrigger.call(this, 'onAdopt', node);
    return node;
  };

  /**
   * @function insertAfter
   * Inserts the specified node after a reference node as a child of the
   * current node.
   *  var insertedNode = parentNode.insertAfter(data, referenceNode)
   *  var insertedNode = parentNode.insertAfter(newNode, referenceNode)
   * If the newNode already exists it is removed from its parent node, then 
   * inserted into the specified parent node.
   */

  _proto.insertAfter = function (node, child) {
    _crossCheck.call(this, child);
    return child.nextSibling
      ? this.insertBefore(node, child.nextSibling)
      : this.appendChild(node);
  };

  /**
   * @function removeChild
   * Removes a child node.
   *  removedNode = parentNode.removeChild(childNode);
   */

  _proto.removeChild = function (node, bSilent) {
    _crossCheck.call(this, node);
    var result = null;
    var index = 0;
    for (; index < this.childNodes.length; index++) {
      if (this.childNodes[index] === node) {
        result = node;
        this.childNodes.splice(index, 1);
        break;
      }
    }
    if (!result) {
      throw new Error('programatic error, known child not found');
    }
    for (var i = index; i < this.childNodes.length; i++) {
      this.childNodes[i].index--;
    }
    _relink.call(this, index);
    _setChildMembers.call(this);
    result.previousSibling = null;
    result.nextSibling = null;
    result.parentNode = null;
    result.rootNode = null;
    // Preserve result.index
    if (!bSilent) _trigger.call(this, 'onOrphan', result);
//
//  When silent, still need to unlink layers...
//
//  _instantiateLayers would then relink (on existing layers)
//
//  Right now the relinking all happens in Layer.onReorder
//
    return result;
  };

  /**
   * @function removeAllChildren
   * Remove all child nodes.
   *  parentNode = parentNode.removeAllChildren();
   */

  _proto.removeAllChildren = function () {
    for (var i = 0; i < this.childNodes.length; i++) {
      var child = this.childNodes[i];
      child.previousSibling = null;
      child.nextSibling = null;
      child.parentNode = null;
      child.rootNode = null;
      // Preserve child.index
      _trigger.call(this, 'onOrphan', child);
    }
    this.childNodes = [];
    this.firstChild = null;
    this.lastChild = null;
    return this;
  };

  /**
   * @function replaceChild
   * Replaces one child node of the specified parent node with another.
   *  replacedNode = parentNode.replaceChild(data, childNode);
   *  replacedNode = parentNode.replaceChild(newNode, childNode);
   * If the newNode already exists it is removed from its parent node, then 
   * inserted into the specified parent node.
   */

  _proto.replaceChild = function (node, child, args) {
    _crossCheck.call(this, child);
    if (args) {
      args.unshift(node)
    } else {
      args = [node];
    }
    node = _vivify.apply(this, args);
    var isChild = node.parentNode === this;
    _unlink.call(this, node, isChild);
    node.previousSibling = child.previousSibling;
    node.nextSibling = child.nextSibling;
    node.index = child.index;
    var result = this.childNodes[child.index];
    this.childNodes[child.index] = node;
    node.parentNode = this;
    node.rootNode = this.rootNode || this;
    _setChildMembers.call(this);
    _unlink.call(this, child);
    if (!isChild) _nodeOnlyTrigger.call(this, 'onAdopt', node);
    _vivifyLayers.call(node);
    if (!isChild) _layerOnlyTrigger.call(this, 'onAdopt', node);
    return result;
  };

  /**
   * @function walk
   * Recursively iterate into each node applying the callback function.
   *
   *  node.walk(callback);
   *  node.walk(function);
   *  node.walk(function, scope);
   *  node.walk(function, scope, args);
   *
   * The callback function's first argument is always:
   *
   *  node        The current node
   *
   * and can return:
   *
   *  undefined   Keep walking
   *  'continue;' Move on to the next sibling (returns undefined)
   *  'break;'    Stop walking (returns undefined)
   *  !undefined  Stop walking (returns said value)
   */

  var _break = _proto.BREAK = {signal:'break;'};
  var _continue = _proto.CONTINUE = {signal:'continue;'};

  function _walk (cb) {
    var node = this.firstChild;
    var result = undefined;
    while (node) {
      result = ecma.lang.callback(cb, this, [node]);
      if (!result && node.hasChildNodes()) {
        result = _walk.call(node, cb);
      }
      if (result && result !== _continue) {
        break;
      }
      node = node.nextSibling;
    }
    return result;
  }

  _proto.walk = function (callback, scope, args) {
    var cb = ecma.lang.createCallback(arguments);
    var result = _walk.call(this, cb);
    return result && (result === _break || result === _continue)
      ? undefined
      : result;
  };

  /**
   * @function iterate
   *
   * Like L<walk> however not recursive.
   */

  _proto.iterate = function (callback, scope, args) {
    var cb = ecma.lang.createCallback(arguments);
    var node = this.firstChild;
    var result;
    while (node) {
      result = ecma.lang.callback(cb, this, [node]);
      if (result && result !== _continue) {
        break;
      }
      node = node.nextSibling;
    }
    return result && (result === _break || result === _continue)
      ? undefined
      : result;
  };

  /**
   * @class getNodeByData
   */

  _proto.getNodeByData = function (data) {
    return this.walk(function (n) {
      if (n.data === data) return n;
    });
  };

  /**
   * @function getDepth
   * Return the number of ancestors for this node.
   *  var depth = node.getDepth();
   */

  _proto.getDepth = function () {
    var node = this;
    var depth = 0;
    while (node = node.parentNode) {
      depth++;
    }
    return depth;
  };

  /**
   * @function hasChildNodes
   * Checks for the existence of child nodes.
   *  var bool = node.hasChildNodes();
   */

  _proto.hasChildNodes = function () {
    return this.childNodes.length > 0;
  };

  /**
   * @function toString
   */

  _proto.toString = function () {
    return this.id;
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  function _relink (index) {
    for (var i = index - 1; i <= index + 1; i++) {
      if (i < 0) continue;
      if (i >= this.childNodes.length) break;
      var prevNode = i < 1 ? null : this.childNodes[i - 1];
      var currNode = i < this.childNodes.length ? this.childNodes[i] : null;
      var nextNode = i <= this.childNodes.length ? this.childNodes[i + 1] : null;
      if (prevNode) prevNode.nextSibling = currNode;
      if (currNode) currNode.previousSibling = prevNode;
      if (currNode) currNode.nextSibling = nextNode;
      if (nextNode) nextNode.previousSibling = currNode;
    }
  }

  function _setChildMembers () {
    this.firstChild = this.childNodes[0];
    this.lastChild = this.childNodes[this.childNodes.length - 1];
    var child = this.firstChild;
    for (var i = 0; i < this.childNodes.length; i++) {
      this.childNodes[i].index = i;
    }
  }

  var CActionDispatcher = ecma.action.ActionDispatcher;

  /**
   * @class CNodeLayer
   */

  var CNodeLayer = this.NodeLayer = function (node, name) {
    CActionDispatcher.apply(this);
    this.node = node;
    this.layerName = name;
    this.childNodes = [];
    this.rootNode = this;
    this.parentNode = null;
    this.previousSibling = null;
    this.nextSibling = null;
    this.firstChild = null;
    this.lastChild = null;
    this.index = null;
    ecma.lang.assert(ecma.util.isDefined(this.layerName),
        'Node layers MUST be named.');
    if (node.parentNode) {
      // Due to filtering, the index of the layer may differ from the index of 
      // its node. See ecma.data.Node's layer instantiation, where the layer
      // is an instance with a createLayer method (which may return null).
      var parentLayer = node.parentNode.getLayer(this.layerName);
      if (parentLayer) {
        var numChildren = parentLayer.childNodes.length;
        var index = numChildren > 0
          ? Math.min(numChildren, node.index)
          : 0;
        parentLayer.childNodes.splice(index, 0, this);
        this.index = index;
        this.parentNode = parentLayer;
        this.rootNode = parentLayer.rootNode;
        _relink.call(parentLayer, index);
        _setChildMembers.call(parentLayer);
      }
    }
  };

  var _proto = this.NodeLayer.prototype = ecma.lang.createPrototype(
    CActionDispatcher
  );

  /**
   * @function onAdopt
   */

  _proto.onAdopt = function (layer) {
    // Handled in constructor because a derived class' constructor wants this 
    // layer to be hooked up.
  };

  _proto.onAdopted = function () {
  };

  /**
   * @function onOrphan
   */

  _proto.onOrphan = function (layer) {
    var index = layer.index;
    this.childNodes.splice(index, 1);
    layer.parentNode = null;
    layer.rootNode = null;
    _relink.call(this, index);
    _setChildMembers.call(this);
  };

  /**
   * @function onOrphaned
   */

  _proto.onOrphaned = function () {
  };

  /**
   * @function onReordered
   */

  _proto.onReordered = function () {
    var oldIndex = this.index;
    var newIndex = 0;
    var parentLayer
    try {
      var node = this.node.parentNode.firstChild;
      while (node && node !== this.node) {
        if (node.getLayer(this.layerName)) newIndex++;
        node = node.nextSibling;
      }
    } catch (ex) {
    }
    if (newIndex == oldIndex) return;
    this.parentNode.childNodes.splice(oldIndex, 1);
    this.parentNode.childNodes.splice(newIndex, 0, this);
    this.index = newIndex;
    _relink.call(this.parentNode, oldIndex);
    _relink.call(this.parentNode, newIndex);
    _setChildMembers.call(this.parentNode);
  };

  /**
   * @function onReorder
   */

  _proto.onReorder = function () {
  };

  /**
   * @function walk
   * Recursively iterate into each node applying the callback function.
   *
   *  node.walk(function);
   *  node.walk(function, scope);
   *
   * The callback function is passed one parameter
   *
   *  node    The current node
   */

  _proto.walk = function (callback, scope) {
    function nodeCallback (node) {
      var layer = node.getLayer(this.layerName);
      if (layer) {
        callback.call(scope || this, layer);
      }
    }
    this.node.walk(nodeCallback, this);
  };

  _proto.getDataNode = function () {
    return this.node ? this.node.getDataNode() : null;
  };

  /**
   * @function hasChildNodes
   * Checks for the existence of child nodes.
   *  var bool = node.hasChildNodes();
   */

  _proto.hasChildNodes = function () {
    return this.childNodes.length > 0;
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @function addr_split
   * Splits the given address into segments.
   *  var array = addr_split('/alpha/bravo');
   * The above example will return:
   *  ['alpha', 'bravo']
   */

  this.addr_split = function (addr) {
    if (ecma.util.isArray(addr)) return addr;
    if (!ecma.util.defined(addr) || addr === "" || addr == '/') return [];
    if (!ecma.util.isString(addr)) return [addr];
    return addr.replace(/^\//, '').split('/');
  };

  /**
   * @function addr_normalize
   * Normalize the given address.
   *  var string = addr_normalize('/alpha//bravo/');
   * The above example will return:
   *  /alpha/bravo
   */

  this.addr_normalize = function (addr) {
    if (!ecma.util.defined(addr) || addr === "") return '';
    if (typeof(addr) == 'string') {
      addr = addr.replace(/\/{2,}/g, '/');
      if (addr == '/') return addr;
      addr = addr.replace(/\/$/, '');
      // TODO replace '../foo' constructs
      return addr;
    }
  };

  /**
   * @function addr_ext
   * Get the extension portion of the address.
   *  var string = addr_ext('/alpha/bravo.charlie');
   * The above example will return:
   *  charlie
   */

  this.addr_ext = function (addr) {
    var lastKey = this.addr_split(addr).pop();
    if (!lastKey) return;
    if (typeof(lastKey) != 'string') return;
    if (lastKey.indexOf('.') <= 0) return;
    return lastKey.split('.').pop();
  };

  /**
   * @function addr_parent
   * Get the parent address of the address.
   *  var string = addr_parent('/alpha/bravo');
   * The above example will return:
   *  /alpha
   */

  this.addr_parent = function (addr) {
    var parts = this.addr_split(addr);
    parts.pop();
    var result = parts.length ? parts.join('/') : '';
    return addr.indexOf('/') == 0 ? '/' + result : result;
  };

  /**
   * @function addr_name
   * Get the name portion of the address.
   *  var string = addr_name('/alpha/bravo.charlie');
   * The above example will return:
   *  bravo.charlie
   */

  this.addr_name = function (addr) {
    var parts = this.addr_split(addr);
    return parts.pop();
  };

  /**
   * @function addr_join
   * Join the array elements to create an address.
   *  var string = addr_join(['alpha', 'bravo']);
   * The above example will return:
   *  alpha/bravo
   */

  this.addr_join = function () {
    var args = ecma.util.args(arguments);
    var addr = args.shift();
    if (!addr) throw new Error('Missing Argument: addr');
    var list = addr instanceof Array ? addr : [addr];
    list = list.concat(args);
    return ecma.data.addr_normalize(list.join('/').replace(/^\/\//, '/'));
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @class Container
   * Base class for L<ecma.data.Array> and L<ecma.data.HashList>.
   */

  this.Container = function () {
  };

  /**
   * @function clear
   * Clear contents
   */

  this.Container.prototype.clear = ecma.lang.createAbstractFunction();

  /**
   * @function get
   * Get a value by its address.
   *  var value = container.get('alpha');
   *  var value = container.get('alpha/bravo');
   *  var value = container.get('alpha/bravo/0');
   */
  this.Container.prototype.get = function (addr) {
    if (!ecma.util.defined(addr) || addr === '') return;
    var parts = ecma.data.addr_split(addr);
    var c = this;
    for (var i = 0; i < parts.length; i++) {
      if (typeof(c) == 'undefined' || !c.getValue) return;
      c = c.getValue(parts[i]);
    }
    return c;
  };

  /**
   * @function set
   * Set a value at the given address.
   *  container.setValue('alpha', {});
   *  container.setValue('alpha/bravo', []);
   *  container.setValue('alpha/bravo/0', 'charlie');
   */
  this.Container.prototype.set = function (addr, value) {
    var parts = ecma.data.addr_split(addr);
    var lastKey = parts.pop();
    if (ecma.util.defined(lastKey)) {
      var ptr = this;
      for (var i = 0; i < parts.length; i++) {
        var key = parts[i];
        var node = ptr.getValue(key);
        if (!ecma.util.defined(node)) {
          node = ptr.setValue(key, new ecma.data.HashList());
        }
        ptr = node;
      }
      return ptr.setValue(lastKey, value);
    } else if (ecma.util.isa(value, ecma.data.Container)) {
      this.clear();
      value.iterate(function (k, v) {
        this.set(k, v);
      }, this);
    }
  };

  /**
   * @function remove
   * Remove a value by its address.
   *  container.remove('/alpha/bravo');
   */
  this.Container.prototype.remove = function (addr) {
    var parts = ecma.data.addr_split(addr);
    var lastKey = parts.pop();
    if (!ecma.util.defined(lastKey)) return;
    var parent = this.get(parts);
    if (ecma.util.isa(parent, ecma.data.Container)) parent.removeValue(lastKey);
  };

  /**
   * @function walk
   * Recursively iterate the container applying a callback with each item.
   *
   *  container.walk(function);
   *  container.walk(function, scope);
   *
   * The callback function is passed four parameters
   *
   *  key     The current key
   *  value   The current value
   *  depth   Integer index indicating how deep we have recursed
   *  addr    The address of the current value
   *  pv      The pv of the current value
   *
   *  container.walk(function (key, value, depth, addr, pv) {
   *  });
   */
  this.Container.prototype.walk = function (callback, scope, prefix, depth) {
    if (!depth) depth = 0;
    this.iterate(function (k,v) {
      var addr = ecma.util.defined(prefix) ? prefix + '/' + k : k;
      callback.apply(scope, [k, v, depth, addr, this]);
      if (ecma.util.isa(v, ecma.data.Container)) {
        v.walk(callback, scope, addr, (depth + 1));
      }
    }, this);
  };

  /**
   * @function toObject
   * Create a (normal) JavaScript Object from this container.
   *
   *  var Array = container.toObject();   // when it is an ecma.data.Array
   *  var Object = container.toObject();  // when it is an ecma.data.HashList
   */
  this.Container.prototype.toObject = function () {
    var result = ecma.util.isa(this, ecma.data.Array) ? [] : {};
    this.iterate(function (k, v) {
      result[k] = typeof(v.toObject) == 'function' ? v.toObject() : v;
    }, this);
    return result;
  };

  /**
   * @function toXFR
   * Create a transfer-encoded string which represents the data.
   *  var string = container.toXFR();
   */
  this.Container.prototype.toXFR = function () {
    var result = '';
    this.iterate(function (k, v) {
      result += ecma.data.xfr.encodeComponent(k);
      result += v.toXFR ? v.toXFR() : '${' + ecma.data.xfr.encodeComponent(v) + '}';
    }, this);
    return result;
  };

  /**
   * @function getObject
   * Return the object representation of this or the specified child.
   *  var object = container.getObject();
   *  var object = container.getObject('/alpha/bravo');
   */

  this.Container.prototype.getObject = function (addr) {
    if (!ecma.util.defined(addr)) return this.toObject();
    var v = this.get(addr);
    return ecma.util.defined(v) ? v.toObject() : v;
  };


  /**
   * @function getString
   * Return the string representation of this or the specified child.
   *  var string = container.getString();
   *  var string = container.getString('/alpha/bravo');
   */

  this.Container.prototype.getString = function (addr) {
    if (!ecma.util.defined(addr)) return this.toString();
    var v = this.get(addr);
    return ecma.util.defined(v) ? v.toString() : v;
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @class Array
   * Wrapper class for JavaScript Arrays which extends L<ecma.data.Container>.
   *  var object = new ecma.data.Array();
   *  var object = new ecma.data.Array('alpha', 'bravo');
   * TODO Create methods: C<shift, unshift>
   */
  this.Array = function () {
    this.clear();
    var args = ecma.util.args(arguments);
    if (args) {
      this.data = args;
      this.length = this.data.length;
    }
  };

  this.Array.prototype = ecma.lang.Methods(ecma.data.Container);

  /**
   * @function clear
   * Remove all items.
   */
  this.Array.prototype.clear = function () {
    this.data = [];
    this.length = 0;
  };

  /**
   * @function getValue
   * Get a value by its index.
   *  var unknown = array.getValue(0);
   */
  this.Array.prototype.getValue = function (key) {
    return this.data[key];
  };

  /**
   * @function setValue
   * Set a value by its index.
   *  array.setValue(0, 'alpha');
   */
  this.Array.prototype.setValue = function (key, value) {
    if (typeof(key) != 'number') key = ecma.util.asInt(key);
    var result = this.data[key] = value;
    this.length = this.data.length;
    return result;
  };

  this.Array.prototype.indexOfKey = function (key) {
    return js.util.asInt(key);
  };

  this.Array.prototype.indexOfValue = function (value) {
    for (var i = 0; i < this.data.length; i++) {
      if (this.data[i] === value) return i;
    }
    return null;
  };

  /**
   * @function push
   * Push a value on to the end of the array.
   *  array.push('bravo');
   * Returns the value pushed on to the array.
   */
  this.Array.prototype.push = function (value) {
    return this.setValue(this.data.length, value);
  };

  /**
   * @function removeValue
   * Remove a value from the array by its index.
   *  array.removeValue(0);
   * Returns the value removed from the array.
   */
  this.Array.prototype.removeValue = function (key) {
    if (typeof(key) != 'number') key = ecma.util.asInt(key);
    var result = this.data.splice(key, 1);
    this.length = this.data.length;
    return result[0]; // we know we only spliced 1 element
  };

  /**
   * @function keys
   * Get an array of this array's indexes.
   *  var array = array.keys();
   */
  this.Array.prototype.keys = function () {
    var result = [];
    for (var i = 0; i < this.data.length; i++) {
      result.push(i);
    }
    return result;
  };

  /**
   * @function values
   * Get an array of this array's values.
   *  var array = array.values();
   */
  this.Array.prototype.values = function () {
    return [].concat(this.data); // copy
  };

  /**
   * @function iterate
   * Iterate the array, applying a callback function with each item.
   *  array.iterate(function (index, value) { ... });
   *  array.iterate(function (index, value) { ... }, scope);
   */
  this.Array.prototype.iterate = function (cb, scope) {
    for (var i = 0; i < this.data.length; i++) {
      ecma.lang.callback(cb, scope, [i, this.data[i]]);
    }
  };

  /**
   * @function toXFR
   * Create a transfer-encoded string representing this array.
   *  var string = array.toXFR();
   */
  this.Array.prototype.toXFR = function () {
    var result = '';
    this.iterate(function (k, v) {
      result += v.toXFR ? v.toXFR() : '${' + ecma.data.xfr.encodeComponent(v) + '}';
    }, this);
    return '@{' + result + '}';
  };

});

/** @namespace data */
ECMAScript.Extend('data', function (ecma) {

  /**
   * @class HashList
   * Object where members are kept in fifo order.
   *  var hash = new ecma.data.HashList();
   *  var hash = new ecma.data.HashList('key1', 'val1', 'key2', 'val2');
   */
  this.HashList = function () {
    this.clear();
    for (var i = 0; arguments && i < arguments.length; i += 2) {
      var k = arguments[i];
      var v = arguments[i+1];
      this.indicies.push(k);
      this.data[k] = v;
    }
    this.length = this.indicies.length;
  };

  /** @base ecma.dom.Container */
  this.HashList.prototype = ecma.lang.Methods(ecma.data.Container);

  /**
   * @method clear
   * Remove all elements from the hash.
   *  hash.clear();
   */
  this.HashList.prototype.clear = function () {
    this.indicies = [];
    this.data = {};
    this.length = 0;
  };

  /**
   * @function getValue
   * Get a value by its key.
   *  var unknown = hash.getValue('key1');
   */
  this.HashList.prototype.getValue = function (key) {
    return this.data[key];
  };

  /**
   * @function setValue
   * Set a value by its key.
   *  var unknown = hash.setValue('key1', 'val1');
   */
  this.HashList.prototype.setValue = function (key, value, index) {
    var currentIndex = this.indexOfKey(key);
    if (ecma.util.defined(index) && currentIndex != index) {
      if (index < 0 || index > this.indicies.length)
        throw new ecma.error.IllegalArg('index');
      if (currentIndex != null) {
        this.indicies.splice(currentIndex, 1);
        if (currentIndex < index) index--;
      }
      this.indicies.splice(index, 0, key);
    } else {
      if (currentIndex == null) this.indicies.push(key);
    }
    this.length = this.indicies.length;
    return this.data[key] = value;
  };

  this.HashList.prototype.indexOfKey = function (key) {
    for (var i = 0; i < this.indicies.length; i++) {
      if (this.indicies[i] == key) return i;
    }
    return null;
  };

  this.HashList.prototype.indexOfValue = function (value) {
    for (var i = 0; i < this.indicies.length; i++) {
      if (this.data[this.indicies[i]] === value) return i;
    }
    return null;
  };

  /**
   * @function removeValue
   * Remove an item from the hash by its key.
   *  var unknown = hash.removeValue('key1');
   */
  this.HashList.prototype.removeValue = function (key) {
    for (var i = 0; i < this.indicies.length; i++) {
      if (this.indicies[i] == key) {
        this.indicies.splice(i, 1);
        break;
      }
    }
    this.length = this.indicies.length;
    var result = this.data[key];
    delete this.data[key];
    return result;
  };

  /**
   * @function keys
   * Get the array of the keys keys used in this hash.
   *  var array = hash.keys();
   */
  this.HashList.prototype.keys = function () {
    return [].concat(this.indicies);
  };

  /**
   * @function values
   * Get an array of this hash's values.
   *  var array = hash.values();
   */
  this.HashList.prototype.values = function () {
    var result = [];
    for (var i = 0; i < this.indicies.length; i++) {
      result.push(this.data[this.indicies[i]])
    }
    return result;
  };

  /**
   * @function iterate
   * Iterate the hash, applying a callback function with each item.
   *  hash.iterate(function (key, value) { ... });
   *  hash.iterate(function (key, value) { ... }, scope);
   */
  this.HashList.prototype.iterate = function (cb, scope) {
    for (var i = 0; i < this.indicies.length; i++) {
      var key = this.indicies[i];
      ecma.lang.callback(cb, scope, [key, this.data[key]]);
    }
  };

  /**
   * @function toXFR
   * Create a transfer-encoded string representing this hash.
   *  var string = hash.toXFR();
   */
  this.HashList.prototype.toXFR = function () {
    return '%{' + ecma.data.Container.prototype.toXFR.apply(this, arguments) + '}';
  };

  /**
   * @namespace data
   * @class OrderedHash
   * Depricated (use L<ecma.data.HashList>)
   */
  this.OrderedHash = this.HashList;

});


/** @namespace data */

ECMAScript.Extend('data', function (ecma) {

  var _proto = {};

  var _symbolToClassMap = {
    /*
    '?': ecma.window.Boolean,
    '#': ecma.window.Number,
    '~': ecma.window.Date,
    */
    '%': ecma.data.HashList,
    '@': ecma.data.Array,
    '$': ecma.window.String
  };

  var _typeToSymbolMap = {
    /*
    'boolean':  '?',
    'number':   '#' ,
    */
    'string':   '$'
  };

  /**
   * @class XFR
   */

  this.XFR = function (encoding) {
    this.encoding = encoding;
  };

  this.XFR.prototype = _proto;

  /**
   * @function symbolToClass
   * Get the class constructor for the provided symbol.
   */

  _proto.symbolToClass = function (symbol) {
    var klass = _symbolToClassMap[symbol];
    return klass;
  };

  /**
   * @function classToSymbol
   */

  _proto.classToSymbol = function (obj) {
    var type = typeof(obj);
    var symbol = _typeToSymbolMap[type];
    if (symbol) return symbol;
    for (symbol in _symbolToClassMap) {
      if (obj instanceof _symbolToClassMap[symbol]) return symbol;
    }
  };

  /**
   * @function createObject
   * Create an object for the provided symbol.
   */

  _proto.createObject = function (symbol) {
    var klass = this.symbolToClass(symbol);
    return new klass();
  };

  /**
   * @function createValue
   * Create an object for the provided symbol.
   */

  _proto.createValue = function (symbol, value) {
    // TODO encode booleans with their "?" symbol
    if (value == 'true') return true;
    if (value == 'false') return false;
    var klass = this.symbolToClass(symbol);
    if (klass === String) return value;
    return new klass(value);
  };

  /**
   * @function encodeComponent
   * Encode a component (key or value)
   */

  _proto.encodeComponent = function (str) {
    return this.encoding == 'base64'
      ? ecma.data.base64.encode(str)
      : ecma.window.encodeURIComponent(str);
  };

  /**
   * @function decodeComponent
   * Decode a component (key or value)
   */

  _proto.decodeComponent = function (str) {
    return this.encoding == 'base64'
      ? ecma.data.base64.decode(str)
      : ecma.window.decodeURIComponent(str);
  };

  /**
   * @function parse
   * Create an object from a transfer-encoded string.
   */

  _proto.parse = function (str) {
    if (!ecma.util.defined(str)) return;
    var CHash = this.symbolToClass('%');
    var CArray = this.symbolToClass('@');
    var CScalar = this.symbolToClass('$');
    var m =  str.match(/^([\%\$\@]){/);
    if (!m) throw new Error('str must begin with "%{", "@{", or "${"');
    if (m[1] == '$') {
      var value = str.substr(2, (str.length - 3));
      return this.decodeComponent(value);
    }
    var root = this.createObject(m[1], null);
    var pos = 2;
    var node = root;
    var nodeParent = root;
    var parents = [];
    while (true) {
      var open_pos = str.indexOf('{', pos);
      var close_pos = str.indexOf('}', pos);
      if (close_pos < open_pos && close_pos >= 0) {
        node = parents.pop() || root;
        pos = close_pos + 1;
        continue;
      }
      if (open_pos < 0) break;
      var key = str.substr(pos, (open_pos - pos));
      var len = key.length - 1;
      var type = key.substr(len, 1);
      key = key.substr(0, len);
      key = this.decodeComponent(key);
      pos = open_pos + 1;
      if (type == '%' || type == '@') {
        parents.push(node);
        nodeParent = node;
        node = this.createObject(type, nodeParent);
        if (ecma.util.isa(nodeParent, CHash)) {
          nodeParent.setValue(key, node);
        } else if (ecma.util.isa(nodeParent, CArray)) {
          nodeParent.push(node);
        }
      } else {
        if (!this.symbolToClass(type)) throw new Error('invalid data type: ' + type);
        open_pos = str.indexOf('{', pos);
        if (open_pos >= 0 && open_pos < close_pos) close_pos = open_pos - 1;
        var vstr = str.substr(pos, (close_pos - pos));
        vstr = this.decodeComponent(vstr);
        var value = this.createValue(type, vstr);
        if (ecma.util.isa(node, CHash)) {
          node.setValue(key, value);
        } else if (ecma.util.isa(node, CArray)) {
          node.push(value);
        } else if (node && node.setValue instanceof Function) {
          node.setValue(value);
        } else {
          nodeParent += value;
        }
        pos = close_pos + 1;
      }
    }
    return root;
  };

  /**
   * @function format
   * Create a transfer-encoded string representing the object structure.
   */

  _proto.format = function (obj) {
    var result = '';
    var symbol = this.classToSymbol('');
    if (!ecma.util.defined(obj)) return symbol + '{}';
    if (obj.toXFR) {
      return obj.toXFR();
    } else if (ecma.util.isArray(obj)) {
      var result = '@{';
      for (var i = 0; i < obj.length; i++) {
        result += this.format(obj[i]);
      }
      return result + '}';
    } else if (ecma.util.isAssociative(obj)) {
      var result = null;
      if (typeof(obj.toUTCString) == 'function') {
        result = '${' + this.encodeComponent(obj.toUTCString()) + '}';
      } else {
        result = '%{';
        for (var k in obj) {
          var v = obj[k];
          result += this.encodeComponent(k) + this.format(v);
        }
        result += '}';
      }
      return result;
    } else {
      return '${' + this.encodeComponent(obj) + '}';
    }
  };

});

/** @namespace data */

ECMAScript.Extend('data', function (ecma) {

  /**
   * @instance xfr <ecma.data.XFR>
   * Static access to L<ecma.data.XFR> class methods.
   */

  this.xfr = new ecma.data.XFR('base64');

});

/** @namespace data */
/** @structure json */
/** @namespace data.json */
/** @function parse */
/** @function format */

var native_JSON = function () {
  try {
    return 'JSON' in window && window['JSON'] !== null;
  } catch (e) {
    return false;
  }
}

if (native_JSON()) {

  ECMAScript.Extend('data.json', function (ecma) {
    this.parse = ecma.window.JSON.parse;
    this.format = ecma.window.JSON.stringify;
  });

} else {

// This source code is free for use in the public domain.
// NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

// http://code.google.com/p/json-sans-eval/

/**
 * Parses a string of well-formed JSON text.
 *
 * If the input is not well-formed, then behavior is undefined, but it is
 * deterministic and is guaranteed not to modify any object other than its
 * return value.
 *
 * This does not use `eval` so is less likely to have obscure security bugs than
 * json2.js.
 * It is optimized for speed, so is much faster than json_parse.js.
 *
 * This library should be used whenever security is a concern (when JSON may
 * come from an untrusted source), speed is a concern, and erroring on malformed
 * JSON is *not* a concern.
 *
 *                      Pros                   Cons
 *                    +-----------------------+-----------------------+
 * json_sans_eval.js  | Fast, secure          | Not validating        |
 *                    +-----------------------+-----------------------+
 * json_parse.js      | Validating, secure    | Slow                  |
 *                    +-----------------------+-----------------------+
 * json2.js           | Fast, some validation | Potentially insecure  |
 *                    +-----------------------+-----------------------+
 *
 * json2.js is very fast, but potentially insecure since it calls `eval` to
 * parse JSON data, so an attacker might be able to supply strange JS that
 * looks like JSON, but that executes arbitrary javascript.
 * If you do have to use json2.js with untrusted data, make sure you keep
 * your version of json2.js up to date so that you get patches as they're
 * released.
 *
 * @param {string} json per RFC 4627
 * @param {function (this:Object, string, *):*} opt_reviver optional function
 *     that reworks JSON objects post-parse per Chapter 15.12 of EcmaScript3.1.
 *     If supplied, the function is called with a string key, and a value.
 *     The value is the property of 'this'.  The reviver should return
 *     the value to use in its place.  So if dates were serialized as
 *     {@code { "type": "Date", "time": 1234 }}, then a reviver might look like
 *     {@code
 *     function (key, value) {
 *       if (value && typeof value === 'object' && 'Date' === value.type) {
 *         return new Date(value.time);
 *       } else {
 *         return value;
 *       }
 *     }}.
 *     If the reviver returns {@code undefined} then the property named by key
 *     will be deleted from its container.
 *     {@code this} is bound to the object containing the specified property.
 * @return {Object|Array}
 * @author Mike Samuel <mikesamuel@gmail.com>
 */
ECMAScript.Extend('data.json', function (ecma) {

  var number
      = '(?:-?\\b(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\\b)';
  var oneChar = '(?:[^\\0-\\x08\\x0a-\\x1f\"\\\\]'
      + '|\\\\(?:[\"/\\\\bfnrt]|u[0-9A-Fa-f]{4}))';
  var string = '(?:"' + oneChar + '*?"|\'' + oneChar + '*?\')';

  // Will match a value in a well-formed JSON file.
  // If the input is not well-formed, may match strangely, but not in an unsafe
  // way.
  // Since this only matches value tokens, it does not match whitespace, colons,
  // or commas.
  var jsonToken = new RegExp(
      '(?:false|true|null|[\\{\\}\\[\\]]'
      + '|' + number
      + '|' + string
      + ')', 'g');

  // Matches escape sequences in a string literal
  var escapeSequence = new RegExp('\\\\(?:([^u])|u(.{4}))', 'g');

  // Decodes escape sequences in object literals
  var escapes = {
    '"': '"',
    '/': '/',
    '\\': '\\',
    'b': '\b',
    'f': '\f',
    'n': '\n',
    'r': '\r',
    't': '\t'
  };

  function unescapeOne(_, ch, hex) {
    return ch ? escapes[ch] : String.fromCharCode(parseInt(hex, 16));
  }

  // A non-falsy value that coerces to the empty string when used as a key.
  var EMPTY_STRING = new String('');

  // Constructor to use based on an open token.
  var firstTokenCtors = { '{': Object, '[': Array };

  var hop = Object.hasOwnProperty;

  this.parse = function (json, opt_reviver) {
    // Split into tokens
    var toks = json.match(jsonToken);
    // Construct the object to return
    var result;
    var tok = toks[0];
    var topLevelPrimitive = false;
    if ('{' === tok) {
      result = {};
    } else if ('[' === tok) {
      result = [];
    } else {
      // The RFC only allows arrays or objects at the top level, but the JSON.parse
      // defined by the EcmaScript 5 draft does allow strings, booleans, numbers, and null
      // at the top level.
      result = [];
      topLevelPrimitive = true;
    }

    // If undefined, the key in an object key/value record to use for the next
    // value parsed.
    var key;
    // Loop over remaining tokens maintaining a stack of uncompleted objects and
    // arrays.
    var stack = [result];
    for (var i = 1 - topLevelPrimitive, n = toks.length; i < n; ++i) {
      tok = toks[i];

      var cont;
      switch (tok.charCodeAt(0)) {
        default:  // sign or digit
          cont = stack[0];
          cont[key || cont.length] = +(tok);
          key = void 0;
          break;
        case 0x22:  // '"'
        case 0x27:  // '''
          tok = tok.substring(1, tok.length - 1);
          if (tok.indexOf('\\') !== -1) {
            tok = tok.replace(escapeSequence, unescapeOne);
          }
          cont = stack[0];
          if (!key) {
            if (cont instanceof Array) {
              key = cont.length;
            } else {
              key = tok || EMPTY_STRING;  // Use as key for next value seen.
              break;
            }
          }
          cont[key] = tok;
          key = void 0;
          break;
        case 0x5b:  // '['
          cont = stack[0];
          stack.unshift(cont[key || cont.length] = []);
          key = void 0;
          break;
        case 0x5d:  // ']'
          stack.shift();
          break;
        case 0x66:  // 'f'
          cont = stack[0];
          cont[key || cont.length] = false;
          key = void 0;
          break;
        case 0x6e:  // 'n'
          cont = stack[0];
          cont[key || cont.length] = null;
          key = void 0;
          break;
        case 0x74:  // 't'
          cont = stack[0];
          cont[key || cont.length] = true;
          key = void 0;
          break;
        case 0x7b:  // '{'
          cont = stack[0];
          stack.unshift(cont[key || cont.length] = {});
          key = void 0;
          break;
        case 0x7d:  // '}'
          stack.shift();
          break;
      }
    }
    // Fail if we've got an uncompleted object.
    if (topLevelPrimitive) {
      if (stack.length !== 1) { throw new Error(); }
      result = result[0];
    } else {
      if (stack.length) { throw new Error(); }
    }

    if (opt_reviver) {
      // Based on walk as implemented in http://www.json.org/json2.js
      var walk = function (holder, key) {
        var value = holder[key];
        if (value && typeof value === 'object') {
          var toDelete = null;
          for (var k in value) {
            if (hop.call(value, k) && value !== holder) {
              // Recurse to properties first.  This has the effect of causing
              // the reviver to be called on the object graph depth-first.

              // Since 'this' is bound to the holder of the property, the
              // reviver can access sibling properties of k including ones
              // that have not yet been revived.

              // The value returned by the reviver is used in place of the
              // current value of property k.
              // If it returns undefined then the property is deleted.
              var v = walk(value, k);
              if (v !== void 0) {
                value[k] = v;
              } else {
                // Deleting properties inside the loop has vaguely defined
                // semantics in ES3 and ES3.1.
                if (!toDelete) { toDelete = []; }
                toDelete.push(k);
              }
            }
          }
          if (toDelete) {
            for (var i = toDelete.length; --i >= 0;) {
              delete value[toDelete[i]];
            }
          }
        }
        return opt_reviver.call(holder, key, value);
      };
      result = walk({ '': result }, '');
    }

    return result;
  };

  this.format = function (obj) {

    var hasOwnProperty = Object.hasOwnProperty;

    function _escape (str) {
      return str.replace(/(["])/, '\\$1');
    }

    function _format (obj) {
      if (!ecma.util.defined(obj)) {
        return 'null';
      } else if (ecma.util.isArray(obj)) {
        var items = [];
        for (var i = 0; i < obj.length; i++) {
          items.push(_format(obj[i]));
        }
        return '[' + items.join(',') + ']';
      } else if (ecma.util.isAssociative(obj)) {
        if (typeof(obj.toUTCString) == 'function') {
          // Date objects are serialized as strings
          return '"' + obj.toUTCString() + '"';
        } else {
          var items = [];
          for (var k in obj) {
            if (hasOwnProperty.call(obj, k)) {
              var v = obj[k];
              items.push('"' + k + '":' + _format(v));
            }
          }
        }
        return '{' + items.join(',') + '}';
      } else {
        return '"' + obj + '"';
      }
    }

    return _format(obj);
  };

});

}

/** @namespace http */
ECMAScript.Extend('http', function (ecma) {

  /**
   * @class Location
   * Provides an object structure like C<document.location> for a given URL,
   * and methods for working with the URL.
   *
   *  var location = new ecma.http.Location(); // copies document location
   *  var location = new ecma.http.Location(url);
   *
   * Sample:
   *
   *  var url = 'http://www.example.com:8000/cgi-bin/test.pl?key=value#id';
   *  var location = new ecma.http.Location(url);
   *
   *      2                          3             
   *      .-------------------------..---------------------------.
   *      |                         ||                           |
   *  1 - http://www.example.com:8000/cgi-bin/test.pl?key=value#id
   *      |  | |               | |  ||              ||        || |
   *      '--' '---------------' '--''--------------''--------''-'
   *      4    5                 6   7               8         9
   *
   *  # Accessor                    Terminology
   *  ----------------------------- ---------------------------
   *  1 location.getUri()           URI, URL L<1>
   *  2 location.getOrigin()        origin
   *  3 location.getAddress()       address L<1>
   *  4 location.protocol           protocol
   *  5 location.hostname           authority, domain, hostname
   *  6 location.port               port
   *  7 location.pathname           path, pathname
   *  8 location.search             search, query L<2>
   *  9 location.hash               hash L<3>
   *
   * As we don't know how to make object members which behive like functions,
   * there is no C<href> property.
   *
   * N<1> Note that C<location.getHref()> will return the full URI if it is not
   * of the same origin, otherwise it acts as C<location.getAddress()>.
   *
   * N<2> Use C<location.getSearch()> to return the search field without the
   * leading C<?>.
   *
   * N<3> Use C<location.getHash()> to return the hash field without the
   * leading C<#>.
   *
   * @member protocol
   * @member hostname
   * @member port
   * @member pathname
   * @member search
   * @member hash
   */

  var pseudoUri = new RegExp('^([a-z]+):[^/]'); // data:, about:, etc
  var proto = {};

  this.Location = function (uri) {
    if (uri) {
      if (uri instanceof ecma.http.Location) {
        this.copyLocation(uri);
      } else {
        this.parseUri(uri);
      }
    } else {
      this.copyDocumentLocation();
    }
  };

  this.Location.prototype = proto;

  /**
   * @function copyDocumentLocation
   */

  proto.copyDocumentLocation = function () {
    this.copyLocation(ecma.document.location);
  };

  proto.copyLocation = function (loc) {
    try {
      this.protocol = loc.protocol;
      this.hostname = loc.hostname;
      this.port = loc.port;
      this.pathname = loc.pathname;
      this.search = loc.search;
      this.hash = loc.hash;
    } catch (ex) {
      this.protocol = '';
      this.hostname = '';
      this.port = '';
      this.pathname = '';
      this.search = '';
      this.hash = '';
    }
  };

  /**
   * @function getOrigin
   */

  proto.getOrigin = function () {
    var origin = this.protocol + '//' + this.hostname;
    if (this.port) origin += ':' + this.port;
    return origin;
  };

  /**
   * @function isSameOrigin
   * Tests that the provided location originates from the same authority
   * using the same protocol and port as this location.
   *  var bool = location.isSameOrigin(uri);
   * Where:
   *  location    <ecma.http.Location>          This location
   *  uri         <ecma.http.Location|String>   Compare-to location
   */

  proto.isSameOrigin = function (loc) {
    if (!(loc instanceof ecma.http.Location)) {
      loc = new ecma.http.Location(loc);
    }
    return loc.getOrigin() == this.getOrigin();
  };

  /**
   * @function isSameDocument
   * Tests that the provided location refers to the same document as this
   * location.
   *  var bool = location.isSameDocument(uri);
   * Where:
   *  location    <ecma.http.Location>          This location
   *  uri         <ecma.http.Location|String>   Compare-to location
   */

  proto.isSameDocument = function (loc) {
    if (!(loc instanceof ecma.http.Location)) {
      loc = new ecma.http.Location(loc);
    }
    return loc.getDocumentUri() == this.getDocumentUri();
  };

  /**
   * @function getUri
   * Returns the entire URI string.
   */

  proto.getUri = function () {
    return this.getOrigin() + this.getAddress()
  };

  /**
   * @function toString
   * Calls L<ecma.http.Location.getUri>
   */

  proto.getHref = proto.getUri;

  /**
   * @function getDocumentUri
   * Return the URI of the document, i.e., niether search nor hash segements 
   * are included.
   *  var uri = location.getDocumentUri();
   */

  proto.getDocumentUri = function () {
    return this.getOrigin() + this.pathname;
  };

  /**
   * @function getHref
   * When the location is of the same origin, returns
   * L<ecma.http.Location.getAddress>, otherwise returns
   * L<ecma.http.Location.getUri>.
   */

  proto.getHref = function () {
    return new ecma.http.Location().isSameOrigin(this)
      ? this.getAddress() : this.getUri();
  };

  /**
   * @function getAddress
   * Returns the pathname, query, and hash portions of this location.
   *  var addr = location.getAddress();
   */

  proto.getAddress = function () {
    return this.pathname + this.search + this.hash;
  };

  /**
   * @function getSearch
   * Returns search portion of this location without the leading C<?>.
   *  var search = location.getSearch();
   */

  proto.getSearch = function () {
    return this.search ? this.search.replace(/^\?/,'') : '';
  };

  /**
   * @function getHash
   * Returns hash portion of this location without the leading C<#>.
   *  var hash = location.getHash();
   */

  proto.getHash = function () {
    return this.hash ? this.hash.replace(/^#/,'') : '';
  };

  /**
   * @function addParameter
   * Adds a parameter to the search portion of this location.  Remember to
   * C<encodeURIComponent> your key and value.
   *  var search = location.addParameter(key, value);
   */

  proto.addParameter = function (key, value) {
    key = encodeURIComponent(key);
    value = encodeURIComponent(value);
    var prefix = this.search ? this.search + '&' : '?';
    return this.search = prefix + key + '=' + value;
  };

  /**
   * @function getParameters
   * Returns an object of search parameters.
   *  var object = location.getParameters();
   * A valid object will always be returned, allowing one to fetch a single 
   * parameter (which may or may not exist) as:
   *  var string = location.getParameters()[key];
   */
  proto.getParameters = function () {
    var result = {};
    if (!this.search) return result;
    var str = this.search.replace(/^\?/,'');
    if (!str) return result;
    var kvpairs = str.split(/[&;]/);
    for (var i = 0; i < kvpairs.length; i++) {
      var parts = kvpairs[i].split(/=/);
      var k = decodeURIComponent(parts.shift());
      var v = decodeURIComponent(parts.join());
      if (k == "" && v == "") continue;
      result[k] = result[k] != undefined
        ? result[k] instanceof Array
          ? result[k].concat(v)
          : [result[k], v]
        : v;
    }
    return result;
  };

  /**
   * @function parseUri
   * Sets this object's member values accoding to the provided URI.
   *
   *  location.parseUri(newUri);
   *
   * If the `newUri` begins like 'data:gif' or 'about:blank', we only set
   * the protocol member. This will result in a valid location object, however
   * it won't be too useful. To make this a functional scenario, each of
   * the accessor methods (like L<getHref>) need to be thought through.
   */

  proto.parseUri = function (uri) {
    this.copyDocumentLocation();
    this.search = '';
    this.hash = '';
    var href = undefined;
    var pseudoMatch = pseudoUri.test(uri);
    if (pseudoMatch) {
      this.protocol = pseudoMatch[0];
      this.hostname = '';
      this.port = '';
      this.pathname = '';
    } else if (uri.indexOf('//') == 0) {
      href = this.protocol + uri;
    } else if ((uri.indexOf('?') == 0) || (uri.indexOf('#') == 0)) {
      href = this.getOrigin() + this.pathname + uri;
    } else if (uri.indexOf('/') == 0) {
      href = this.getOrigin() + uri;
    } else if (uri.indexOf('://') == -1) {
      var base = this.pathname.match(/\/$/)
        ? this.pathname
        : ecma.data.addr_parent(this.pathname) + '/';
      href = this.getOrigin() + base + uri;
    } else {
      href = uri;
    }
    var m = href.match(/^([^\/]+:)?\/\/([^\/#?:]*):?([0-9]*)([^#?]*)(\??[^#]*)(#?.*)/);
    if (!m) throw new Error('cannot parse uri');
    this.protocol = m[1] ? m[1].toLowerCase() : ecma.document.location.protocol;
    this.hostname = m[2].toLowerCase();
    this.port = m[3] || '';
    this.pathname = m[4] || '';
    this.search = m[5] || '';
    this.hash = m[6] || '';
  };

});

/**
 * @namespace http
 *
 * The C<http> namespace groups functions and classes used while making
 * HTTP Requests.
 *
 */

ECMAScript.Extend('http', function (ecma) {

  // Intentionally private
  var _documentLocation = null

  function _getDocumentLocation () {
    if (!_documentLocation) _documentLocation = new ecma.http.Location();
    return _documentLocation;
  }

  /**
   * @constant HTTP_STATUS_NAMES
   * HTTP/1.1 Status Code Definitions
   *
   * Taken from, RFC 2616 Section 10:
   * L<http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html>
   *
   * These names are used in conjuction with L<ecma.http.Request> for 
   * indicating callback functions.  The name is prepended with C<on> such 
   * that
   *  onMethodNotAllowed
   * corresponds to the callback triggered when a 405 status is received.
   *
   # Names
   *
   *  100   Continue
   *  101   SwitchingProtocols
   *  200   Ok
   *  201   Created
   *  202   Accepted
   *  203   NonAuthoritativeInformation
   *  204   NoContent
   *  205   ResetContent
   *  206   PartialContent
   *  300   MultipleChoices
   *  301   MovedPermanently
   *  302   Found
   *  303   SeeOther
   *  304   NotModified
   *  305   UseProxy
   *  306   Unused
   *  307   TemporaryRedirect
   *  400   BadRequest
   *  401   Unauthorized
   *  402   PaymentRequired
   *  403   Forbidden
   *  404   NotFound
   *  405   MethodNotAllowed
   *  406   NotAcceptable
   *  407   ProxyAuthenticationRequired
   *  408   RequestTimeout
   *  409   Conflict
   *  410   Gone
   *  411   LengthRequired
   *  412   PreconditionFailed
   *  413   RequestEntityTooLarge
   *  414   RequestURITooLong
   *  415   UnsupportedMediaType
   *  416   RequestedRangeNotSatisfiable
   *  417   ExpectationFailed
   *  500   InternalServerError
   *  501   NotImplemented
   *  502   BadGateway
   *  503   ServiceUnavailable
   *  504   GatewayTimeout
   *  505   HTTPVersionNotSupported
   */

  this.HTTP_STATUS_NAMES = {
    100: 'Continue',
    101: 'SwitchingProtocols',
    200: 'Ok',
    201: 'Created',
    202: 'Accepted',
    203: 'NonAuthoritativeInformation',
    204: 'NoContent',
    205: 'ResetContent',
    206: 'PartialContent',
    300: 'MultipleChoices',
    301: 'MovedPermanently',
    302: 'Found',
    303: 'SeeOther',
    304: 'NotModified',
    305: 'UseProxy',
    306: 'Unused',
    307: 'TemporaryRedirect',
    400: 'BadRequest',
    401: 'Unauthorized',
    402: 'PaymentRequired',
    403: 'Forbidden',
    404: 'NotFound',
    405: 'MethodNotAllowed',
    406: 'NotAcceptable',
    407: 'ProxyAuthenticationRequired',
    408: 'RequestTimeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'LengthRequired',
    412: 'PreconditionFailed',
    413: 'RequestEntityTooLarge',
    414: 'RequestURITooLong',
    415: 'UnsupportedMediaType',
    416: 'RequestedRangeNotSatisfiable',
    417: 'ExpectationFailed',
    500: 'InternalServerError',
    501: 'NotImplemented',
    502: 'BadGateway',
    503: 'ServiceUnavailable',
    504: 'GatewayTimeout',
    505: 'HTTPVersionNotSupported'
  };

  /**
   * @function isSameOrigin
   *
   * Compare originating servers.
   *
   *  var bool = ecma.http.isSameOrigin(uri);
   *  var bool = ecma.http.isSameOrigin(uri, uri);
   *
   * Is the resource located on the server at the port using the same protocol
   * which served the document.
   *
   *  var bool = ecma.http.isSameOrigin('http://www.example.com');
   *
   * Are the two URI's served from the same origin
   *
   *  var bool = ecma.http.isSameOrigin('http://www.example.com', 'https://www.example.com');
   *
   */

  this.isSameOrigin = function(uri1, uri2) {
    if (!(uri1)) return false;
    var loc1 = uri1 instanceof ecma.http.Location
      ? uri1 : new ecma.http.Location(uri1);
    var loc2 = uri2 || _getDocumentLocation();
    return loc1.isSameOrigin(loc2);
  };

});

/** @namespace http */

/**
 *  TODO: Allow cross-domain requests.  The newXHR method will need to detect
 *  browser support and create the appropriate object in IE.
 *
 *  https://developer.mozilla.org/en/http_access_control
 *  http://msdn.microsoft.com/en-us/library/cc288060%28v=vs.85%29.aspx
 *  http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/
 *  http://msdn.microsoft.com/en-us/library/dd573303%28v=vs.85%29.aspx
 */

ECMAScript.Extend('http', function (ecma) {

  /**
   * @constant XHR_UNINITIALIZED
   * @constant XHR_LOADING
   * @constant XHR_LOADED
   * @constant XHR_INTERACTIVE
   * @constant XHR_COMPLETE
   */

  this.XHR_UNINITIALIZED = 0;
  this.XHR_LOADING       = 1;
  this.XHR_LOADED        = 2;
  this.XHR_INTERACTIVE   = 3;
  this.XHR_COMPLETE      = 4;

  /**
   * @constant XHR_STATE_NAMES
   */

  this.XHR_STATE_NAMES   = [
    'Uninitialized',
    'Loading',            // Connection established
    'Loaded',             // Request received
    'Interactive',        // Answer in process
    'Complete'
  ];

  /**
   * @function newXHR
   * Creates a new XMLHttpRequest object as provided by the platform.
   *  var xhr = js.http.newXHR();
   */

  this.newXHR = function () {
    try {
      return new XMLHttpRequest();
    } catch (ex) {
      try {
        return new ActiveXObject('Msxml2.XMLHTTP');
      } catch (ex) {
        return new ActiveXObject('Microsoft.XMLHTTP');
      }
    }
  };

  /**
   * @class Request
   *
   * XMLHttpRequest wrapper with hooks for resopnse callbacks.
   *
   * @param uri of the request
   * @param options for the request
   *
   * Several ways to do the same thing:
   *
   *  var req = new js.http.Request('http://www.example.com');
   *  req.onSuccess = function (xhr) {
   *    alert(xhr.responseText);
   *  };
   *
   *  var req = new js.http.Request('http://www.example.com');
   *  req.addEventListener('onSuccess', function () { ... });
   *  req.submit();
   *
   * Note that we do *not* set 'Connection: close' as this is client
   * specific, i.e., only user agents which do not support persistent
   * connections.  Doing so will yield an error in Opera.
   */

  var CActionDispatcher = ecma.action.ActionDispatcher;

  this.Request = function CRequest (uri, options) {
    CActionDispatcher.apply(this);
    this.uri = uri;
    this.method = 'GET';
    this.asynchronous = true;
    this.body = null;
    this.headers = {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    this.events = [];
    // Option parsing intended to be compatible with Prototype.js
    var props = {};
    for (var k in options) {
      if (k.match(/^on/)) {
        this.addEventListener(k, options[k]);
      } else {
        props[k] = options[k];
      }
    }
    ecma.util.overlay(this, props);
  };

  this.Request.prototype = ecma.lang.createPrototype(CActionDispatcher);

  /**
   * @internal getEventListeners
   * Returns an array of event listeners for the specified event type.
   *
   *  var array = getEventListeners(type);
   *
   * Where:
   *
   *  type  <String>  Event type, e.g., "onSuccess"
   *
   * Each entry in the array is a callback array in the form of:
   *
   *  [func, scope, args]
   */

  this.Request.prototype.getEventListeners = function (type) {
    var name = type.toLowerCase().replace(/^on/, '');
    return this.events[name];
  };

  /**
   * @internal setEventListeners
   * Replaces current array of listeners with new array.
   *
   *  setEventListeners(listeners);
   *
   * Where:
   *
   *  listeners <Array> New array of callback functions
   */

  this.Request.prototype.setEventListeners = function (type, listeners) {
    var name = type.toLowerCase().replace(/^on/, '');
    this.events[name] = listeners;
  };

  /**
   * @function addEventListener
   * Adds a new event listener.
   *
   *  req.addEventListener(type, func);
   *  req.addEventListener(type, func, scope);
   *  req.addEventListener(type, func, scope, args);
   *
   * Where:
   *  
   *  type    <String>      Event type L<1>
   *  func    <Function>    Callback function L<2>
   *  scope   <Object>      Scope applied to `func`
   *  args    <Array>       Arguments passed to `func` L<3>
   *
   * N<1> Event types are determined by the HTTP status returned by the request,
   * are case insensitive, and are not requred to use the 'on' prefix.  Events
   * types may also literal HTTP status numbers, which have precedence. The 
   * following are synonymous:
   *
   *  req.addEventListener('onInternalServerError', ...);
   *  req.addEventListener('InternalServerError', ...);
   *  req.addEventListener('internalservererror', ...);
   *  req.addEventListener(500, ...);
   *
   * See also: L<ecma.lang.HTTP_STATUS_NAMES>
   *
   * N<2> When no C<scope> is provided, the C<func> is called with C<req>
   * as its scope.
   *
   * N<3> Callback functions are always passed the XMLHttpRequest object as
   * the first argument.  Any additional arguments specified in the C<args>
   * parameter are appended thereafter.
   */

  this.Request.prototype.addEventListener = function (type, func, scope, args) {
    var name = type.toLowerCase().replace(/^on/, '');
    var group = this.events[name];
    if (!group) group = this.events[name] = [];
    if (!scope) scope = this;
    if (!args) args = [];
    group.push([func, scope, args]);
  };

  /**
   * @function removeEventListener
   * Removes an existing event listener.
   *
   *  req.removeEventListener(type, func)
   *
   * Where:
   *
   *  type <String> Event type
   *  func <Func)   Function reference, === to that passed in addEventListener
   *
   * TODO: Remove logic should also accept and compare C<scope>.
   */

  this.Request.prototype.removeEventListener = function (type, func) {
    var name = type.toLowerCase().replace(/^on/, '');
    var group = this.events[name];
    if (!group) return;
    for (var i = 0; i < group.length; i++) {
      var cb = group[i];
      var cbFunc = ecma.util.isArray(group[i]) ? group[i][0] : group[i]
      if (cbFunc === func) {
        group.splice(i--, 1);
        break;
      }
    }
  };

  /**
   * @function getHeader
   * Returns the value of a specific HTTP header.
   *
   *  var result = req.getHeader(name);
   *
   * Where:
   *
   *  name  <String>  Name of the header field
   *
   * Example:
   *
   *  var result = req.getHeader('If-Modified-Since');
   */

  this.Request.prototype.getHeader = function (k, v) {
    return this.headers[k];
  };

  /**
   * @function setHeader
   * Sets the value for the specified header.
   *
   *  req.setHeader(name, value);
   *
   * Where:
   *
   *  name  <String>  Name of the header field
   *  value <String>  Value of the header field
   */

  this.Request.prototype.setHeader = function (k, v) {
    return this.headers[k] = v;
  };

  function _submit () {
    this.xhr = ecma.http.newXHR();
    this.xhr.open(this.method.toUpperCase(), this.uri, this.asynchronous);
    this.xhr.onreadystatechange = js.lang.Callback(this.onStateChange, this);
    for (var k in this.headers) {
      this.xhr.setRequestHeader(k, this.headers[k]);
    }
    this.fireEvent('Create');
    this.xhr.send(this.body);
  }

  /**
   * @function submit
   * Submits the request.
   *
   *  req.submit();
   *  req.submit(body);
   *  req.submit(body, cb);
   *
   * Where:
   *
   *  body  <String|Object>   Body of the request
   *  cb    <Function|Array>  Callback (called once when the request completes)
   *
   * The C<body> argument is passed to C<parseBody>, override this in your
   * derived class if necessary.  See L<js.http.Request.parseBody> for this 
   * implementation
   */

  this.Request.prototype.submit = function (body, cb) {
    this.body = this.parseBody(body);
    this.cb = cb;
    return _submit.apply(this);
  };

  /**
   * @function resubmit
   * Submits this request again, re-using its existing body.
   *  req.resubmit();
   */

  this.Request.prototype.resubmit = function () {
    return _submit.apply(this);
  };

  /**
   * @function parseBody
   * Creates the argument for C<XMLHttpRequest.send> from that which was
   * passed to L<js.http.Request.submit>.
   *
   *  var result = req.parseBody(); // null is returned
   *  var result = req.parseBody(body);
   *
   * When C<body> is a String, it is passed as-is.  When it is an object, it is 
   * iterated and each key and value are URI-encoded and append as "key=value&" 
   * pairs.
   */

  this.Request.prototype.parseBody = function (body) {
    if (!body) return null;
    if (ecma.util.isObject(body)) {
      try {
        var result = '';
        for (var k in body) {
          var name = encodeURIComponent(k);
          var value = ecma.util.isDefined(body[k])
            ? encodeURIComponent(body[k])
            : '';
          result += name + '=' + value + '&';
        }
        return result;
      } catch (ex) {
        return body;
      }
    }
    return body;
  };

  /**
   * @function parseResponse
   * Parse the xhr.responseText as needed.
   *
   * Called when the request is complete, before any event listeners.
   *
   * Example:
   *
   *  // Create a new class derived from ecma.http.Request
   *  function MyRequest () {ecma.http.Request.apply(this, arguments);};
   *  MyRequest.prototype = ecma.lang.createPrototype(ecma.http.Request);
   *
   *  // Override the parseResponse method
   *  MyRequest.prototype.parseResponse = function () {
   *    this.responseText = this.xhr.responseText;
   *    this.responseText.replace(/</, '&lt;');
   *  };
   */

  this.Request.prototype.parseResponse = function () {
  };

  /**
   * @internal onStateChange
   * Callback for state-change events on the xhr object.
   */

  this.Request.prototype.onStateChange = function () {
    var state = this.xhr.readyState;
    if (state == ecma.http.XHR_COMPLETE) {
      if (this.canComplete()) this.completeRequest();
    } else {
      var name = ecma.http.XHR_STATE_NAMES[state];
      this.fireEvent(name);
    }
  };

  /**
   * @function canComplete
   *
   * Override this function to inspect the response and supress all
   * completion callbacks.  If you return false, call C<completeRequest()>
   * to invoke the completion callbacks.
   *
   * See C<ecma.lsn.Request> for how this is used to resubmit requests where
   * authorization is required.
   */

  this.Request.prototype.canComplete = function () {
    return true;
  };

  /**
   * @function completeRequest
   *
   * Invoke all of the callbacks associated with a completed request.
   */

  this.Request.prototype.completeRequest = function () {
    var state = this.xhr.readyState;
    this.parseResponse();
    var status = this.xhr.status || 500;
    if (this.cb) {
      try {
        this.invokeListener(this.cb);
      } catch (ex) {
        ecma.error.reportError(ex);
      } finally {
        this.cb = null;
      }
    }
    var name = ecma.http.HTTP_STATUS_NAMES[status];
    this.fireEvent(status); // on200 preceeds onSuccess and onOk
    if (name) this.fireEvent(name); // onOk preceeds onSuccess
    if (status >= 200 && status < 300) {
      this.fireEvent('Success');
    } else {
      this.fireEvent('NotSuccess');
    }
    if (status >= 500 && status < 600) {
      this.fireEvent('Failure');
    }
    var name = ecma.http.XHR_STATE_NAMES[state];
    this.fireEvent(name);
  };

  /**
   * @internal fireEvent
   * Invokes callbacks, in order.
   *
   * Written before L<js.dom.ActionListener> which should be used for
   * the event interface, sigh.
   */

  this.Request.prototype.fireEvent = function (type) {
    //ecma.console.log(this.uri + ':', type);
    // native functions (first)
    if (this['on'+type]) {
      try {
        this['on'+type].call(this, this);
      } catch (ex) {
        ecma.error.reportError(ex);
      }
    }
    // event listeners
    var name = typeof(type) == 'number' ? type : type.toLowerCase();
    var group = this.events[name];
    if (!group) return;
    try {
      ecma.util.step(group, this.invokeListener, this);
    } catch (ex) {
      ecma.error.reportError(ex);
      // Do no re-throw, we need our call-frame to continue
    }
    this.executeAction(type, this);
  };

  this.Request.prototype.invokeListener = function (cb) {
    var func, scope, args;
    var args = [this];
    if (ecma.util.isArray(cb)) {
      func = cb[0];
      scope = cb[1];
      args = args.concat(cb[2]);
    } else {
      func = cb;
      scope = this;
    }
    func.apply(scope, args);
  };

});

/** @namespace http */
ECMAScript.Extend('http', function (ecma) {

  var _package = this;
  var _base = ecma.http.Request;
  var _proto = ecma.lang.createPrototype(_base);
  var _super = _base.prototype;

  /**
   * @class JSONRequest
   *
   *  @param uri <String>
   *  @param userOptions <Object>
   *
   * Extends C<ecma.http.Request> setting appropriate request headers and
   * response parser.
   */

  _package.JSONRequest = function (uri, userOptions) {
    var options = ecma.util.overlay({
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Accept-Content-Encoding': 'json',
        'X-Content-Format': 'application/json',
        'X-Content-Encoding': 'json',
        'Content-Type': 'application/json'
      }
    }, userOptions);
    _base.apply(this, [uri, options]);
  };

  _package.JSONRequest.prototype = _proto;

  _proto.parseBody = function (body) {
    return ecma.util.isObject(body) ? ecma.data.json.format(body) : body;
  };

  _proto.parseResponse = function () {
    try {
      this.responseJSON = ecma.data.json.parse(this.xhr.responseText);
    } catch (ex) {
      js.error.reportError(ex);
    }
  };

});

/** @namespace http */
ECMAScript.Extend('http', function (ecma) {

  /**
   * @class Cookies
   * Provides methods for getting and setting cookies.
   *
   *  var cookies = new ecma.http.Cookies();
   */

  var _proto = {};

  var _xfr = new ecma.data.XFR();

  this.Cookies = function () {
  };

  this.Cookies.prototype = _proto;

  /**
   * @function encode
   * Encode an object for storage.
   *
   *  var str = cookie.encode(obj);
   *
   * @param obj <Object> Data object
   */

  _proto.encode = function (value) {
    return _xfr.format(value);
  };

  /**
   * @function decode
   * Decode an encoded string.
   *
   *  var obj = cookie.decode(str);
   *
   * @param str <String> Encoded string
   */

  _proto.decode = function (str) {
    return _xfr.parse(str);
  };

  /**
   * @function setObject
   * Set a cookie to hold the value of a data object.
   * @param name  <String> Name of the cookie
   * @param obj   <Object> Cookie data
   * @param days  <String> Number of days before it expires
   */

  _proto.setObject = function (name, value, days) {
    value = this.encode(value);
    return this.set(name, value, days);
  };

  /**
   * @function getObject
   * Get a data object stored in a cookie.
   * @param name <String> Name of the cookie
   */

  _proto.getObject = function (name) {
    var value = this.get(name);
    return value ? this.decode(value) : null;
  };

  /**
   * @function set
   * Set a cookie to the given value.
   * @param name  <String> Name of the cookie
   * @param value <String> Value of the cookie
   * @param days  <String> Number of days before it expires
   */

  _proto.set = function (name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + date.toGMTString();
    }
    ecma.document.cookie = name + "=" + value + expires + "; path=/";
  };

  /**
   * @function get
   * Get a cookie by its name.
   * @param name <String> Name of the cookie
   */

  _proto.get = function (name) {
    var prefix = name + "=";
    var parts = ecma.document.cookie.split(';');
    for(var i=0; i < parts.length; i++) {
      var c = parts[i];
      while (c.charAt(0)==' ') c = c.substring(1, c.length);
      if (c.indexOf(prefix) == 0) return c.substring(prefix.length, c.length);
    }
    return null;
  };

  /**
   * @function remove
   * Remove a cookie.
   * @param name <String> Name of the cookie
   */

  _proto.remove = function (name) {
    this.set(name, "", -1);
  };

});

/** @namespace platform */
ECMAScript.Extend('platform', function (ecma) {

  var _browsers = null;
  var _platforms = null;
  var _info = null;
  var _pkg = this;

  /**
   * @function getInfo
   */

  this.getInfo = function () {
    return _info;
  };

  /**
   * @class Info
   */

  this.Info = function () {
		this.browser = this.searchString(_browsers) || "An unknown browser";
		this.version = this.searchVersion(navigator.userAgent)
			|| this.searchVersion(navigator.appVersion)
			|| "an unknown version";
		this.os = this.searchString(_platforms) || "an unknown OS";
	},

  this.Info.prototype = proto = {};

  /**
   * @function searchString
   */

	proto.searchString = function (data) {
		for (var i=0;i<data.length;i++)	{
			var dataString = data[i].string;
			var dataProp = data[i].prop;
			this.versionSearchString = data[i].versionSearch || data[i].identity;
			if (dataString) {
				if (dataString.indexOf(data[i].subString) != -1)
					return data[i].identity;
			}
			else if (dataProp)
				return data[i].identity;
		}
	};

  /**
   * @function searchVersion
   */

	proto.searchVersion = function (dataString) {
		var index = dataString.indexOf(this.versionSearchString);
		if (index == -1) return;
		return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
	};

	_browsers = [
		{
			string: navigator.userAgent,
			subString: "Chrome",
			identity: "Chrome"
		},
		{ 	
      string: navigator.userAgent,
			subString: "OmniWeb",
			versionSearch: "OmniWeb/",
			identity: "OmniWeb"
		},
		{
			string: navigator.vendor,
			subString: "Apple",
			identity: "Safari",
			versionSearch: "Version"
		},
		{
			prop: window.opera,
			identity: "Opera"
		},
		{
			string: navigator.vendor,
			subString: "iCab",
			identity: "iCab"
		},
		{
			string: navigator.vendor,
			subString: "KDE",
			identity: "Konqueror"
		},
		{
			string: navigator.userAgent,
			subString: "Firefox",
			identity: "Firefox"
		},
		{
			string: navigator.vendor,
			subString: "Camino",
			identity: "Camino"
		},
		{		
      // for newer Netscapes (6+)
			string: navigator.userAgent,
			subString: "Netscape",
			identity: "Netscape"
		},
		{
			string: navigator.userAgent,
			subString: "MSIE",
			identity: "Explorer",
			versionSearch: "MSIE"
		},
		{
			string: navigator.userAgent,
			subString: "Gecko",
			identity: "Mozilla",
			versionSearch: "rv"
		},
		{ 		// for older Netscapes (4-)
			string: navigator.userAgent,
			subString: "Mozilla",
			identity: "Netscape",
			versionSearch: "Mozilla"
		}
	];

	_platforms = [
		{
			string: navigator.platform,
			subString: "Win",
			identity: "Windows"
		},
		{
			string: navigator.platform,
			subString: "Mac",
			identity: "Mac"
		},
		{
			   string: navigator.userAgent,
			   subString: "iPhone",
			   identity: "iPhone/iPod"
    },
		{
			string: navigator.platform,
			subString: "Linux",
			identity: "Linux"
		}
	];

  _info = new _pkg.Info();

  /**
   * @structure isIE
   */

  this.isIE = _info.browser == 'Explorer';

  /**
   * @structure isIE8
   */

  this.isIE8 = _info.browser == 'Explorer' && _info.version == 8;

});

/**
 * @namespace dom
 */

ECMAScript.Extend('dom', function (ecma) {

  /**
   * _fork
   *
   * Many of these functions take an element as the first argument and do
   * not return a value. This method `_fork` simply wraps such a function so 
   * that it can be passed an array of elements as the first argument.
   *
   * @return Depends on `arguments[0]`. If the caller passed in an array, then
   * an array is returned, with each result as a corresponding member.
   *
   * Is this a candidate method for ecma.util?
   */

  function _fork (func, scope) {
    return function () {
      var result = [];
      var args = ecma.util.args(arguments);
      var wantarray = ecma.util.isArray(args[0]);
      var elems = wantarray ? args.shift() : [args.shift()];
      for (var i = 0; i < elems.length; i++) {
        result.push(func.apply(scope || this, [elems[i]].concat(args)));
      }
      return wantarray ? result : result[0];
    };
  }

  /**
   * @structure browser
   * Browser types.
   * Logic derived from Prototype (L<http://www.prototypejs.org>)
   * Depricated, use L<ecma.platform>.
   */

  this.browser = {

    /** @member isIE */
    isIE:
      !!(ecma.window.attachEvent
      && ecma.window.navigator.userAgent.indexOf('Opera') === -1),

    /** @member isOpera */
    isOpera:
      ecma.window.navigator.userAgent.indexOf('Opera') > -1,

    /** @member isWebKit */
    isWebKit:
      ecma.window.navigator.userAgent.indexOf('AppleWebKit/') > -1,

    /** @member isGecko */
    isGecko:
      ecma.window.navigator.userAgent.indexOf('Gecko') > -1
      && ecma.window.navigator.userAgent.indexOf('KHTML') === -1,

    /** @member isMobileSafari */
    isMobileSafari:
      !!ecma.window.navigator.userAgent.match(/Apple.*Mobile.*Safari/)
  },

  /** @namespace dom */

  /**
   * @function getEventPointer
   * Pointer x/y coordinates derived directly from Prototype
   */
  this.getEventPointer = function (event) {
    var docElement = ecma.document.documentElement,
    body = ecma.dom.getRootElement() || { scrollLeft: 0, scrollTop: 0 };
    return {
      x: event.pageX || (event.clientX +
        (docElement.scrollLeft || body.scrollLeft) -
        (docElement.clientLeft || 0)),
      y: event.pageY || (event.clientY +
        (docElement.scrollTop || body.scrollTop) -
        (docElement.clientTop || 0))
    };
  };

  /**
   * @function getEventTarget
   */

  this.getEventTarget = function (event) {
    if (!event.target && event.srcElement) return event.srcElement;
    return event.target;
  };

  /**
   * @function addEventListener
   * Add an event listener to the target element.
   *
   *  ecma.dom.addEventListener(elem, listener);
   *  ecma.dom.addEventListener(elem, listener, scope);
   *  ecma.dom.addEventListener(elem, listener, scope, args);
   *  ecma.dom.addEventListener(elem, listener, scope, args, useCapture);
   *
   # If you are passing C<scope> or C<args>, the return value is the function 
   # needed for L<ecma.dom.removeEventListener>!
   *
   * @param target      <Element>   Target element
   * @param listener    <Function>  Callback function
   * @param scope       <Object>    Callback scope L<1>
   * @param args        <Array>     Arguments (appended after event parameter) L<1>
   * @param useCapture  <Boolean>   Use capture L<2>
   *
   * N<1> This method create the intermediate anonymous function, which is returned.
   *
   * N<2> Is only used when C<Element.addEventListener> exists.
   */

  /**
   * _eventName - Normalize event name (remove leading 'on')
   * Do not lower-case, event names are case-sensitive.
   */

  function _eventName (name) {
    try {
      name = name.indexOf('on') == 0 ? name.substr(2) : name;
      return name.indexOf('DOM') == 0 ? name : name.toLowerCase();
    } catch (ex) {
      // e.g., name is not defined or not a string
    }
  }

  this.addEventListener = function (target, type, listener, scope, args, useCapture) {
    var elem = ecma.dom.getElement(target);
    if (!elem) throw new Error('No such element');
    if (!useCapture) useCapture = false;
    if (typeof(type) == 'function') throw new Error('Missing argument: event type');
    var name = _eventName(type);
    var func = scope || args
      ? function () {
          var argz = ecma.util.args(arguments);
          return listener.apply(scope || elem, argz.concat(args));
        }
      : listener;
    if (target === ecma.document && name == 'load') {
      if (ecma.dom.content.hasLoaded) {
        ecma.lang.callback(func);
      } else {
        // Need to unwrap the first `action` argument
        func = function (action, event) {
          return listener.apply(scope || elem, [event].concat(args));
        };
        ecma.dom.content.addActionListener('load', func);
      }
//  TODO After incubation period of history.js is over, include it in the
//  build file and uncomment this condition.
//  } else if (target === ecma.window && name == 'statechange') {
//    ecma.platform.history.Adapter.bind(ecma.window, name, func);
    } else if (elem.addEventListener) {
      elem.addEventListener(name, func, useCapture);
    } else if (elem.attachEvent) {
      elem.attachEvent('on'+name, func);
    } else {
      throw new Error('Cannot add event listener');
    }
    return func;
  };

  /**
   * @function removeEventListener
   */

  this.removeEventListener = function (target, type, listener, scope, useCapture) {
    var elem = ecma.dom.getElement(target);
    if (!elem) throw new Error('No such element');
    if (!useCapture) useCapture = false;
    var name = _eventName(type);
    if (elem.removeEventListener) {
      elem.removeEventListener(name, listener, useCapture);
    } else if (elem.detachEvent) {
      elem.detachEvent('on' + name, listener);
    } else {
      throw new Error('Cannot remove event listener');
    }
  }

  /**
   * @function stopEvent
   * Stops the given event from propigating and bubbling.
   *  ecma.dom.stopEvent(event);
   * Where:
   *  event   <Event>       The event to stop
   * Additionally, C<event.stopped> is set to C<true>.
   */

  this.stopEvent = function (event) {
    try {
      event.stopped = true; // for this and other libraries
      event.preventDefault();
      event.stopPropagation();
    } catch (ex) {
      if (event) {
        // IE 8 and earlier
        event.cancelBubble = true;
        event.returnValue = false;
      }
    }
  };

  /**
   * @function setTimeout
   * Delay execution of a callback function.
   *  ecma.dom.setTimeout(func, delay);
   *  ecma.dom.setTimeout(func, delay, scope);
   *  ecma.dom.setTimeout(func, delay, scope, args);
   * Where:
   *  func <Function> to call back
   *  delay <Number> in milliseconds
   *  scope <Object> for C<func>
   *  args <Array> passed to C<func>
   *  excb <Function|Array> Exception handler (optional) L<1>
   *
   * Supresses arguments passed by window.setTimeout, such as the number of 
   * seconds late in FF.
   *
   * N<1> If a C<excb> function is provided it is passed any exception which
   * may be thrown while applying the callback.  The C<excb> function is
   * called with the same scope (if provided) as the callback, i.e.,
   *
   *  excb.call(scope, ex);
   */

  this.setTimeout = function (func, delay, scope, args, excb) {
    if (typeof(func) != 'function') throw new Error('Invalid argument: func');
    var cb = excb
      ? function () {
          try {
            func.apply(scope || this, args || []);
          } catch (ex) {
            ecma.lang.callback(excb, scope, [ex]);
          }
        }
      : function () {
          func.apply(scope || this, args || []);
        };
    return ecma.window.setTimeout(cb, delay);
  };

  /**
   * @function clearTimeout
   */

  this.clearTimeout = function (id) {
    return ecma.window.clearTimeout(id);
  };

  /**
   * @function setInterval
   * Repeat execution of a callback function at a specific interval.
   *  @param func to call back
   *  @param delay in milliseconds
   *  @param scope for <func>
   *  @param args passed to <func>
   * Supresses arguments passed by window.setInterval, such as the number of 
   * seconds late in FF.
   */

  this.setInterval = function (func, interval, scope, args) {
    var cb = function () {
      func.apply(scope || this, args || []);
    };
    return ecma.window.setInterval(cb, interval);
  };

  /**
   * @function clearInterval
   */

  this.clearInterval = function (id) {
    return ecma.window.clearInterval(id);
  };

  /**
   * @function waitUntil
   * Calls a function after a condition is met.
   *
   *  ecma.dom.waitUntil(func, cond);
   *  ecma.dom.waitUntil(func, cond, delay);
   *  ecma.dom.waitUntil(func, cond, delay, scope);
   *  ecma.dom.waitUntil(func, cond, delay, scope, args);
   *
   * Where
   *
   *  func      <Function>  Function to apply after
   *  cond      <Function>  Condition to be met
   *  delay     <Number>    Milliseconds to delay before checking (default=10)
   *  scope     <Object>    Applied to func and cond functions
   *  args      <Array>     Passed to func and cond functions
   *
   * The time between calls doubles (decays) each time the condition function 
   * returns false.  For example, when C<delay> is 10 (the default),
   * conditional checks will occur:
   *  1st check:  10 ms after L<ecma.dom.waitUntil> is called
   *  2nd check:  20 ms after the 1st check
   *  3rd check:  40 ms after the 2nd check
   *  4th check:  80 ms after the 3rd check
   *  5th check: 160 ms after the 3rd check
   *
   * TODO: Allow the C<delay> parameter to specify the decay value as its
   * decimal portion.  For instance, 10.2 would indicate a delay of 10 with a
   * decay of 2.
   *
   * TODO: Provide a mechanism for cancelation.  For example, if the delay is
   * 1000, abort.  Maybe another part of the C<delay> paramter, as in
   * "10.2/1000" means delay=10, decay=2, and timeout=1000...
   */

  this.waitUntil = function (func, cond, delay, scope, args) {
    if (!ecma.util.defined(delay)) delay = 10;
    var decay = 2;
    var cb = function () {
      if (cond.apply(scope || this, args || [])) {
        func.apply(scope || this, args || []);
        return true;
      }
      return false;
    }
    if (cb()) return;
    var waitFunc;
    waitFunc = function () {
      if (cb()) return;
      delay *= decay;
      ecma.dom.setTimeout(waitFunc, delay, scope, args);
    };
    ecma.dom.setTimeout(waitFunc, delay, scope, args);
  };

  /* ======================================================================== */

  /**
   * @function getRootElement
   * Get the document's root element
   */

  this.getRootElement = function () {
    return ecma.document.rootElement
      || ecma.dom.getBody()             // X?HTML
      || ecma.document.documentElement  // XML, SVG
      || ecma.document.lastChild
      || ecma.document;
  };

  /**
   * @function getHead
   * Get our document's head
   */

  this.getHead = function () {
    var heads = ecma.document.getElementsByTagName('head');
    return heads && heads.length > 0 ? heads[0] : ecma.dom.getRootElement();
  };

  /**
   * @function getBody
   * Get our document's body
   */

  this.getBody = function () {
    var bodies = ecma.document.getElementsByTagName('body');
    return bodies && bodies.length > 0 ? bodies[0] : undefined;
  };

  /**
   * @function getFrame
   * Return the frame specified by id.
   *  @param id <ID>
   */

  this.getFrame = function (id) {
    if (typeof(id) == 'object') return id;
    return frames[id] || ecma.dom.getElement(id);
  };

  /**
   * @function getContentWindow
   * Returns the inner contentWindow of an IFRAME or FRAME.
   *  @param id of the FRAME or IFRAME
   */

  this.getContentWindow = function (frameid) {
    var iframe = ecma.dom.getFrame(frameid);
    if (!iframe) return;
    return iframe.contentWindow || iframe.window;
  };

  /**
   * @function getContentDocument
   * Returns the inner contentDocument of an IFRAME or FRAME.
   *  @param id of the FRAME or IFRAME
   */

  this.getContentDocument = function (frameid) {
    var iframe = ecma.dom.getFrame(frameid);
    if (!iframe) return;
    return iframe.contentWindow
      ? iframe.contentWindow.document
      : iframe.contentDocument || iframe.document;
  };

  /**
   * @function getContentJS
   * Returns the ECMAScript.Class for the specified frame.
   *  @param frame <String|Element> Id of or the frame element.
   * A new L<ECMAScript.Class> will be created if the window does not define
   * a C<js> member.
   */

  this.getContentJS = function (frameid) {
    try {
      var frame = ecma.dom.getFrame(frameid);
      var doc = ecma.dom.getContentDocument(frame);
      var win = ecma.dom.getContentWindow(frame);
      if (!ecma.http.isSameOrigin(ecma.document.location.href,
          doc.location.href)) {
        // For platforms which do not raise an exception
        return null;
      }
      return win.js || new ECMAScript.Class(win, doc);
    } catch (ex) {
      // Documents outside this domain will throw an exception when 
      // attempting to access their window and document objects.
      return null;
    }
  };

  /**
   * @function getElementsByNodeType
   * Recursively fetch elements with a specific C<nodeType>.
   *
   *  var array = ecma.dom.getElementsByNodeType(elem, type)
   *
   * For a list of nodeType values, refer to L<ecma.dom.constants>.  For
   * example, to find all comment nodes in the body of a document:
   *
   *  var body = ecma.dom.getBody();
   *  var type = ecma.dom.constants.COMMENT_NODE;
   *  var list = ecma.dom.getElementsByNodeType(body, type);
   */

  this.getElementsByNodeType = function (elem, type) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var result = [];
    _getElementsByNodeType(elem, type, result, elem);
    return result;
  };

  /**
   * @internal
   * Recursive implementation for getElementsByNodeType
   */

  function _getElementsByNodeType (elem, type, result, topElem) {
    if (!elem) return;
    if (elem.nodeType == type && elem !== topElem) {
      result.push(elem);
    }
    if (elem.childNodes) {
      for (var i = 0, node; node = elem.childNodes[i]; i++) {
        _getElementsByNodeType(node, type, result, topElem);
      }
    }
  }

  /**
   * @function getElementsByClassName
   * Get elements which have the specified class name.
   *
   *  var list = ecma.dom.getElementsByClassName(elem, className);
   *
   * Where:
   *
   *  @param elem <String|HTMLElement> Element to start searching
   *  @param className <String> Class name to search for
   */

  this.getElementsByClassName = function (elem, className) {
    elem = ecma.dom.getElement(elem);
    if (typeof(elem.getElementsByClassName) == 'function') {
      return elem.getElementsByClassName(className);
    }
    var result = [];
    _getElementsByClassName(elem, className, result);
    return result;
  };

  function _getElementsByClassName (elem, className, result) {
    if (elem.hasChildNodes()) {
      for (var i = 0, node; node = elem.childNodes[i]; i++) {
        if (ecma.dom.hasClassName(node, className)) result.push(node);
        _getElementsByClassName(node, className, result);
      }
    }
  }

  /**
   * @function getElementsByAttribute
   * Recursively fetch elements of the given attribute.
   *
   *  var nodes = js.dom.getElementsByAttribute(elem, 'href', '#')
   *
   *  @param elem <Element|ID> Parent element or id
   *  @param name <String> Attribute name
   *  @param value <String|Array> Attribute value or values
   */

  this.getElementsByAttribute = function (elem, name, value) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var result = [];
    var values = ecma.util.isArray(value) ? value : [value];
    _getElementsByAttribute(elem, name, values, result, elem);
    return result;
  };

  /**
   * @internal
   * Recursive implementation for getElementsByAttribute
   */

  function _getElementsByAttribute (elem, name, values, result, topElem) {
    if (!elem) return;
    if (elem.nodeType == ecma.dom.constants.ELEMENT_NODE && elem !== topElem) {
      var attr = ecma.dom.getAttribute(elem, name);
      if (ecma.util.grep(function (v) {return attr === v;}, values)) {
        result.push(elem);
      }
    }
    if (elem.childNodes) {
      for (var i = 0, node; node = elem.childNodes[i]; i++) {
        _getElementsByAttribute(node, name, values, result, topElem);
      }
    }
  }


  /**
   * @function getElementsByTagName
   * Recursively fetch elements of the given tag name or names.
   *
   *  var elems = js.dom.getElementsByTagName(elem, tagName);
   *  var elems = js.dom.getElementsByTagName(elem, [tagName, tagName]);
   *
   *  @param  elem      <Element|ID>    Parent element or id
   *  @param  tagName   <String|Array>  Tag name or names
   *  @return elems     <Array>         Elements which match in DOM order
   *
   * Example
   *
   *  // Clear all control values
   *  var controls = js.dom.getElementsByTagName(document.body, ['INPUT', 'TEXTAREA']);
   *  for (var i = 0, ctrl; ctrl = controls[i]; i++) {
   *    js.dom.setValue(ctrl, '');
   *  }
   */

  this.getElementsByTagName = function(elem, spec) {
    var tagNames = ecma.util.isArray(spec) ? spec : [spec];
    for (var i = 0; i < tagNames.length; i++) {
      tagNames[i] = tagNames[i].toUpperCase();
    }
    var result = [];
    elem = ecma.dom.getElement(elem);
    _getElementsByAttribute(elem, 'tagName', tagNames, result, elem);
    return result;
  };

  /**
   * @structure canvas
   * Canvas (aka window, screen, and page) dimensions and position
   */

  this.canvas = {

    /** @function getPosition */
    getPosition: function () {
      var pos = {
        windowX: ecma.dom.canvas.windowX(),
        windowY: ecma.dom.canvas.windowY(),
        scrollX: ecma.dom.canvas.scrollX(),
        scrollY: ecma.dom.canvas.scrollY(),
        pageX: ecma.dom.canvas.pageX(),
        pageY: ecma.dom.canvas.pageY()
      };
      pos.width = pos.windowX < pos.pageX ? pos.pageX : pos.windowX;
      pos.height = pos.windowY < pos.pageY ? pos.pageY : pos.windowY;
      return pos;
    },

    /** @function windowX */
    windowX: function() {
      var windowX = ecma.window.innerWidth
        || (ecma.document.documentElement && ecma.document.documentElement.clientWidth)
        || ecma.dom.getRootElement().clientWidth
        || (ecma.document.documentElement && ecma.document.documentElement.offsetWidth);
      return ecma.util.asInt(windowX);
    },

    /** @function windowY */
    windowY: function() {
      var windowY = ecma.window.innerHeight
        || (ecma.document.documentElement && ecma.document.documentElement.clientHeight)
        || ecma.dom.getRootElement().clientHeight
        || (ecma.document.documentElement && ecma.document.documentElement.offsetHeight);
      return ecma.util.asInt(windowY);
    },

    /** @function scrollX */
    scrollX: function() {
      var scrollX = (ecma.document.documentElement && ecma.document.documentElement.scrollLeft)
        || ecma.window.pageXOffset
        || ecma.dom.getRootElement().scrollLeft;
      return ecma.util.asInt(scrollX);
    },

    /** @function scrollY */
    scrollY: function() {
      var scrollY = (ecma.document.documentElement && ecma.document.documentElement.scrollTop)
        || ecma.window.pageYOffset
        || ecma.dom.getRootElement().scrollTop;
      return ecma.util.asInt(scrollY);
    },

    /** @function pageX */
    pageX: function() {
      var pageX = Math.max(
        ecma.util.asInt(ecma.document.documentElement.scrollWidth),
        ecma.util.asInt(ecma.dom.getRootElement().scrollWidth),
        ecma.util.asInt(ecma.dom.getRootElement().offsetWidth)
      )
      return ecma.util.asInt(pageX);
    },

    /** @function pageY */
    pageY: function() {
      var pageY = Math.max(
        ecma.util.asInt(ecma.document.documentElement.scrollHeight),
        ecma.util.asInt(ecma.dom.getRootElement().scrollHeight),
        ecma.util.asInt(ecma.dom.getRootElement().offsetHeight)
      )
      return ecma.util.asInt(pageY);
    }

  };

  /** @namespace dom */

  /**
   * @function getViewportPosition
   * Pixel coordinates and dimensions of the viewport
   */

  this.getViewportPosition = function () {
    var c = ecma.dom.canvas.getPosition();
    return {
      'left':   c.scrollX,
      'top':    c.scrollY,
      'width':  c.windowX,
      'height': c.windowY
    };
  };

  /* ======================================================================== */

  /**
   * @function getElement
   * Cross-browser function for referring to a document element by id.
   *  @param unk Element id, Element object, or a function (which ought return an
   * element object)
   */

  this.getElement = function (unk) {
    return  typeof(unk) == 'object'         ? unk                                     :
            unk instanceof Object           ? unk                                     :
            ecma.document.getElementById    ? ecma.document.getElementById(unk)       :
            ecma.document.all               ? ecma.document.all[unk]                  :
            ecma.document.layers            ? ecma.document.layers[unk]
                                            : false;
  };

  /**
   * @function getParentElement
   * Get a parent element by its tag name.
   *
   *  var pElem = ecma.dom.getParentElement(elem);
   *  var pElem = ecma.dom.getParentElement(elem, tagName);
   *
   * Where:
   *
   *  @param elem <String|HTMLElement> Element to start searching
   *  @param tagName <String> Tag name of the parent element (optional)
   *
   * For example:
   *
   *  <table>
   *    <tbody>
   *      <tr>
   *        <td id="e1">
   *          ...
   *        </td>
   *      </tr>
   *    </tbody>
   *  </table>
   *
   *  ecma.dom.getParentElement('e1');          // will return the TR element
   *  ecma.dom.getParentElement('e1', 'TABLE'); // will return the TABLE element
   */

  this.getParentElement = function (elem, tagName) {
    elem = ecma.dom.getElement(elem);
    while (elem && elem.parentNode) {
      if (elem.parentNode.nodeType == 1) {
        if (!tagName || elem.parentNode.tagName == tagName) {
          return elem.parentNode;
        }
      }
      elem = elem.parentNode;
    }
    return undefined;
  };

  /**
   * @function getDescendantById
   *
   * Get a child node by its id.  This method constrains the scope of elements
   * to the descendants of the given element, for times when could be many
   * elements with the same id.
   *
   *  var node = ecma.dom.getDescendantById(elem, id);
   *
   * Where:
   *
   *  @param elem <String|HTMLElement> Element to start searching
   *  @param id <String> Identifier of the target element
   *
   * For example:
   *
   *  <div id="e1">
   *    <p id="e2">...</p>
   *  </div>
   *
   *  ecma.dom.getDescendantById('e1', 'e2'); // will return the P element
   */

  this.getDescendantById = function (elem, id) {
    elem = ecma.dom.getElement(elem);
    var result = null;
    if (elem.hasChildNodes()) {
      for (var i = 0, node; node = elem.childNodes[i]; i++) {
        if (node.id == id) {
          result = node;
        } else {
          result = ecma.dom.getDescendantById(node, id);
        }
        if (result) break;
      }
    }
    return result;
  };

  /**
   * @function createElement
   * Create a document element.
   *
   *  var elem = createElement(tagName);
   *  var elem = createElement(tagName, attrs);
   *  var elem = createElement(tagName, children);
   *  var elem = createElement(tagName, attrs, children);
   *
   * Where:
   *
   *  tagName   <String>  Element tag name L<1>
   *  attrs     <Object>  Attributes for this element
   *  children  <Array>   Children of this element
   *
   * The C<arguments> are taken one at a time as a token.  If the token is a
   * string, it is intepreted as the tag name.  If it is an object (and not
   * an Array) then it is considered to be attributes.  And, if it is an
   * array, it taken to be a list of createElement arguments for child nodes.
   *
   * Create an image:
   *
   *  var elem = ecma.dom.createElement(
   #    'img', {src: 'http://www.example.com/images/example.png'}
   *  );
   *
   * Create a comment node:
   *
   *  var elem = ecma.dom.createElement(
   #    '#comment', {nodeValue: 'Example'}
   *  );
   *
   * Create a text node:
   *
   *  var elem = ecma.dom.createElement(
   #    '#text', {nodeValue: 'Example'}
   *  );
   *
   * Create a div with child elements:
   *
   *  var elem = ecma.dom.createElement(
   #    'div', [
   #      'h1', {id: 'h101'},
   #      'p', {id: 'text42', style: {'font-size':'.8em'}}
   #    ]
   *  );
   *
   * N<1> Shortcut syntax for C<tagName>
   *
   *  TODO
   *
   *  tag#id
   *  tag.class
   *  tag#id.class
   *
   *  div#myDiv.padded      tagName = div
   *                        id      = myDiv
   *                        class   = padded
   *
   */

  this.createElement = function () {
    var args = ecma.util.args(arguments);
    var tagName = args.shift();
    if (!tagName) return;
    var attrs = args.shift();
    var children = args.shift();
    if (ecma.util.isArray(attrs) || ecma.util.isa(attrs, ecma.window.NodeList)) {
      children = attrs;
      attrs = undefined;
    }
    var elem = undefined;
    if (tagName.nodeType) {
      elem = tagName;
    } else if (tagName.indexOf('#') == 0) {
      var parts = tagName.split('=', 2);
      if (parts.length == 2) {
        tagName = parts[0];
        if (!attrs) attrs = {};
        if (attrs.nodeValue) throw new Error('Multiple nodeValues');
        attrs.nodeValue = parts[1];
      }
      if (!attrs) attrs = {};
      if (tagName == '#text') {
        elem = ecma.document.createTextNode(attrs.nodeValue);
      } else if (tagName == '#comment') {
        elem = ecma.document.createComment(attrs.nodeValue);
      } else {
        throw new Error('Component not available: ' + tagName);
      }
      if (children) throw new Error('Cannot append children to a #text node');
      return elem;
    } else {
      var parts = tagName.match(/^([^#\.=]+)(#[^=\.]+)?(\.[^=]+)?(=.*)?/);
      if (!parts) throw new Error('Invalid tagName specification: ' + tagName);
      if (!attrs) attrs = {};
      tagName = parts[1];
      if (parts[2] && !attrs['id']) {
        attrs['id'] = parts[2].substr(1);
      }
      if (parts[3] && !attrs['class']) {
        attrs['class'] = parts[3].substr(1).split('.').join(' ');
      }
      if (parts[4] && !attrs['innerHTML']) {
        attrs['innerHTML'] = parts[4].substr(1);
      }
      elem = attrs && attrs.namespace && ecma.document.createElementNS
        ? ecma.document.createElementNS(attrs.namespace, tagName.toUpperCase())
        : ecma.document.createElement(tagName.toUpperCase());
    }
    if (attrs) {
      for (var k in attrs) {
        if (!k) continue;
        if (k.toLowerCase() == 'namespace') continue;
        var v = attrs[k];
        if (k.toLowerCase() == 'style' && typeof(v) == 'object') {
          for (var k2 in v) {
            var v2 = v[k2];
            ecma.dom.setStyle(elem, k2, v2);
          }
        } else {
          // attribute
          ecma.dom.setAttribute(elem, k, v);
        }
      }
    }
    if (children) {
      ecma.dom.appendChildren(elem,
        ecma.dom.createElements.apply(ecma.dom, children));
    }
    return elem;
  };

  /**
   * @function createElements
   * Create an Array of DOM elements
   *  @param tag name of first element
   *  @param attrs of first element
   *  @param children of first element
   *
   * Parameters inspected to determine what they mean.  The first parameter must
   * be a string, which specifies the tag name for this new element.  If the 
   * next parameter is an Object, which is not an Array, it specifies the 
   * attributes for this new element.  If the next param is (was) an Array
   * object, it specifies the children of this new element.
   *
   * The items of the attributes Object are passed to createElement.
   *
   * The items placed in the child Array are the arguments to recursive call to
   * this method.
   *
   */

  this.createElements = function() {
    var args = ecma.util.args(arguments);
    var elems = new Array();
    while (args && args.length > 0) {
      var attrs = null;
      var children = null;
      var childNodes = null;
      var elem = null;
      var tag = args.shift();
      if (!tag) continue;
      if (ecma.util.isArray(tag)) {
        ecma.lang.assert(elems.length, 'createElements needs something to append to');
        ecma.dom.appendChildren(elems[elems.length - 1],
          ecma.dom.createElements.apply(ecma.dom, tag)
        );
        continue; // elem does not get defined
      } else if (typeof(tag) != 'string' && tag.nodeType) {
        elem = tag;
        if (ecma.util.isArray(args[0])) {
          children = args.shift();
          ecma.dom.appendChildren(elem,
            ecma.dom.createElements.apply(ecma.dom, children)
          );
        }
      } else {
        if (ecma.util.isAssociative(args[0]) && !args[0].nodeType) {
          attrs = args.shift();
        }
        if (ecma.util.isArray(args[0])) {
          children = args.shift();
        }
        elem = ecma.dom.createElement(tag, attrs, children);
      }
      elems.push(elem);
    }
    return elems;
  };

  /**
   * @function replaceChildren
   * Remove existing children and insert new ones.
   *  @param elem <ID or Element> to act upon
   *  @param children <Array> to append
   */

  this.replaceChildren = function (elem, children) {
    var removedElements = ecma.dom.removeChildren(elem);
    ecma.dom.appendChildren(elem, children);
    return removedElements;
  };

  /**
   * @function appendChildren
   * Append children to an element.
   *
   *  @param children <Array> to append L<1>
   *  @param elem <ID or Element> to act upon L<1>
   *
   * N<1> For backward-compatability reasons these two arguments may be passed 
   * in reverse order, i.e.:
   *
   *  ecma.dom.appendChildren(elem, children)
   *
   * Passing the child array as the first argument is prefered as it matches 
   * the argument specification of the Element method C<appendChild>.
   */

  this.appendChildren = function (arg1, arg2) {
    var elem, children;
    var result = [];
    if (ecma.util.isArray(arg1)) {
      elem = arg2;
      children = arg1;
    } else {
      elem = arg1;
      children = arg2;
    }
    elem = ecma.dom.getElement(elem);
    if (!ecma.util.defined(elem)) throw new Error('[appendChildren] elem not defined');
    if (!ecma.util.defined(children)) throw new Error('[appendChildren] missing children');
    var len = children.length || 0;
    for (var i = 0; i < children.length;) {
      var child = children[i];
      if (ecma.util.defined(child)) {
        if (child instanceof Array) {
          result = result.concat(ecma.dom.appendChildren(elem, child));
        } else {
          result.push(elem.appendChild(children[i]));
        }
      }
      i++;
      if (children.length != len) {
        i -= (len - children.length);
        len = children.length;
      }
    }
    return result;
  };

  /**
   * @function appendChild
   * Append a child node.
   *  @param elem <String|DOMElement> parent element
   *  @param child <DOMElement> child element
   */

  this.appendChild = function (elem, child) {
    return ecma.dom.getElement(elem).appendChild(child);
  };

  /**
   * @function prependChild
   * Insert the element as the first child of the parent.
   *  @param elem <String|DOMElement> parent element
   *  @param child <DOMElement> child element
   */

  this.prependChild = function (elem, child) {
    var p = ecma.dom.getElement(elem)
    if (p.hasChildNodes()) {
      p.insertBefore(child, p.firstChild);
    } else {
      p.appendChild(child);
    }
  };

  /**
   * @function insertChildrenAfter
   * Insert children after an existing element
   *
   *  @param elem <ID or Element> which is to preceed the child nodes
   *  @param children <Array> children to insert
   *
   * The C<children> array may also contain arrays.
   *
   * Undefined array values are skipped.
   *
   * These parameters are unfortunately reversed from the standard
   * C<insertAfter> function. The convention of passing the target element as
   * the first parameter is consistent in this module.
   */

  this.insertChildrenAfter = function (elem, children) {
    elem = ecma.dom.getElement(elem);
    if (!ecma.util.defined(elem)) throw new Error('[insertChildrenAfter] elem not defined');
    if (!ecma.util.defined(children)) throw new ecma.window.Error('[insertChildrenAfter] missing children');
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!ecma.util.defined(child)) throw new Error('[insertChildrenAfter] undefined child node');
      if (child instanceof Array) {
        elem = ecma.dom.insertChildrenAfter(elem, child);
      } else {
        elem = ecma.dom.insertAfter(child, elem);
      }
    }
    return elem;
  };

  /**
   * @function insertChildrenBefore
   * Insert children before an existing element
   *  @param elem <ID or Element> which the child nodes are to preceed
   *  @param children <Array> to insert
   */

  this.insertChildrenBefore = function (elem, children) {
    elem = ecma.dom.getElement(elem);
    if (!ecma.util.defined(elem)) throw new Error('[insertChildrenBefore] elem not defined');
    if (!ecma.util.defined(children)) throw new ecma.window.Error('missing children');
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!ecma.util.defined(child)) throw new Error('undefined child node');
      if (child instanceof Array) {
        elem = ecma.dom.insertChildrenBefore(elem, child);
      } else {
        elem.parentNode.insertBefore(child, elem);
      }
    }
    return elem;
  };

  /**
   * @function insertBefore
   * Insert an element before another.
   *  @param elem Element to insert
   *  @param target Element which it is to precede
   */

  this.insertBefore = function (elem, target) {
    if (!(ecma.util.defined(target) && ecma.util.defined(elem))) return;
    var p = target.parentNode;
    if (!p) throw new Error('undefined parent node');
    p.insertBefore(elem, target);
  };

  /**
   * @function insertAfter
   * Insert an element after another.
   *  @param elem Element to insert
   *  @param target Element which is to precede it
   */

  this.insertAfter = function (elem, target) {
    if (!(ecma.util.defined(target) && ecma.util.defined(elem))) return;
    var p = target.parentNode;
    if (!p) throw new Error('undefined parent node');
    if (p.lastChild === target) {
      p.appendChild(elem);
      ecma.lang.assert(p.lastChild === elem);
    } else {
      p.insertBefore(elem, target.nextSibling);
      ecma.lang.assert(target.nextSibling === elem);
    }
    return elem;
  };

  /**
   * @function removeChildren
   * Remove all child nodes from an element
   *  @param element|id Element or Element ID
   */

  this.removeChildren = _fork(function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!(elem && elem.childNodes)) return;
    var result = [];
    for (var idx = elem.childNodes.length - 1; idx >= 0; idx--) {
      result.push(elem.removeChild(elem.childNodes[idx]));
    }
    return result;
  });

  /**
   * @function removeElement
   * Remove a node from the document if it exists and has a parent.
   *  var removedElement = ecma.dom.removeElement(elem);
   */

  this.removeElement = _fork(function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var pElem = elem.parentNode;
    if (!pElem) return;
    return pElem.removeChild(elem);
  });

  /**
   * @function removeElements
   * Remove multiple nodes from the document.  If the node does not have a
   * parent it is ignored.
   *  var removedElements = ecma.dom.removeElements(elem1);
   *  var removedElements = ecma.dom.removeElements(elem1, elem2, ...);
   *  var removedElements = ecma.dom.removeElements([elem1, elem2, ...]);
   */

  this.removeElements = function () {
    var args = ecma.util.args(arguments);
    var result = [];
    while (args && args.length > 0) {
      var arg = args.shift();
      if (ecma.util.isArray(arg)) {
        result = result.concat(ecma.dom.removeElements.apply(ecma.dom, arg));
      } else {
        result.push(ecma.dom.removeElement(arg));
      }
    }
    return result;
  };

  /**
   * @function removeElementOrphanChildren
   * Remove a node from the document if it exists and has a parent, however do
   * not remove its children.
   *  ecma.dom.removeElementOrphanChildren(elem1);
   */

  this.removeElementOrphanChildren = function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var pElem = elem.parentNode;
    if (!pElem) return;
    while (elem.firstChild) {
      pElem.insertBefore(elem.firstChild, elem);
    }
    return pElem.removeChild(elem);
  };

  /**
   * @function insertElementAdoptChildren
   * Insert a child element, adopting all of the parent element's children.
   *  ecma.dom.insertElementAdoptChildren(elem, parentElem);
   */

  this.insertElementAdoptChildren = function (elem, parentElem) {
    elem = ecma.dom.getElement(elem);
    parentElem = ecma.dom.getElement(parentElem);
    if (!(parentElem && elem)) return;
    if (parentElem.firstChild) {
      parentElem.insertBefore(elem, parentElem.firstChild);
      while (elem.nextSibling) {
        elem.appendChild(elem.nextSibling);
      }
    } else {
      parentElem.appendChild(elem);
    }
  };

  /**
   * @function replaceElement
   * Replaces the given child element with another.
   *  var elem = ecma.dom.replaceElement(newElem, elem);
   */

  this.replaceElement = function (newElem, elem) {
    elem.parentNode.insertBefore(newElem, elem);
    return elem.parentNode.removeChild(elem);
  };

  /**
   * @function isChildOf
   * Is an element a child of another?
   *
   *  <div id="id1">
   *    <div id="id2">
   *    </div>
   *  </div>
   *
   *  var bool = ecma.dom.isChildOf('id2', 'id1'); // true
   */

  this.isChildOf = function (elem, parentElem) {
    var y = ecma.dom.getElement(parentElem);
    var x = ecma.dom.getElement(elem);
    while (x && y) {
      if (x === y) return true;
      if (x === x.parentNode) break;
      x = x.parentNode;
    }
    return false;
  };

  /**
   * @function makePositioned
   * Give the element a positioned style
   *  @param elem Element or Element ID
   */

  this.makePositioned = function (elem) {
    elem = ecma.dom.getElement(elem);
    var pos = ecma.dom.getStyle(elem, 'position');
    if (pos == 'static' || !pos) {
      elem.style.position = 'relative';
      if (ecma.dom.browser.isOpera) {
        ecma.dom.setStyle(elem, 'top', 0);
        ecma.dom.setStyle(elem, 'left', 0);
      }
    }
    return elem;
  };

  /**
   * @function getStyle
   * Get CSS property
   */

  var _getComputedStyle;
  try {
    _getComputedStyle = ecma.document.defaultView.getComputedStyle;
  } catch (ex) {
    _getComputedStyle = ecma.window.getComputedStyle;
  }

  this.getStyle = function (elem, propName) {
    elem = ecma.dom.getElement(elem);
    if (!(elem && propName && elem.style)) return;
    propName = ecma.dom.translateStyleName(propName);
    if (_getComputedStyle) {
      var hyphenated = ecma.util.asHyphenatedName(propName);
      var cs = _getComputedStyle(elem,undefined)
      return cs ? cs.getPropertyValue(hyphenated) : undefined;
    } else if (elem.currentStyle) {
      var camelCase = ecma.util.asCamelCaseName(propName);
      return elem.currentStyle[camelCase];
    } else {
      var camelCase = ecma.util.asCamelCaseName(propName);
      return elem.style[camelCase];
    }
  };

  /**
   * @function setStyle
   * Sets a style property on an element.
   *
   *  ecma.dom.setStyle(elem, styleName, value)
   *  ecma.dom.setStyle(elem, styleName, value, importance)
   *
   * Where:
   *
   *  elem      <Element>   Identifier or reference
   *  styleName <String>    Property name, like "background-color"
   *  value     <String>    Property value
   *  importance            Only used when C<style.setProperty> is supported
   *
   * The xbrowser diffferences between C<cssFloat> and C<float> are translated
   * accordingly.
   *
   * Tries to use C<style.setProperty>, otherwise converts the style name to
   * its camel-cased counterpart and sets the style-object member.
   *
   * When an exception is thrown, i.e., style name is not supported, the
   * exception message is rewritten in a meaningful way, then rethrown.
   */

  this.setStyle = function (elem, propName, propValue, importance) {
    var elem = ecma.dom.getElement(elem);
    if (!elem || !elem.style) return;
    propName = ecma.dom.translateStyleName(propName);
    propValue = new String(propValue).toString();
    try {
      if (ecma.util.defined(elem.style.setProperty)) {
        elem.style.setProperty(propName, propValue, importance ? importance : null);
      } else {
        propName = ecma.util.asCamelCaseName(propName);
        elem.style[propName] = propValue;
      }
    } catch (ex) {
      if (ecma.dom.browser.isIE) {
        if (ex instanceof Object) {
          // The standard "Invalid argument" message is next to meaningless.
          // this happens when in IE you set a style to a seemingly invalid
          // value.  TODO Limit this catch to just those exceptions, in all
          // languages.
          ex.message = 'Cannot set style "' + propName + '" to "' + propValue + '".';
          // Strange thing, the new message does not 'commit' itself unless something
          // is done with it, like sending it to console.log.  TODO Find out what's
          // going on.
          ex.description = ex.message;
          ecma.console.log(ex.message);
        }
      }
      throw ex;
    }
  };

  /**
   * @function translateAttributeName
   * Returns the name of the element attribute in the language running platform
   *  var attrName = ecma.dom.translateAttributeName('className');
   */

  this.translateAttributeName = function (name) {
    if (name == 'className' || name == 'class' && ecma.platform.isIE) {
      if (ecma.document.documentMode && ecma.document.documentMode > 7) {
        return 'class';
      } else {
        return 'className';
      }
    }
    return name;
  };

  /**
   * @function translateStyleName
   * Returns the style property-name in the language of the running platform
   *  var styleName = ecma.dom.translateStyleName('cssFloat');
   */

  this.translateStyleName = function (name) {
    if (name == 'cssFloat' && !ecma.dom.browser.isIE) return 'float';
    if (name == 'cssFloat' && ecma.dom.browser.isIE) return 'styleFloat';
    if (name == 'float' && ecma.dom.browser.isIE) return 'styleFloat';
    if (name == 'float' && ecma.dom.browser.isOpera) return 'cssFloat';
    return name;
  };

  /**
   * @function setStyles
   * Sets multiple style values.
   *  ecma.dom.setStyles(elem, styles)
   *  ecma.dom.setStyles(elem, styles, importance)
   * Where:
   *  elem      <Element>   Identifier or reference
   *  styles    <Object>    Name-value style pairs
   *  importance            Stylesheet importance property
   * For example:
   *  ecma.dom.setStyles('mydiv', {'width':'10px','height':'20px'});
   */
  this.setStyles = function (elem, styles, importance) {
    for (var name in styles) {
      ecma.dom.setStyle(elem, name, styles[name], importance);
    }
  };

  /**
   * @function removeStyle
   * Remove the style property from the given element.
   *  ecma.dom.removeStyle(elem, 'background-image');
   */

  this.removeStyle = function (elem, propName) {
    elem = ecma.dom.getElement(elem);
    propName = ecma.dom.translateStyleName(propName);
    if (!elem) throw new ecma.error.MissingArg('elem');
    if (!propName) throw new ecma.error.MissingArg('propName');
    if (typeof(elem.style.removeProperty) == 'function') {
      elem.style.removeProperty(propName);
    } else if (elem.style.removeAttribute) {
      elem.style.removeAttribute(propName);
    } else {
      propName = ecma.util.asCamelCaseName(propName);
      try {
        elem.style[propName] = null;
      } catch (ex) {
        if (ex instanceof Object) {
          ex.description = 'Cannot remove style "' + propName + '".';
        }
        throw ex;
      }
    }
  };

  /**
   * @function hasClassName
   * css class names
   */

  this.hasClassName = function (elem, name) {
    var classAttr = ecma.dom.getAttribute(elem, 'class');
    if (!classAttr) return false;
    var names = classAttr.split(/\s+/);
    for (var i = 0; i < names.length; i++) {
      if (names[i] == name) return true;
    }
    return false;
  };

  /**
   * @function setClassName
   */

  this.setClassName = function (elem, name) {
    ecma.dom.setAttribute(elem, 'class', name);
  }

  /**
   * @function addClassName
   */

  this.addClassName = _fork(function (elem, name) {
    var classAttr = ecma.dom.getAttribute(elem, 'class');
    var names = classAttr ? classAttr.split(/\s+/) : [];
    for (var i = 0; i < names.length; i++) {
      if (names[i] == name) return;
    }
    names.push(name);
    ecma.dom.setAttribute(elem, 'class', names.join(' '));
  });

  /**
   * @function addClassNames
   */

  this.addClassNames = _fork(function () {
    var args = ecma.util.args(arguments);
    var elem = args.shift();
    if (!elem) return;
    for (var i = 0; i < args.length; i++) {
      if (ecma.util.isArray(args[i])) {
        ecma.dom.addClassNames.apply(this, [elem].concat(args[i]));
      } else {
        ecma.dom.addClassName(elem, args[i]);
      }
    }
  });

  /**
   * @function removeClassName
   */

  this.removeClassName = _fork(function (elem, name) {
    var classAttr = ecma.dom.getAttribute(elem, 'class');
    if (!classAttr) return;
    var names = classAttr.split(/\s+/);
    for (var i = 0; i < names.length; i++) {
      if (names[i] == name) names.splice(i--, 1);
    }
    ecma.dom.setAttribute(elem, 'class', names.join(' '));
  });

  /**
   * @function removeClassNames
   */

  this.removeClassNames = _fork(function () {
    var args = ecma.util.args(arguments);
    var elem = args.shift();
    if (!elem) return;
    for (var i = 0; i < args.length; i++) {
      ecma.dom.removeClassName(elem, args[i]);
    }
  });

  /**
   * @function toggleClassName
   */

  this.toggleClassName = function (elem, name, enable) {
    if (!ecma.util.defined(enable)) {
      enable = !ecma.dom.hasClassName(elem, name);
    }
    if (!enable) {
      ecma.dom.removeClassName(elem, name);
      return false;
    } else {
      ecma.dom.addClassName(elem, name);
      return true;
    }
  };

  /**
   * @function getAttribute
   */

  this.getAttribute = function (elem, attrName) {
    var elem = ecma.dom.getElement(elem);
    if (!elem) return;
    if (typeof(attrName) != 'string') return;
    if (attrName.indexOf('_') == 0) {
      var v1 = elem.getAttribute(attrName);
      var v2 = elem[attrName];
      return v1 === null || v1 === undefined ? v2 : v1;
    } else if (attrName.indexOf('on') == 0) {
      // event
      attrName = attrName.toLowerCase();
      return elem[attrName];
    } else {
      if (attrName.toLowerCase() == 'text'
          || attrName.toLowerCase() == 'tagname'
          || attrName.indexOf('inner') == 0) {
        return elem[attrName];
      } else if (elem.attributes && elem.attributes.getNamedItem) {
        // getNamedItem comes before getAttribute test because IE still returns
        // the innerHTML when getting the 'value' attribute from a BUTTON
        // element.
        var attr = elem.attributes.getNamedItem(attrName);
        return attr ? attr.value : attr;
      } else if (elem.getAttribute) {
        attrName = ecma.dom.translateAttributeName(attrName);
        return elem.getAttribute(attrName);
      } else {
        return elem[attrName];
      }
    }
  };

  /**
   * @function setAttribute
   * Set element attribute
   */

  this.setAttribute = function (elem, attrName, attrValue) {
    var elem = ecma.dom.getElement(elem);
    if (!elem) return;
    if (typeof(attrName) != 'string') return;
    if (attrName.indexOf('_') == 0) {
      // user-defined property
      elem[attrName] = attrValue;
    } else if (attrName.indexOf('on') == 0) {
      // event
      if (ecma.util.isArray(attrValue)) {
        // An event which is an array is considered arguments to create a callback
        ecma.dom.addEventListener.apply(ecma.dom,
            [elem, attrName].concat(attrValue));
      } else if (typeof(attrValue) == 'function') {
        ecma.dom.addEventListener(elem, attrName, attrValue);
      } else {
        attrName = attrName.toLowerCase();
        elem[attrName] = attrValue;
      }
    } else {
      if (attrName.toLowerCase() == 'value') {
        // When the browser (FF) is remembering values, simply setting the attribute
        // does not reflect the most "current" value of the control.  Since you're
        // calling this method from script, we presume you want the control to reflect
        // this new value.
        if (elem.attributes && elem.attributes.setNamedItem) {
          var namedItem = ecma.document.createAttribute('value');
          namedItem.value = attrValue;
          elem.attributes.setNamedItem(namedItem);
          elem.value = attrValue;
          return;
        } else {
          elem.value = attrValue;
          if (ecma.util.defined(elem.setAttribute)) {
            elem.setAttribute(attrName, attrValue);
          }
        }
      }
      attrName = ecma.dom.translateAttributeName(attrName);
      if (!ecma.util.defined(elem.setAttribute)
          || attrName.toLowerCase() == 'text'
          || attrName.indexOf('inner') == 0) {
        elem[attrName] = attrValue;
      } else {
        elem.setAttribute(attrName, attrValue);
      }
    }
  };

  /**
   * @function removeAttribute
   */

  this.removeAttribute = function (elem, attrName) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    elem.removeAttribute(attrName);
  };

  /**
   * @function getOpacity
   */

  this.getOpacity = function (elem) {
    var result = undefined;
    if (ecma.dom.browser.isIE
        && (!ecma.document.documentMode || ecma.document.documentMode < 9)) {
      var styleText = ecma.dom.getStyle(elem, 'filter')
          || ecma.dom.getStyle(elem, '-ms-filter')
          || '';
      var matched = styleText.match(/opacity\s*=\s*(\d+)/i);
      var percent = matched ? matched[1] : 100;
      result = (percent / 100);
    } else if (ecma.dom.browser.isGecko) {
      var opacity = ecma.dom.getStyle(elem, 'opacity');
      if (!ecma.util.isDefined(opacity)) {
        opacity = ecma.dom.getStyle(elem, '-moz-opacity');
      }
      if (!ecma.util.isDefined(opacity)) {
        opacity = '1';
      }
      result = parseFloat(opacity);
    } else if (ecma.dom.browser.isWebKit) {
      var opacity = ecma.dom.getStyle(elem, 'opacity');
      if (!ecma.util.isDefined(opacity)) {
        opacity = ecma.dom.getStyle(elem, '-khtml-opacity');
      }
      if (!ecma.util.isDefined(opacity)) {
        opacity = '1';
      }
      result = parseFloat(opacity);
    } else {
      var opacity = ecma.dom.getStyle(elem, 'opacity');
      if (!ecma.util.isDefined(opacity)) {
        opacity = '1';
      }
      result = parseFloat(opacity);
    }
    return result.toFixed(2);
  };

  /**
   * @function setOpacity
   */

  this.setOpacity = function (elem, opacity) {
    opacity = (Math.round(opacity * 10000) / 10000);
    if (ecma.dom.browser.isIE
        && (!document.documentMode || document.documentMode < 9)) {
      opacity *= 100;
      ecma.dom.setStyle(elem, '-ms-filter', 'alpha(opacity='+opacity+')');
      ecma.dom.setStyle(elem, 'filter', 'alpha(opacity='+opacity+')');
    } else if (ecma.dom.browser.isGecko) {
      ecma.dom.setStyle(elem, '-moz-opacity', opacity);
      ecma.dom.setStyle(elem, 'opacity', opacity);
    } else if (ecma.dom.browser.isWebKit) {
      ecma.dom.setStyle(elem, '-khtml-opacity', opacity);
      ecma.dom.setStyle(elem, 'opacity', opacity);
    } else {
      ecma.dom.setStyle(elem, 'opacity', opacity);
    }
  };

  /**
   * @function getCenteredPosition
   * Get the (x, y) pixel coordinates which will center the
   * element relative to the viewport (or contextElem if it is provided)
   *
   *  @param element
   *  @param contextElem (optional)
   */

  this.getCenteredPosition = function (elem, contextElem) {
    elem = ecma.dom.getElement(elem);
    var vp;
    if (contextElem) {
      vp = ecma.dom.getElementPosition(contextElem);
    } else {
      vp = ecma.dom.getViewportPosition();
    }
    var pos = ecma.dom.getElementPosition(elem);
    var x = vp['left'] + (vp['width'] / 2) - (pos['width'] / 2);
    var y = vp['top'] + (vp['height'] / 2) - (pos['height'] / 2);
    if (x < vp['left']) x = vp['left'];
    if (y < vp['top']) y = vp['top'];
    return {'top': y, 'left': x};
  };

  /**
   * @function setPosition
   * Position an absolute element with respect to the view port
   * setPosition #elem, {props}
   * where:
   *  props.position: 'top-third'|'center'|'bottom-left'
   */

  this.setPosition = function (elem, props) {
    elem = ecma.dom.getElement(elem);
    if (!props) props = {'position': 'top-third'}
    /* Backup display values */
    var attrVisibility = elem.style.visibility;
    var attrDisplay = elem.style.display;
    /* Set display values */
    elem.style.visibility = 'hidden'; // don't flicker when positioning
    elem.style.display = 'block'; // so get height/width work
    /* Calculate new position */
    var vp = ecma.dom.getViewportPosition();
    var xy = ecma.dom.getCenteredPosition(elem, props.contextElem);
    if (props.position == 'top-third') {
      var h = ecma.dom.getHeight(elem);
      var t = (vp.height - h)/3;
      if (t < 0) t = ecma.util.asInt(ecma.dom.canvas.scrollY());
      if (t < ecma.dom.canvas.scrollY()) t += ecma.dom.canvas.scrollY();
      elem.style.left = xy.left + "px";
      elem.style.top = t + "px";
    } else if (props.position == 'center') {
      elem.style.left = xy.left + "px";
      elem.style.top = xy.top + "px";
    } else if (props.position == 'bottom-left') {
      vp['left'] += ecma.util.asInt(ecma.dom.getStyle(elem, 'padding-left'));
      vp['top'] -= ecma.util.asInt(ecma.dom.getStyle(elem, 'padding-bottom'));
      elem.style.left = vp['left'] + 'px';
      elem.style.top = (vp['top'] + vp['height'] - ecma.dom.getHeight(elem)) + 'px';
    } else if (props.position == 'bottom-right') {
      elem.style.right = '0px';
      elem.style.bottom = '0px';
    }
    /* Restore original values */
    elem.style.visibility = attrVisibility;
    elem.style.display = attrDisplay;
  };

  /**
   * @function getElementPosition
   * Pixel coordinates and dimensions of the element
   * returns: Object w/members: left, top, width, height
   */

  this.getElementPosition = function (elem) {
    elem = ecma.dom.getElement(elem);
    return {
      'left':   ecma.dom.getLeft(elem),
      'top':    ecma.dom.getTop(elem),
      'width':  ecma.dom.getWidth(elem),
      'height': ecma.dom.getHeight(elem)
    };
  };

  /**
   * @function getInnerPosition
   */

  this.getInnerPosition = function (elem) {
    return {
      'top':    ecma.dom.getInnerTop(elem),
      'left':   ecma.dom.getInnerLeft(elem),
      'right':  ecma.dom.getInnerRight(elem),
      'bottom': ecma.dom.getInnerBottom(elem),
      'width':  ecma.dom.getInnerWidth(elem),
      'height': ecma.dom.getInnerHeight(elem)
    };
  };

  /**
   * @function getTop
   * https://developer.mozilla.org/En/Determining_the_dimensions_of_elements
   * http://msdn.microsoft.com/en-us/library/ms530302(VS.85).aspx
   *
   *  elem.getBBox          # svg x,y and width,height
   *
   *  elem.scrollHeight     # height of actual content
   *  elem.clientHeight     # height of visible content
   *  elem.offsetHeight     # height of element
   *
   *  elem.scrollWidth      # width of actual content (except IE)
   *  elem.clientWidth      # width of visible content
   *  elem.offsetWidth      # width of element
   */

  this.getTop = function (elem)    {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().y : elem.offsetTop;
    result += ecma.dom.getTop(elem.offsetParent);
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getBottom
   */

  this.getBottom = function (elem) {
    return ecma.dom.getTop(elem) + ecma.dom.getHeight(elem);
  };

  /**
   * @function getLeft
   */

  this.getLeft = function (elem)   {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().x : elem.offsetLeft;
    result += ecma.dom.getLeft(elem.offsetParent);
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getRight
   */

  this.getRight = function (elem)  {
    return ecma.dom.getLeft(elem) + ecma.dom.getWidth(elem);
  };

  /**
   * @function getWidth
   */

  this.getWidth = function (elem)  {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().width : elem.offsetWidth;
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getHeight
   */

  this.getHeight = function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().height : elem.offsetHeight;
    return isNaN(result) ? 0 : result;
  };

  /* Inner */

  /**
   * @function getInnerTop
   */

  this.getInnerTop = function (elem)    {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().y : elem.offsetTop + elem.clientTop;
    result += ecma.dom.getInnerTop(elem.offsetParent);
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getInnerBottom
   */

  this.getInnerBottom = function (elem) {
    return ecma.dom.getInnerTop(elem) + ecma.dom.getInnerHeight(elem);
  };

  /**
   * @function getInnerLeft
   */

  this.getInnerLeft = function (elem)   {
    elem = ecma.dom.getElement(elem);
    if (!elem) return 0;
    var result = elem.getBBox ? elem.getBBox().x : elem.offsetLeft + elem.clientLeft;
    result += ecma.dom.getInnerLeft(elem.offsetParent);
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getInnerRight
   */

  this.getInnerRight = function (elem)  {
    return ecma.dom.getInnerLeft(elem) + ecma.dom.getInnerWidth(elem);
  };

  /**
   * @function getInnerWidth
   */

  this.getInnerWidth = function (elem)  {
    elem = ecma.dom.getElement(elem);
    if (!elem || ecma.dom.node.isText(elem)) return 0;
    var result = elem.getBBox
      ? elem.getBBox().width
        : elem.clientWidth;
    if (!result) result = elem.offsetWidth - elem.clientLeft;
    return isNaN(result) ? 0 : result;
  };

  /**
   * @function getInnerHeight
   */

  this.getInnerHeight = function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!elem || ecma.dom.node.isText(elem)) return 0;
    var result = elem.getBBox ? elem.getBBox().height : elem.clientHeight;
    if (!result) result = elem.offsetHeight - elem.clientTop;
    return isNaN(result) ? 0 : result;
  };

  /** Content */

  /**
   * @function getContentWidth
   */

  function _getContentWidth (elem, result) {
    while (elem) {
      result = Math.max(result, ecma.dom.getWidth(elem));
      var overflow = ecma.dom.getStyle(elem, 'overflowY');
      if ((!overflow || overflow == 'visible') && elem.hasChildNodes()) {
        result = _getContentWidth(elem.firstChild, result);
      }
      elem = elem.nextSibling;
    }
    return result;
  }

  this.getContentWidth = function (elem)  {
    elem = ecma.dom.getElement(elem);
//  return _getContentWidth(elem.firstChild, ecma.dom.getWidth(elem));
    return _getContentWidth(elem.firstChild, 0);
  };

  /**
   * @function getContentHeight
   */

  function _getContentHeight (elem, result) {
    while (elem) {
      result = Math.max(result, ecma.dom.getHeight(elem));
      var overflow = ecma.dom.getStyle(elem, 'overflowX');
      if ((!overflow || overflow == 'visible') && elem.hasChildNodes()) {
        result = _getContentHeight(elem.firstChild, result);
      }
      elem = elem.nextSibling;
    }
    return result;
  }

  this.getContentHeight = function (elem)  {
    elem = ecma.dom.getElement(elem);
//  return _getContentHeight(elem.firstChild, ecma.dom.getHeight(elem));
    return _getContentHeight(elem.firstChild, 0);
  };

  /**
   * @idea getOuterWidth
   * @idea getOuterHeight
   *
   * Or maybe getBBox, basically returns width x height of the bounding
   * box. In some instances the ua does not include the border width,
   * which is often desired. Since margins overlap, doesn't make sense
   * to include them.
   */

  /**
   * @function getValues
   * Get name/value pairs from descendants.
   *  var obj = ecma.dom.getValues(element);
   *  var obj = ecma.dom.getValues(element, ['input','textarea']);
   */

  this.getValues = function (elem, tagNames) {
    elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var result = {};
    if (!tagNames) tagNames = ['input','textarea','select']; 
    for (var i = 0, tagName; tagName = tagNames[i]; i++) {
      var nodeList = elem.getElementsByTagName(tagName);
      for (var j = 0, node; node = nodeList[j]; j++) {
        var name = ecma.dom.getAttribute(node, 'name');
        if (!name) continue;
        var value = ecma.dom.getValue(node);
        if (ecma.util.defined(result[name])) {
          var attrName = node.tagName;
          var attrType = ecma.dom.getAttribute(node, 'type') || '';
          if (attrName.toUpperCase() == 'INPUT' && attrType.toUpperCase() == 'RADIO') {
            if (result[name] && !value) continue;
            result[name] = value;
          } else {
            if (!ecma.util.defined(value)) continue;
            if (ecma.util.isArray(result[name])) {
              result[name].push(value);
            } else {
              result[name] = [result[name], value];
            }
          }
        } else {
          result[name] = value;
        }
      }
    }
    return result;
  };

  /**
   * @function getValue
   * Get the logical value according to element type.
   *  @param elem <ID or Element> from which to get the value
   */

  this.getValue = function (elem) {
    function resolveValue (value) {
      if (value.match(/^&:/)) {
        return ecma.dom.getValue(value.replace(/^&:/, ''));
      }
      return value;
    }
    var elem = ecma.dom.getElement(elem);
    if (!elem) return;
    var value = undefined;
    switch (elem.tagName.toUpperCase()) {
      case 'INPUT':
        switch (elem.type.toUpperCase()) {
          case 'HIDDEN':
            value = resolveValue(elem.value);
            break;
          case 'CHECKBOX':
            value = elem.checked
              ? ecma.util.defined(elem.value)
                ? resolveValue(elem.value)
                : true
              : undefined;
            break;
          case 'RADIO':
            if (elem.checked) {
              value = ecma.util.defined(elem.value) ? resolveValue(elem.value) : true;
            } else {
              value = undefined;
            }
            break;
          case 'SUBMIT':
          case 'PASSWORD':
          case 'TEXT':
          case 'FILE':
            value = elem.value;
            break;
          default:
            throw new Error('Unhandled input type: '+elem.type);
        }
        break;
      case 'BUTTON':
        value = ecma.dom.getAttribute(elem, 'value');
        break;
      case 'TEXTAREA':
      case 'SELECT':
        value = elem.value;
        break;
      default:
        if (ecma.util.defined(elem.innerHTML)) {
          value = elem.innerHTML;
        } else {
          throw new Error('Unhandled tag: '+elem.tagName);
        }
    }
    return value;
  };

  /**
   * @function setValue
   * Sets the value for the given element.
   *
   *  var value = ecma.dom.setValue(elem, value);
   *
   * Where:
   *
   *  elem    <Element>     Identifier or reference
   *  value   <String>      New value
   *
   * When C<elem.tagName> is ___, the property we set is ___:
   *
   *  INPUT['hidden']       value
   *  INPUT['password']     value
   *  INPUT['text']         value
   *  INPUT['radio']        value || checked L<1>
   *  INPUT['checkbox']     value || checked L<1>
   *  SELECT                value
   *  TEXTAREA              value
   *  PRE                   innerHTML L<2>
   *  *                     innerHTML or innerText or <Excpetion> L<3>
   *
   * N<1> When setting radio and checkbox input fields: if the value is a 
   * boolean or the string 'on' or 'off', we will set the checked property; 
   * otherwise the value is set.
   *
   * N<2> Internet Explorer workaround: When setting the C<innerHTML> member of 
   * a PRE element we create a temporary (DIV) container, set its innerHTML 
   * member, then replace the PRE's children with these newborns.
   *
   * N<3> If C<elem.innerHTML> is defined it is set, otherwise if
   * C<elem.innerText> is defined, it is set.  Otherwise an unhandled tag 
   * exception is thrown.
   */

  this.setValue = function (elem, value) {
    var elem = ecma.dom.getElement(elem);
    if (!elem) return;
    switch (elem.tagName.toUpperCase()) {
      case 'INPUT':
        switch (elem.type.toUpperCase()) {
          case 'HIDDEN':
          case 'PASSWORD':
          case 'TEXT':
            elem.value = value;
            break;
          case 'CHECKBOX':
          case 'RADIO':
            var checked = elem.checked;
            if (typeof(value) == 'boolean') {
              checked = value;
            } else {
              if (value == 'on') {
                checked = true;
              } else if (value == 'off') {
                checked = false;
              } else {
                elem.value = value;
              }
            }
            elem.checked = checked;
            break;
          default:
            throw new Error('Unhandled input type: '+elem.type);
        }
        break;
      case 'TEXTAREA':
      case 'SELECT':
        elem.value = value;
        break;
      case 'PRE':
        if (ecma.dom.browser.isIE) {
          // Workaround as the IE innerHTML parser ignores the excess whitespace.
          var div = ecma.dom.createElement('div', {innerHTML:'<pre>'+value+'</pre>'});
          ecma.dom.replaceChildren(elem, div.childNodes);
        } else {
          ecma.dom.setAttribute(elem, 'innerHTML', value);
        }
        break;
      default:
        if (ecma.util.defined(elem.innerHTML)) {
          ecma.dom.setAttribute(elem, 'innerHTML', value);
        } else if (ecma.util.defined(elem.innerText)) {
          ecma.dom.setAttribute(elem, 'innerText', value);
        } else {
          throw new Error('Unhandled tag: '+elem.tagName);
        }
    }
    return value;
  };

  /**
   * @function clearSelection
   * Clear the user selection (e.g., highlighted text)
   */

  this.clearSelection = function() {
    if (ecma.document.selection && ecma.document.selection.empty) {
      ecma.document.selection.empty();
    } else if (window.getSelection) {
      var sel = window.getSelection();
      sel.removeAllRanges();
    }
  };

  /**
   * @function toggleDisplay
   */

  this.toggleDisplay = function (elem, blockStyle, bShow) {
    if (!blockStyle) blockStyle = 'block';
    var currentValue = ecma.dom.getStyle(elem, 'display');
    if (!ecma.util.defined(bShow)) {
      bShow = currentValue == 'none';
    }
    if (!bShow) {
      ecma.dom.setStyle(elem, 'display', 'none');
      return false;
    } else {
      ecma.dom.setStyle(elem, 'display', blockStyle);
      return true;
    }
  };

  /**
   * @function getScrollableParent
   */

  this.getScrollableParent = function (elem) {
    if (!elem) return undefined;
    var result = null;
    var node = elem.parentNode;
    var body = ecma.dom.getBody();
    while (!result && node) {
      var overflow = ecma.dom.getStyle(node, 'overflow');
      if (overflow && overflow.match(/auto|scroll/i)) {
        result = node;
      } else {
        node = node === body ? null : node.parentNode;
      }
    }
    return result;
  };

  /**
   * @function scrollTo
   * Scroll to the specified element
   *
   *  @param elem <Element> Scroll to the top of this element
   *  @param se <Element> (Optional) The scrollable element to be scrolled
   *
   *  // The scrollable element will be searched for. If there are no scrolable
   *  // parents, this is a no-op.
   *  ecma.dom.scrollTo(elem);
   *
   *  // The provided scrollable element will be scrolled
   *  ecma.dom.scrollTo(elem, scrollableElement);
   *
   */

  this.scrollTo = function (elem, se) {
    if (!se) {
      se = this.getScrollableParent(elem); // scroll elem
      if (!se) return;
    }
    var sh = ecma.dom.getHeight(se); // scroll height
    var st = se.scrollTop; // scroll top
    var te = elem; //  target elem
    var tt = ecma.dom.getTop(te) - ecma.dom.getTop(se); // target top
    var tb = ecma.dom.getBottom(te) - ecma.dom.getTop(se); // target bottom
    if ((tb > (st + sh)) || (tt < st)) {
      se.scrollTop = ecma.util.asInt(tt - (sh/2));
    }
  };

});

/** @namespace util */

ECMAScript.Extend('util', function (ecma) {

  /**
   * @function asHyphenatedName
   * Convert a camel-cased name to hypenated.
   *  @param name to convert
   */

  this.asHyphenatedName = function (name) {
    function upperToHyphenLower(match) { return '-' + match.toLowerCase(); }
    return name.replace(/[A-Z]/g, upperToHyphenLower);
  };

  /** 
   * @function asCamelCaseName
   * Convert the hyphenated name to camel-cased.
   *  @param name to convert
   */

  this.asCamelCaseName = function (name) {
    function ucFirstMatch(str, p1, offest, s) { return p1.toUpperCase(); }
    return name.replace(/-([a-z])/g, ucFirstMatch);
  };

});

/**
 * @namespace dom.constants
 * Constant values.
 * See also: L<http://www.w3.org/TR/DOM-Level-3-Core/core.html>
 */

ECMAScript.Extend('dom.constants', function (ecma) {

  /**
   * @member ELEMENT_NODE
   * @member ATTRIBUTE_NODE
   * @member TEXT_NODE
   * @member CDATA_SECTION_NODE
   * @member ENTITY_REFERENCE_NODE
   * @member ENTITY_NODE
   * @member PROCESSING_INSTRUCTION_NODE
   * @member COMMENT_NODE
   * @member DOCUMENT_NODE
   * @member DOCUMENT_TYPE_NODE
   * @member DOCUMENT_FRAGMENT_NODE
   * @member NOTATION_NODE
   */

  this.ELEMENT_NODE                   = 1;
  this.ATTRIBUTE_NODE                 = 2;
  this.TEXT_NODE                      = 3;
  this.CDATA_SECTION_NODE             = 4;
  this.ENTITY_REFERENCE_NODE          = 5;
  this.ENTITY_NODE                    = 6;
  this.PROCESSING_INSTRUCTION_NODE    = 7;
  this.COMMENT_NODE                   = 8;
  this.DOCUMENT_NODE                  = 9;
  this.DOCUMENT_TYPE_NODE             = 10;
  this.DOCUMENT_FRAGMENT_NODE         = 11;
  this.NOTATION_NODE                  = 12;

});

/**
 * @namespace dom.node
 * Utility functions which compare the C<nodeType> attribute.
 */

ECMAScript.Extend('dom.node', function (ecma) {

  /**
   * @function isElement
   * Returns true if it is.
   *  var bool = ecma.dom.node.isElement(elem);
   */

  this.isElement = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.ELEMENT_NODE &&
      node.tagName != '!';
  };

  /**
   * @function isAttribute
   * Returns true if it is.
   *  var bool = ecma.dom.node.isAttribute(elem);
   */

  this.isAttribute = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.ATTRIBUTE_NODE;
  };

  /**
   * @function isText
   * Returns true if it is.
   *  var bool = ecma.dom.node.isText(elem);
   */

  this.isText = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.TEXT_NODE;
  };

  /**
   * @function isCdataSection
   * Returns true if it is.
   *  var bool = ecma.dom.node.isCdataSection(elem);
   */

  this.isCdataSection = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.CDATA_SECTION_NODE;
  };

  /**
   * @function isEntityReference
   * Returns true if it is.
   *  var bool = ecma.dom.node.isEntityReference(elem);
   */

  this.isEntityReference = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.ENTITY_REFERENCE_NODE;
  };

  /**
   * @function isEntity
   * Returns true if it is.
   *  var bool = ecma.dom.node.isEntity(elem);
   */

  this.isEntity = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.ENTITY_NODE;
  };

  /**
   * @function isProcessingInstruction
   * Returns true if it is.
   *  var bool = ecma.dom.node.isProcessingInstruction(elem);
   */

  this.isProcessingInstruction = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.PROCESSING_INSTRUCTION_NODE;
  };

  /**
   * @function isComment
   * Returns true if it is.
   *  var bool = ecma.dom.node.isComment(elem);
   */

  this.isComment = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.COMMENT_NODE;
  };

  /**
   * @function isDocument
   * Returns true if it is.
   *  var bool = ecma.dom.node.isDocument(elem);
   */

  this.isDocument = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.DOCUMENT_NODE;
  };

  /**
   * @function isDocumentType
   * Returns true if it is.
   *  var bool = ecma.dom.node.isDocumentType(elem);
   */

  this.isDocumentType = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.DOCUMENT_TYPE_NODE;
  };

  /**
   * @function isDocumentFragment
   * Returns true if it is.
   *  var bool = ecma.dom.node.isDocumentFragment(elem);
   */

  this.isDocumentFragment = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.DOCUMENT_FRAGMENT_NODE;
  };

  /**
   * @function isNotation
   * Returns true if it is.
   *  var bool = ecma.dom.node.isNotation(elem);
   */

  this.isNotation = function (node) {
    node = ecma.dom.getElement(node);
    return node && node.nodeType &&
      node.nodeType == ecma.dom.constants.NOTATION_NODE;
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @instance dispatcher <ecma.action.ActionDispatcher>
   */

  this.dispatcher = new ecma.action.ActionDispatcher();

  /**
   * @function addActionListener
   * @function removeActionListener
   * @function executeClassAction
   * @function executeAction
   * @function dispatchAction
   * @function dispatchClassAction
   */

  var proxyFunctions = [
    'addActionListener',
    'removeActionListener',
    'executeAction',
    'executeClassAction',
    'dispatchAction',
    'dispatchClassAction'
  ];

  ecma.lang.createProxyFunction(proxyFunctions, this, this.dispatcher);

});

/**
 * @namespace dom
 */

ECMAScript.Extend('dom', function (ecma) {

  /**
   * @function getXPath
   */

  this.getXPath = function (elem) {
    elem = ecma.dom.getElement(elem);
    var result = [''];
    while (elem && ecma.dom.node.isElement(elem)) {
      var i = ecma.dom.getChildIndex(elem);
      var name = elem.tagName.toLowerCase();
      if (i > 0) name += '[' + (i + 1) + ']';
      result.unshift(name);
      elem = elem.parentNode;
    }
    return result.join('/');
  }

  /**
   * @function getChildIndex
   */

  this.getChildIndex = function (elem) {
    var result = 0;
    for (var node = elem.previousSibling; node; node = node.previousSibling) {
      if (ecma.dom.node.isElement(node) && (node.tagName == elem.tagName)) {
        result++;
      }
    }
    return result;
  }

});

/** @namespace console */
ECMAScript.Extend('console', function (ecma) {

  function _initBrowserConsole () {
    try {
      if (ecma.dom.browser.isOpera) {
        ecma.console.tee(new ecma.console.Opera());
        ecma.console.flush();
        return;
      }
      var win = ecma.window;
      while (win) {
        if (win.console) {
          ecma.console.tee(win.console);
          ecma.console.flush();
          break;
        }
        if (win.parent === win) break;
        win = win.parent;
      }
    } catch (ex) {
      // No-op
    }
  }

  /**
   * Attach to the window's console object.
   */
  _initBrowserConsole();

  /**
   * @class Opera
   */

  this.Opera = function () {};

  this.Opera.prototype.log = function () {
    if (!arguments.length) return;
    var args = ecma.util.args(arguments);
    ecma.window.opera.postError(args.join(' '));
  };

});

ECMAScript.Extend('dom.include', function (ecma) {

  /**
   * @namespace dom.include
   * This structure groups functions which incorporate CSS and JS into the 
   * current document.
   */

  var _package = this;
  var _loaded = {};
  var _onLoadCallbacks = {};

  function _getHead () {
    var heads = ecma.document.getElementsByTagName('head');
    if (!(heads && heads[0])) {
      var doc = ecma.dom.getRootElement();
      var head = ecma.dom.createElement('head');
      doc.appendChild(head);
      return head;
    }
    return heads[0];
  }

  function _setLoaded (event, id) {
    var target = ecma.dom.getEventTarget(event);
    if (ecma.dom.browser.isIE && !target.readyState.match(/complete|loaded/)) {
      return;
    }
    _loaded[id] = true;
    while (_onLoadCallbacks[id].length) {
      var cb = _onLoadCallbacks[id].shift();
      ecma.lang.callback(cb, ecma.window, [target]);
    }
  }

  /**
   * @function hasLoaded
   * Query the loaded status by script-element id.
   *  var bool = ecma.dom.hasLoaded(id);
   */

  this.hasLoaded = function (id) {
    return id && (id in _loaded ? _loaded[id] : false);
  };

  /**
   * @function script
   * Append a SCRIPT element to the document's HEAD.  If the element already
   * exists this is a no-op and the C<onLoad> callback will be immediately
   * applied.
   *
   *  var elem = ecma.dom.include.script(attrs);
   *  var elem = ecma.dom.include.script(attrs, onLoad);
   *
   * The C<attrs> object must contain either one of these two members:
   *
   *  attrs.text  Script source code
   *  attrs.src   URI of the script resource
   *
   * The element attributes C<attrs> are passed to L<ecma.dom.createElement>.
   * The following attributes will be used if provided, otherwise set:
   *
   *  attrs.id    Element id (default is randomly generated)
   *  attrs.type  Script type (default: 'text/javascript')
   *
   * The C<onLoad> callback, if provided, will be executed after the script is 
   * loaded.
   *
   * If you want
   */

  this.script = function (attrs, cb) {
    var head = _getHead();
    if (attrs.id && !attrs.text) {
      var elem = ecma.dom.selectElement('SCRIPT#' + attrs.id, head);
      if (elem) {
        if (cb) {
          if (attrs.id in _loaded) {
            if (_loaded[attrs.id]) {
              ecma.lang.callback(cb, ecma.window, [elem]);
            } else {
              _onLoadCallbacks[attrs.id].push(cb);
            }
          }
        }
        return elem;
      }
    }
    if (!attrs.type) attrs.type = 'text/javascript';
    if (!attrs.id) attrs.id = ecma.util.randomId('script');
    var elem = ecma.dom.createElement('script', attrs);
    if (attrs.text) {
      head.appendChild(elem);
      _loaded[attrs.id] = true;
      if (cb) ecma.lang.callback(cb, ecma.window, [elem]);
    } else {
      _loaded[attrs.id] = false;
      var cbList = _onLoadCallbacks[attrs.id];
      if (!cbList) {
        cbList = _onLoadCallbacks[attrs.id] = [];
      }
      if (cb) cbList.push(cb);
      var onLoad = ecma.lang.createCallback(
        _setLoaded, this, [attrs.id]
      );
      if (ecma.dom.browser.isIE) {
        ecma.dom.addEventListener(elem, 'readystatechange', onLoad);
      } else {
        ecma.dom.addEventListener(elem, 'load', onLoad);
      }
      head.appendChild(elem);
    }
    return elem;
  };

  /**
   * @function scripts
   * Same as L<script>, however takes an array of C<attrs>. The callback is
   * executed after all scripts have loaded.
   * @param attrList <Array> See L<script>
   * @param cb <Callback> Executed after scripts load
   * @return elems <Array> DOM script elements
   */

  this.scripts = function (attrList, cb) {
    var result = [];
    var captured = 0;
    function captureLoaded (elem, attrs) {
      if (++captured == attrList.length && cb) {
        ecma.lang.callback(cb, ecma.window, [result]);
      }
    }
    for (var i = 0; i < attrList.length; i++) {
      result.push(_package.script(attrList[i], [captureLoaded]));
    }
    return result;
  };

  /**
   * @function style
   * Append a LINK or STYLE element to the document's HEAD.
   *
   *  var elem = ecma.dom.include.style(attrs);
   *
   * The C<attrs> object must contain either one of these two members:
   *
   *  attrs.text  CSS source code
   *  attrs.href  URI of the stylesheet
   *
   * The element attributes C<attrs> are passed to L<ecma.dom.createElement>.
   * The following attributes will be used if provided, otherwise set:
   *
   *  attrs.id    Element id (default is randomly generated)
   *  attrs.type  Style type (default: 'text/css')
   *  attrs.rel   When C<attrs.href> is provided (default: 'text/css')
   *
   * The element attributes
   * @param attrs Element attributes
   */

  this.style = function (attrs) {
    var elem = attrs.id ? ecma.dom.getElement(attrs.id) : undefined;
    if (elem) return elem;
    if (!attrs.id) attrs.id = ecma.util.randomId('css');
    if (!attrs.type) attrs.type = 'text/css';
    var head = _getHead();
    if (attrs.href) {
      if (!attrs.rel) attrs.rel = 'stylesheet';
      elem = ecma.dom.createElement('link', attrs);
    } else {
      var text = attrs.text;
      delete attrs.text;
      elem = ecma.dom.createElement('style', attrs);
      if (ecma.dom.browser.isIE) {
        elem.styleSheet.cssText = text;
      } else {
        elem.appendChild(ecma.document.createTextNode(text));
      }
    }
    head.appendChild(elem);
    return elem;
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @class Canvas
   */

  this.Canvas = function () {
    this.doc = ecma.document.documentElement || ecma.document;
    this.body = ecma.dom.getBody();
    this.root = ecma.document.rootElement || this.body.parentNode;
  };

  var _proto = this.Canvas.prototype = ecma.lang.createPrototype();

  _proto.getPosition = function () {
    return {
      'left': this.getLeft(),
      'top': this.getTop(),
      'width': this.getWidth(),
      'height': this.getHeight()
    };
  };

  // When the page overflows in only one direction, the opposing scrollbar
  // must be accounted for.
  // HTML width/height must be 100% (which is done in the this.show())
  // Minimum h/w is that of the window
  // The 1px bug in IE in BackCompat mode is not accounted for

  _proto.getWidth = function () {
    var winX = this.windowX();
    var pgX = this.pageX();
    var w = winX < pgX ? pgX : winX;
    // Account for vertical scrollbar
    var sbX = 0;
    var rootX = ecma.dom.getWidth(this.root);
    if (rootX == pgX) {
      if (ecma.document.compatMode == 'BackCompat') {
        sbX = Math.abs(winX - rootX);
      } else if (ecma.document.compatMode == 'CSS1Compat') {
        sbX = ecma.dom.browser.isIE ? 0 : Math.abs(winX - rootX);
      }
    }
//  ecma.console.log('sbX='+sbX);
    return w - sbX;
  };

  _proto.getHeight = function () {
    // Account for horizontal scrollbar
    var winY = this.windowY();
    var pgY = this.pageY();
    var h = winY < pgY ? pgY : winY;
    var sbY = 0;
    var rootY = ecma.dom.getHeight(this.root);
    if (rootY == pgY) {
      if (ecma.document.compatMode == 'BackCompat') {
        sbY = Math.abs(winY - rootY);
      } else if (ecma.document.compatMode == 'CSS1Compat') {
        sbY = ecma.dom.browser.isIE ? 0 : Math.abs(winY - rootY);
      }
    }
//  ecma.console.log('sbY='+sbY);
    return h - sbY;
  };

  _proto.getRawWidth = function () {
    return this.getDimension('Width');
  };

  _proto.getRawHeight = function () {
    return this.getDimension('Height');
  };

  _proto.getDimension = function  (name) {
    return Math.max(
      this.doc["client" + name],
      this.body["scroll" + name], this.doc["scroll" + name],
      this.body["offset" + name], this.doc["offset" + name]
    );
  };

  /** @function windowX */
  _proto.windowX = function() {
    return ecma.window.innerWidth
      || this.doc.clientWidth
      || this.body.clientWidth
      || this.doc.offsetWidth;
  };

  /** @function windowY */
  _proto.windowY = function() {
    return ecma.window.innerHeight
      || this.doc.clientHeight
      || this.body.clientHeight
      || this.doc.offsetHeight;
  };

  /** @function getLeft */
  /** @function scrollX */
  _proto.getLeft = 
  _proto.scrollX = function() {
    return this.doc.scrollLeft || ecma.window.pageXOffset || this.body.scrollLeft;
  };

  /** @function getTop */
  /** @function scrollY */
  _proto.getTop = 
  _proto.scrollY = function() {
    return this.doc.scrollTop || ecma.window.pageYOffset || this.body.scrollTop;
  };

  /** @function pageX */
  _proto.pageX = function() {
    return Math.max(
      this.doc.scrollWidth,
      this.body.scrollWidth,
      this.body.offsetWidth
    );
  };

  /** @function pageY */
  _proto.pageY = function() {
    return Math.max(
      this.doc.scrollHeight,
      this.body.scrollHeight,
      this.body.offsetHeight
    );
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  var _canvas = undefined;

  /**
   * @function getCanvasPosition
   */

  this.getCanvasPosition = function () {
    if (!_canvas) _canvas = new ecma.dom.Canvas();
    return _canvas.getPosition();
  };

});

/** @namespace dom */

ECMAScript.Extend('dom', function (ecma) {

  _package = this;
  CDispatcher = ecma.action.ActionDispatcher;

  var proto = ecma.lang.createPrototype(CDispatcher);

  function Content () {
    CDispatcher.apply(this, arguments);
    this.hasLoaded = false;
  };

  Content.prototype = proto;

  /**
   * @instance content
   */

  _package.content = new Content(); // ecma.dom.content

});

/** @namespace dom */

ECMAScript.Extend('dom', function (ecma) {

  /*
   *
   * ContentLoaded.js
   *
   * Author: Diego Perini (diego.perini at gmail.com)
   * Summary: Cross-browser wrapper for DOMContentLoaded
   * Updated: 17/05/2008
   * License: MIT
   * Version: 1.1
   *
   * URL:
   * http://javascript.nwbox.com/ContentLoaded/
   * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
   *
   * Notes:
   * based on code by Dean Edwards and John Resig
   * http://dean.edwards.name/weblog/2006/06/again/
   *
   */

  // @w	window reference
  // @f	function reference
  function ContentLoaded(w, f) {

    var	d = w.document,
      D = 'DOMContentLoaded',
      // user agent, version
      u = w.navigator.userAgent.toLowerCase(),
      v = parseFloat(u.match(/.+(?:rv|it|ml|ra|ie)[\/: ]([\d.]+)/)[1]);

    function init(e) {
      if (!document.loaded) {
        document.loaded = true;
        // pass a fake event if needed
        f((e.type && e.type == D) ? e : {
          type: D,
          target: d,
          eventPhase: 0,
          currentTarget: d,
          timeStamp: +new Date,
          eventType: e.type || e
        });
      }
    }

    // safari < 525.13
    if (/webkit\//.test(u) && v < 525.13) {

      (function () {
        if (/complete|loaded/.test(d.readyState)) {
          init('khtml-poll');
        } else {
          setTimeout(arguments.callee, 10);
        }
      })();

    // internet explorer all versions
    } else if (/msie/.test(u) && !w.opera) {

      d.attachEvent('onreadystatechange',
        function (e) {
          if (d.readyState == 'complete') {
            d.detachEvent('on'+e.type, arguments.callee);
            init(e);
          }
        }
      );
      if (w == top) {
        (function () {
          try {
            d.documentElement.doScroll('left');
          } catch (e) {
            setTimeout(arguments.callee, 10);
            return;
          }
          init('msie-poll');
        })();
      }

    // browsers having native DOMContentLoaded
    } else if (d.addEventListener &&
      (/opera\//.test(u) && v > 9) ||
      (/gecko\//.test(u) && v >= 1.8) ||
      (/khtml\//.test(u) && v >= 4.0) ||
      (/webkit\//.test(u) && v >= 525.13)) {

      d.addEventListener(D,
        function (e) {
          d.removeEventListener(D, arguments.callee, false);
          init(e);
        }, false
      );

    // fallback to last resort for older browsers
    } else {

      // from Simon Willison
      var oldonload = w.onload;
      w.onload = function (e) {
        init(e || w.event);
        if (typeof oldonload == 'function') {
          oldonload(e || w.event);
        }
      };

    }
  }
  /** End of ContentLoaded.js by Diego Perini */

  ContentLoaded(ecma.window, function (event) {

    ecma.dom.content.dispatchAction('load', event);
    ecma.dom.content.hasLoaded = true;

  });

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * References:
   *  http://unixpapa.com/js/key.html
   */

  var _lowerNames = [];
  _lowerNames[8] = 'backspace';
  _lowerNames[9] = 'tab';
  _lowerNames[13] = 'enter';
  _lowerNames[16] = 'shift';
  _lowerNames[17] = 'ctrl';
  _lowerNames[18] = 'alt';
  _lowerNames[19] = 'pause';
  _lowerNames[20] = 'capslock';
  _lowerNames[27] = 'esc';
  _lowerNames[144] = 'numlock';
  _lowerNames[145] = 'scrlock';

  var _modifierNames = [];
  _modifierNames[16] = 'shift';
  _modifierNames[17] = 'ctrl';
  _modifierNames[18] = 'alt';
  _modifierNames[20] = 'capslock';
  _modifierNames[144] = 'numlock';
  _modifierNames[145] = 'scrlock';

  var _commandNames = [];
  _commandNames[33] = 'pageup';
  _commandNames[34] = 'pagedown';
  _commandNames[35] = 'end';
  _commandNames[36] = 'home';
  _commandNames[37] = 'left';
  _commandNames[38] = 'up';
  _commandNames[39] = 'right';
  _commandNames[40] = 'down';
  _commandNames[45] = 'insert';
  _commandNames[46] = 'delete';

  var _functionNames = [];
  _functionNames[112] = 'f1';
  _functionNames[113] = 'f2';
  _functionNames[114] = 'f3';
  _functionNames[115] = 'f4';
  _functionNames[116] = 'f5';
  _functionNames[117] = 'f6';
  _functionNames[118] = 'f7';
  _functionNames[119] = 'f8';
  _functionNames[120] = 'f9';
  _functionNames[121] = 'f10';
  _functionNames[122] = 'f11';
  _functionNames[123] = 'f12';

  var _symbolNames = [];
  if (ecma.dom.browser.isIE || ecma.dom.browser.isWebKit) {
    _symbolNames[186] = ';';
    _symbolNames[187] = '=';
    _symbolNames[189] = '-';
  }
  if (ecma.dom.browser.isGecko || ecma.dom.browser.isOpera) {
    _symbolNames[109] = '-';
  }
  _symbolNames[188] = ',';
  _symbolNames[190] = '.';
  _symbolNames[191] = '/';
  _symbolNames[192] = '`';
  _symbolNames[219] = '[';
  _symbolNames[220] = '\\';
  _symbolNames[221] = ']';
  _symbolNames[222] = '\'';

  var CAction = ecma.action.ActionDispatcher;

  /**
   * @class KeyPress
   */

  this.KeyPress = function () {
    CAction.apply(this);
    this.handlers = {};
    this.events = [];
    this.queue = [];
    return this;
  };

  var KeyPress = this.KeyPress.prototype = ecma.lang.createPrototype(
    CAction
  );

  KeyPress.setHandler =
  KeyPress.addHandler = function () {
    var args = ecma.util.args(arguments);
    var name = args.shift();
    var cbList = this.handlers[name];
    if (!cbList) cbList = this.handlers[name] = [];
    cbList.push(args);
  };

  KeyPress.getHandlers = function (seq) {
    return this.handlers[seq.ascii];
  };

  KeyPress.attach = function (elem) {
    this.events = this.events.concat([
      new ecma.dom.EventListener(elem, 'keydown', this.onKeyDown, this),
      new ecma.dom.EventListener(elem, 'keypress', this.onKeyPress, this),
      new ecma.dom.EventListener(elem, 'keyup', this.onKeyUp, this)
    ]);
    return this;
  };

  KeyPress.detach = function (elem) {
    elem = ecma.dom.getElement(elem);
    for (var i = 0, evt; evt = this.events[i]; i++) {
      if (evt.target !== elem) continue;
      evt.remove();
      this.events.splice(i--, 1);
    }
    return this;
  };

  KeyPress.pumpEvent = function (event, chrSeq) {
    var cmdSeq = this.queue.shift();
    if (!cmdSeq) return; // An event must be registered (onkeydown)
    var seq = chrSeq && chrSeq.isCharacter ? chrSeq : cmdSeq;
    this.doEvent(event, seq);
  };

  KeyPress.doEvent = function (event, seq) {
    ecma.lang.assert(seq);
    if (seq.isModifier && !seq.downUp) return;
    ////this.trace(seq);
    // Handlers, which may stop the event and do not get called if the event 
    // has been stopped.
    var cbList = this.getHandlers(seq);
    if (cbList) {
      event.seq = seq;
      ecma.util.step(cbList, function (cb, event) {
        if (!event || event.stopped) return;
        ecma.lang.callback(cb, null, [event]);
      }, this, [event]);
    }
    this.dispatchAction('keypress', seq, event);
    this.lastSeq = seq; // hold for potential repeatEvent
  };

  KeyPress.repeatEvent = function (event) {
    ////ecma.console.log('repeat-event');
    if (this.lastSeq) this.doEvent(event, this.lastSeq);
  };

  KeyPress.onKeyDown = function (event) {
    this.state = 1;
    this.pumpEvent(event);
    var seq = this.getCommandSequence(event);
    ////this.trace(seq);
    if (seq.isResolved && !seq.isModifier) {
      // tab and shift+tab must be invoked now as chrome/safari/ie won't
      // ever supply a corresponding press|up event when the control
      // loses focus.
      //
      // webkit invokes the default action on keydown (like enter, arrows,
      // ctrl+b, etc).
      this.doEvent(event, seq);
    } else {
      // Add to the event queue, will be executed on keypress/keyup
      this.queue.push(seq);
    }
  };

  KeyPress.onKeyPress = function (event) {
    if (this.state == 2) {
      // Repeat on FF under Linux.  FF under Win32 will issue a keydown
      // event for repeats.
      this.repeatEvent();
      return;
    }
    this.state = 2;
    var seq = this.getCharacterSequence(event);
    this.pumpEvent(event, seq);
  };

  KeyPress.onKeyUp = function (event) {
    if (this.state == 1) {
      // signal this is a down-up scenario (no press)
      var seq = this.queue[0];
      if (seq) seq.downUp = true;
    }
    this.state = 3;
    this.pumpEvent(event);
  };

  KeyPress.getCommandSequence = function (event) {
    ////ecma.console.log('w=', event.which, 'kc=', event.keyCode);
    var num = event.keyCode;
    var name = undefined;
    var isModifier = false;
    var isResolved = event.ctrlKey || event.altKey || event.metaKey
      ? true : false;
    if (num < 32 || num in _lowerNames) {
      name = _lowerNames[num];
      isModifier = _modifierNames[num] ? true : false;
      isResolved = true;
    } else {
      if (num in _commandNames) {
        name = _commandNames[num];
        isResolved = true;
      } else {
        if (num in _symbolNames) {
          name = _symbolNames[num];
          // shift+' should not be resolved
          isResolved = event.shiftKey ? false : true;
        } else if (num in _functionNames) {
          name = _functionNames[num];
          isResolved = true;
        } else {
          name = String.fromCharCode(num).toLowerCase();
        }
      }
    }
    var ascii = [];
    if (ecma.util.defined(name)) {
      if (event.ctrlKey && name != 'ctrl') ascii.push('ctrl');
      if (event.altKey && name != 'alt') ascii.push('alt');
      if (event.shiftKey && name != 'shift') ascii.push('shift');
      if (event.metaKey && name != 'meta') ascii.push('meta');
      ascii.push(name);
    }
    var seq = {
      'ascii':    ascii.join('+'),
      'numeric':  num,
      'isModifier': isModifier,
      'isResolved': isResolved,
      'isCharacter': false,
      'keyCode':  event.keyCode,
      'which':    event.which,
      'type':     event.type
    };
    ////this.trace(seq, 'cmd');
    return seq;
  };

  KeyPress.getCharacterSequence = function (event) {
    var num = ecma.util.defined(event.which) ? event.which : event.keyCode;
    var isModifier = false;
    var omitShift = false;
    var name = undefined;
    if (num < 32 || num in _lowerNames) {
      name = _lowerNames[num];
      isModifier = _modifierNames[num] ? true : false;
    } else {
      name = String.fromCharCode(num);
      omitShift = true;
    }
    var isCharacter = name && !event.ctrlKey && !event.altKey;
    var ascii = [];
    if (ecma.util.defined(name)) {
      if (event.ctrlKey && name != 'ctrl') ascii.push('ctrl');
      if (event.altKey && name != 'alt') ascii.push('alt');
      if (event.shiftKey && name != 'shift' && !omitShift) ascii.push('shift');
      if (event.metaKey && name != 'meta') ascii.push('meta');
      ascii.push(name);
    }
    var seq = {
      'ascii':    ascii.join('+'),
      'numeric':  num,
      'isModifier': isModifier,
      'isResolved': true,
      'isCharacter': isCharacter,
      'keyCode':  event.keyCode,
      'which':    event.which,
      'type':     event.type
    };
    ////this.trace(seq, 'chr');
    return seq;
  };

  KeyPress.trace = function () {
    var out = ecma.util.args(arguments);
    var seq = out.shift();
    var flags = '';
    if (seq.isCharacter) flags += 'c';
    if (seq.isModifier) flags += 'm';
    if (seq.isResolved) flags += 'r';
    out.push(ecma.util.pad(seq.type, 10, ' '));
    out.push(ecma.util.pad(seq.keyCode, 5, ' '));
    out.push(ecma.util.pad(seq.which, 5, ' '));
    out.push(ecma.util.pad(seq.numeric, 5, ' '));
    out.push(ecma.util.pad(flags, 6, ' '));
    out.push(ecma.util.pad(seq.ascii, 25, ' '));
    ecma.console.log(out.join('|'));
  };

  KeyPress.traceHeader = function () {
    var out = [];
    out.push(ecma.util.pad('event', 10, ' '));
    out.push(ecma.util.pad('keyCo', 5, ' '));
    out.push(ecma.util.pad('which', 5, ' '));
    out.push(ecma.util.pad('using', 5, ' '));
    out.push(ecma.util.pad('flags', 6, ' '));
    out.push(ecma.util.pad('sequence', 25, ' '));
    ecma.console.log(out.join('|'));
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @class StyleSheet
   * Wrapper class for cascading style sheets.
   *
   *  var css = new ecma.dom.StyleSheet();
   *  var css = new ecma.dom.StyleSheet(props);
   *
   *  props = {
   *    'id': 'element-id',
   *    'position': 'first|last' // dom position relative to other STYLE nodes
   *  };
   *
   *  var css = new ecma.dom.StyleSheet();
   *  css.createRule('div.foo', {'border', '1px solid blue'});
   *  css.updateRule('div.foo', {'width': '200px', 'height': '30em'});
   *
   * Internet Explorer (v7 at least) does not honor rule-names separated with a
   * comma.  This will issue an exception:
   *
   *  css.createRule('html, body', {'background', 'transparent'});
   *
   */
  this.StyleSheet = function(params) {
    if (!params) params = {};
    if (!ecma.util.isAssociative(params)) {
      params = {'id': params}; // depricated usage, first arg was id
    }
    this.position = params.position || 'last';
    this.id = params.id || ecma.util.randomId('css');
    this.style = undefined;
    this.sheet = undefined;
    this.cssRulesByName = undefined;
  };

  this.StyleSheet.prototype = {

/*
    toString: function () {
      var result = '';
      if (!this.cssRulesByName) return result;
      for (var name in this.cssRulesByName) {
        result += this.cssRulesByName[name].rule.cssText;
      }
      return result;
    },

    importStyles: function (css) {
      ecma.console.log('importStyles', css);
    },
*/

    vivify: function () {
      this.style = ecma.dom.getElement(this.id) || ecma.dom.createElement(
        'style', {
          id: this.id,
          type: 'text/css',
          rel: 'stylesheet',
          media: 'screen'
        });
      var elems = ecma.dom.selectElements(
        'head > style, head > link[rel="stylesheet"]'
      );
      if (elems.length) {
        if (this.position == 'first') {
          ecma.dom.insertBefore(this.style, elems.shift());
        } else {
          ecma.dom.insertAfter(this.style, elems.pop());
        }
      } else {
        ecma.dom.getHead().appendChild(this.style);
      }
      this.sheet = this.style.sheet || this.style.styleSheet;
      this.cssRulesByName = {};
    },

    objToStr: function(obj, opts) {
      var result = '';
      for (var name in obj) {
        if (opts && ecma.util.defined(opts.exclude)) {
          if (name.match(opts.exclude)) {
            continue;
          }
        }
        result += name + ':' + this.clarifyValue(name, obj[name]) + ';';
      }
      return result;
    },

    strToObj: function(str) {
      str = str.replace(/\r?\n\r?\s*/g, '');
      var result = {};
      var items = str.split(';');
      for (var i = 0; i < items.length - 1; i++) {
        var key = items[i].split(/:/, 1);
        var value = items[i].substr(key[0].length + 1);
        value = value.replace(/^\s+/, '');
        var name = key[0];
        result[name] = value;
      }
      return result;
    },

    clarifyValue: function(name, value) {
      return typeof(value) === 'number'
        ? name.match(/(width|height|top|right|bottom|left)$/)
          ? value + 'px' // default units (required)
          : value + '' // toString (numbers not allowed)
        : value;
    },

    /*
     * createRules - Create multiple rules when the name contains commas
     * Update an existing style rule, or create a new one if none exists.
     *  var rules = css.createRules('h1, h2', {'font-size': '1.8em'});
     *  var rules = css.createRules('h1, h2', 'font-size: 1.8em;');
     * Provided for IE compatibility.
     */

    createRules: function (name, props) {
      var names = name.split(/,\s*/);
      var rules = [];
      for (var i = 0; i < names.length; i++) {
        rules.push(this.createRule(names[i], props));
      }
      return rules;
    },

    createRulesFromData: function (data) {
      var rules = [];
      while (data.length) {
        var def = data.shift();
        rules = rules.concat(this.createRules(def.selector, def.rule));
      }
      return rules;
    },

    /*
     * updateRules - Update multiple rules when the name contains commas
     * Update an existing style rule, or create a new one if none exists.
     *  var rules = css.updateRules('h1, h2', {'font-size': '1.8em'});
     *  var rules = css.updateRules('h1, h2', 'font-size: 1.8em;');
     * Provided for IE compatibility.
     */

    updateRules: function (name, props) {
      var names = name.split(/,\s*/);
      var rules = [];
      for (var i = 0; i < names.length; i++) {
        rules.push(this.updateRule(names[i], props));
      }
      return rules;
    },

    cssNameToJsName: function(name) {
      if (name == 'float') return 'cssFloat';
      if (name == 'class') return 'className';
      return ecma.util.asCamelCaseName(name);
    },

    jsNameToCssName: function(name) {
      if (name == 'cssFloat') return 'float';
      if (name == 'className') return 'class';
      return ecma.util.asHyphenatedName(name);
    },

    /**
     * @function createRule
     * Create a new style rule.
     *  var rule = css.createRule('body', {'background': '#def'});
     *  var rule = css.createRule('body', 'background:#def');
     */
    createRule: function(name, props) {
      if (!this.style) this.vivify();
      var str = ecma.util.isAssociative(props) ? this.objToStr(props) : props;
      var rule = null;
      var idx = -1;
      if (ecma.util.defined(this.sheet.addRule)) {
        /* ie */
        idx = this.sheet.rules.length;
        this.sheet.addRule(name, str);
        rule = this.sheet.rules[idx];
      } else if(ecma.util.defined(this.sheet.insertRule)) {
        idx = this.sheet.cssRules.length;
        this.sheet.insertRule(name +' {' + str + '}', idx);
        rule = this.sheet.cssRules[idx];
      }
      this.cssRulesByName[name] = {'rule': rule, 'index': idx};
      return rule;
    },

    /**
     * @function updateRule
     * Update an existing style rule, or create a new one if none exists.
     *  var rule = css.updateRule('h1', {'font-size': '1.8em'});
     *  var rule = css.updateRule('h1', 'font-size: 1.8em;');
     */
    updateRule: function(name, props) {
      if (!this.style) this.vivify();
      var rinfo = this.cssRulesByName[name];
      var rule = rinfo ? rinfo.rule : undefined;
      if (rule) {
        if (!ecma.util.isAssociative(props)) props = this.strToObj(props);
        for (var propName in props) {
          var value = this.clarifyValue(propName, props[propName]);
          ecma.dom.setStyle(rule, propName, value);
        }
      } else {
        rule = this.createRule(name, props);
      }
      return rule;
    },

    deleteRule: function(rule) {
      if (!this.style) return;
      var found = false;
      for (var name in this.cssRulesByName) {
        var rinfo = this.cssRulesByName[name];
        if (rinfo.rule === rule) {
          if (ecma.util.defined(this.sheet.removeRule)) {
            this.sheet.removeRule(rinfo.index);
          } else {
            this.sheet.deleteRule(rinfo.index);
          }
          delete this.cssRulesByName[name];
          found = true;
        } else if (found) {
          rinfo.index--;
        }
      }
      return found;
    }

  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @class EventListener
   * An event listener which is bound a particular scope.
   *
   *  var listener = new ecma.dom.EventListener(elem, listener);
   *  var listener = new ecma.dom.EventListener(elem, listener, scope);
   *  var listener = new ecma.dom.EventListener(elem, listener, scope, args);
   *  var listener = new ecma.dom.EventListener(elem, listener, scope, args, useCapture);
   *
   * @param target      <Element>   Target element
   * @param type        <String>    Event type
   * @param listener    <Function>  Callback function
   * @param scope       <Object>    Callback scope
   * @param args        <Array>     Arguments (appended after event parameter)
   * @param useCapture  <Boolean>   Use capture
   *
   * Example:
   *
   *  function MyClass (elem) {
   *    this.listener = new ecma.dom.EventListener(btn1, 'click', this.onClick, this);
   *  }
   *  MyClass.prototype = {
   *    'onClick': function (event) {
   *      if (confirm('Remove event listener?')) {
   *        this.destroy();
   *      }
   *    },
   *    'destroy': function () {
   *      this.listener.remove();
   *    }
   *  };
   *  var hander = new MyClass(ecma.dom.getElement('btn1'));
   *  ecma.dom.removeElement('btn1');
   */

  this.EventListener = function (target, type, listener, scope, args, useCapture) {
    this.target = ecma.dom.getElement(target);
    this.type = type;
    this.scope = scope;
    this.useCapture = useCapture;
    this.func = ecma.dom.addEventListener(this.target, this.type, listener, 
      this.scope, args, this.useCapture);
  };

  var proto = this.EventListener.prototype = {};

  proto.remove = function () {
    ecma.dom.removeEventListener(this.target, this.type, this.func, this.scope, this.useCapture);
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  var PRESERVE_WS_TAGS = [
    'CODE',
    'PRE',
    'TEXTAREA',
    'TT'
  ];

  function _wsMatters (node) {
    var pNode = node.parentNode;
    while (pNode) {
      if (ecma.util.grep(pNode.tagName, PRESERVE_WS_TAGS)) return true;
      if (pNode.parentNode === pNode) break;
      pNode = pNode.parentNode;
    }
    return false;
  }

  /**
   * @function condense
   */

  this.condense = function (elem) {
    var node = elem.firstChild;
    while (node) {
      var next = node.nextSibling;
      switch (node.nodeType) {
        case ecma.dom.constants.ELEMENT_NODE:
          ecma.dom.condense(node); // recurse
          break;
        case ecma.dom.constants.TEXT_NODE:
          if (node.nodeValue.match(/^\s*$/)
              && (node === elem.firstChild || ecma.dom.node.isElement(node.previousSibling))
              && (node === elem.lastChild || ecma.dom.node.isElement(node.nextSibling))) {
            // Remove ws nodes between elements
            ecma.dom.removeElement(node);
            break;
          }
          if (_wsMatters(node)) {
            // Retain node as is
            break;
          }
          // Condense ws inside text nodes
          node.nodeValue = node.nodeValue.replace(/\s+/g, ' ');
          if (node.nodeValue) {
            // Retain nodes with content
            break;
          }
      }
      node = next;
    }
    return elem;
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  var _package = this; // ecma.dom
  var window = ecma.window; // scope

/*!
 * Sizzle CSS Selector Engine
 *  Copyright 2012, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function( window, undefined ) {

var cachedruns,
	dirruns,
	sortOrder,
	siblingCheck,
	assertGetIdNotName,

	document = window.document,
	docElem = document.documentElement,

	strundefined = "undefined",
	hasDuplicate = false,
	baseHasDuplicate = true,
	done = 0,
	slice = [].slice,
	push = [].push,

	expando = ( "sizcache" + Math.random() ).replace( ".", "" ),

	// Regex

	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",
	// http://www.w3.org/TR/css3-syntax/#characters
	characterEncoding = "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])",

	// Loosely modeled on Javascript identifier characters
	identifier = "(?:[\\w#_-]|[^\\x00-\\xa0]|\\\\.)",
	// Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
	operators = "([*^$|!~]?=)",
	attributes = "\\[" + whitespace + "*(" + characterEncoding + "+)" + whitespace +
		"*(?:" + operators + whitespace + "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" + identifier + "+)|)|)" + whitespace + "*\\]",
	pseudos = ":(" + characterEncoding + "+)(?:\\((?:(['\"])((?:\\\\.|[^\\\\])*?)\\2|(.*))\\)|)",
	pos = ":(nth|eq|gt|lt|first|last|even|odd)(?:\\((\\d*)\\)|)(?=[^-]|$)",
	combinators = whitespace + "*([\\x20\\t\\r\\n\\f>+~])" + whitespace + "*",
	groups = "(?=[^\\x20\\t\\r\\n\\f])(?:\\\\.|" + attributes + "|" + pseudos.replace( 2, 6 ) + "|[^\\\\(),])+",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcombinators = new RegExp( "^" + combinators ),

	// All simple (non-comma) selectors, excluding insignifant trailing whitespace
	rgroups = new RegExp( groups + "?(?=" + whitespace + "*,|$)", "g" ),

	// A selector, or everything after leading whitespace
	// Optionally followed in either case by a ")" for terminating sub-selectors
	rselector = new RegExp( "^(?:(?!,)(?:(?:^|,)" + whitespace + "*" + groups + ")*?|" + whitespace + "*(.*?))(\\)|$)" ),

	// All combinators and selector components (attribute test, tag, pseudo, etc.), the latter appearing together when consecutive
	rtokens = new RegExp( groups.slice( 19, -6 ) + "\\x20\\t\\r\\n\\f>+~])+|" + combinators, "g" ),

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,

	rsibling = /^[\x20\t\r\n\f]*[+~]/,
	rendsWithNot = /:not\($/,

	rheader = /h\d/i,
	rinputs = /input|select|textarea|button/i,

	rbackslash = /\\(?!\\)/g,

	matchExpr = {
		"ID": new RegExp( "^#(" + characterEncoding + "+)" ),
		"CLASS": new RegExp( "^\\.(" + characterEncoding + "+)" ),
		"NAME": new RegExp( "^\\[name=['\"]?(" + characterEncoding + "+)['\"]?\\]" ),
		"TAG": new RegExp( "^(" + characterEncoding.replace( "[-", "[-\\*" ) + "+)" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|nth|last|first)-child(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"POS": new RegExp( pos, "ig" ),
		// For use in libraries implementing .is(), an unaltered POS
		"globalPOS": new RegExp( pos, "i" )
	},

	classCache = {},
	cachedClasses = [],
	compilerCache = {},
	cachedSelectors = [],

	// Mark a function for use in filtering
	markFunction = function( fn ) {
		fn.sizzleFilter = true;
		return fn;
	},

	// Returns a function to use in pseudos for input types
	createInputFunction = function( type ) {
		return function( elem ) {
			// Check the input's nodeName and type
			return elem.nodeName.toLowerCase() === "input" && elem.type === type;
		};
	},

	// Returns a function to use in pseudos for buttons
	createButtonFunction = function( type ) {
		return function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return (name === "input" || name === "button") && elem.type === type;
		};
	},

	// Used for testing something on an element
	assert = function( fn ) {
		var pass = false,
			div = document.createElement("div");
		try {
			pass = fn( div );
		} catch (e) {}
		// release memory in IE
		div = null;
		return pass;
	},

	// Check if attributes should be retrieved by attribute nodes
	assertAttributes = assert(function( div ) {
		div.innerHTML = "<select></select>";
		var type = typeof div.lastChild.getAttribute("multiple");
		// IE8 returns a string for some attributes even when not present
		return type !== "boolean" && type !== "string";
	}),

	// Check if getElementById returns elements by name
	// Check if getElementsByName privileges form controls or returns elements by ID
	assertUsableName = assert(function( div ) {
		// Inject content
		div.id = expando + 0;
		div.innerHTML = "<a name='" + expando + "'></a><div name='" + expando + "'></div>";
		docElem.insertBefore( div, docElem.firstChild );

		// Test
		var pass = document.getElementsByName &&
			// buggy browsers will return fewer than the correct 2
			document.getElementsByName( expando ).length ===
			// buggy browsers will return more than the correct 0
			2 + document.getElementsByName( expando + 0 ).length;
		assertGetIdNotName = !document.getElementById( expando );

		// Cleanup
		docElem.removeChild( div );

		return pass;
	}),

	// Check if the browser returns only elements
	// when doing getElementsByTagName("*")
	assertTagNameNoComments = assert(function( div ) {
		div.appendChild( document.createComment("") );
		return div.getElementsByTagName("*").length === 0;
	}),

	// Check if getAttribute returns normalized href attributes
	assertHrefNotNormalized = assert(function( div ) {
		div.innerHTML = "<a href='#'></a>";
		return div.firstChild && typeof div.firstChild.getAttribute !== strundefined &&
			div.firstChild.getAttribute("href") === "#";
	}),

	// Check if getElementsByClassName can be trusted
	assertUsableClassName = assert(function( div ) {
		// Opera can't find a second classname (in 9.6)
		div.innerHTML = "<div class='hidden e'></div><div class='hidden'></div>";
		if ( !div.getElementsByClassName || div.getElementsByClassName("e").length === 0 ) {
			return false;
		}

		// Safari caches class attributes, doesn't catch changes (in 3.2)
		div.lastChild.className = "e";
		return div.getElementsByClassName("e").length !== 1;
	});

var Sizzle = function( selector, context, results, seed ) {
	results = results || [];
	context = context || document;
	var match, elem, xml, m,
		nodeType = context.nodeType;

	if ( nodeType !== 1 && nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	xml = isXML( context );

	if ( !xml && !seed ) {
		if ( (match = rquickExpr.exec( selector )) ) {
			// Speed-up: Sizzle("#ID")
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = context.getElementById( m );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document #6963
					if ( elem && elem.parentNode ) {
						// Handle the case where IE, Opera, and Webkit return items
						// by name instead of ID
						if ( elem.id === m ) {
							results.push( elem );
							return results;
						}
					} else {
						return results;
					}
				} else {
					// Context is not a document
					if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
						contains( context, elem ) && elem.id === m ) {
						results.push( elem );
						return results;
					}
				}

			// Speed-up: Sizzle("TAG")
			} else if ( match[2] ) {
				push.apply( results, slice.call(context.getElementsByTagName( selector ), 0) );
				return results;

			// Speed-up: Sizzle(".CLASS")
			} else if ( (m = match[3]) && assertUsableClassName && context.getElementsByClassName ) {
				push.apply( results, slice.call(context.getElementsByClassName( m ), 0) );
				return results;
			}
		}
	}

	// All others
	return select( selector, context, results, seed, xml );
};

var Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	match: matchExpr,

	order: [ "ID", "TAG" ],

	attrHandle: {},

	createPseudo: markFunction,

	find: {
		"ID": assertGetIdNotName ?
			function( id, context, xml ) {
				if ( typeof context.getElementById !== strundefined && !xml ) {
					var m = context.getElementById( id );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document #6963
					return m && m.parentNode ? [m] : [];
				}
			} :
			function( id, context, xml ) {
				if ( typeof context.getElementById !== strundefined && !xml ) {
					var m = context.getElementById( id );

					return m ?
						m.id === id || typeof m.getAttributeNode !== strundefined && m.getAttributeNode("id").value === id ?
							[m] :
							undefined :
						[];
				}
			},

		"TAG": assertTagNameNoComments ?
			function( tag, context ) {
				if ( typeof context.getElementsByTagName !== strundefined ) {
					return context.getElementsByTagName( tag );
				}
			} :
			function( tag, context ) {
				var results = context.getElementsByTagName( tag );

				// Filter out possible comments
				if ( tag === "*" ) {
					var elem,
						tmp = [],
						i = 0;

					for ( ; (elem = results[i]); i++ ) {
						if ( elem.nodeType === 1 ) {
							tmp.push( elem );
						}
					}

					return tmp;
				}
				return results;
			}
	},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( rbackslash, "" );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[4] || match[5] || "" ).replace( rbackslash, "" );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr.CHILD
				1 type (only|nth|...)
				2 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				3 xn-component of xn+y argument ([+-]?\d*n|)
				4 sign of xn-component
				5 x of xn-component
				6 sign of y-component
				7 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1] === "nth" ) {
				// nth-child requires argument
				if ( !match[2] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[3] = +( match[3] ? match[4] + (match[5] || 1) : 2 * ( match[2] === "even" || match[2] === "odd" ) );
				match[4] = +( ( match[6] + match[7] ) || match[2] === "odd" );

			// other types prohibit arguments
			} else if ( match[2] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var argument,
				unquoted = match[4];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Relinquish our claim on characters in `unquoted` from a closing parenthesis on
			if ( unquoted && (argument = rselector.exec( unquoted )) && argument.pop() ) {

				match[0] = match[0].slice( 0, argument[0].length - unquoted.length - 1 );
				unquoted = argument[0].slice( 0, -1 );
			}

			// Quoted or unquoted, we have the full argument
			// Return only captures needed by the pseudo filter method (type and argument)
			match.splice( 2, 3, unquoted || match[3] );
			return match;
		}
	},

	filter: {
		"ID": assertGetIdNotName ?
			function( id ) {
				id = id.replace( rbackslash, "" );
				return function( elem ) {
					return elem.getAttribute("id") === id;
				};
			} :
			function( id ) {
				id = id.replace( rbackslash, "" );
				return function( elem ) {
					var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode("id");
					return node && node.value === id;
				};
			},

		"TAG": function( nodeName ) {
			if ( nodeName === "*" ) {
				return function() { return true; };
			}
			nodeName = nodeName.replace( rbackslash, "" ).toLowerCase();

			return function( elem ) {
				return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
			};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className ];
			if ( !pattern ) {
				pattern = classCache[ className ] = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" );
				cachedClasses.push( className );
				// Avoid too large of a cache
				if ( cachedClasses.length > Expr.cacheLength ) {
					delete classCache[ cachedClasses.shift() ];
				}
			}
			return function( elem ) {
				return pattern.test( elem.className || (typeof elem.getAttribute !== strundefined && elem.getAttribute("class")) || "" );
			};
		},

		"ATTR": function( name, operator, check ) {
			if ( !operator ) {
				return function( elem ) {
					return Sizzle.attr( elem, name ) != null;
				};
			}

			return function( elem ) {
				var result = Sizzle.attr( elem, name ),
					value = result + "";

				if ( result == null ) {
					return operator === "!=";
				}

				switch ( operator ) {
					case "=":
						return value === check;
					case "!=":
						return value !== check;
					case "^=":
						return check && value.indexOf( check ) === 0;
					case "*=":
						return check && value.indexOf( check ) > -1;
					case "$=":
						return check && value.substr( value.length - check.length ) === check;
					case "~=":
						return ( " " + value + " " ).indexOf( check ) > -1;
					case "|=":
						return value === check || value.substr( 0, check.length + 1 ) === check + "-";
				}
			};
		},

		"CHILD": function( type, argument, first, last ) {

			if ( type === "nth" ) {
				var doneName = done++;

				return function( elem ) {
					var parent, diff,
						count = 0,
						node = elem;

					if ( first === 1 && last === 0 ) {
						return true;
					}

					parent = elem.parentNode;

					if ( parent && (parent[ expando ] !== doneName || !elem.sizset) ) {
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.sizset = ++count;
								if ( node === elem ) {
									break;
								}
							}
						}

						parent[ expando ] = doneName;
					}

					diff = elem.sizset - last;

					if ( first === 0 ) {
						return diff === 0;

					} else {
						return ( diff % first === 0 && diff / first >= 0 );
					}
				};
			}

			return function( elem ) {
				var node = elem;

				switch ( type ) {
					case "only":
					case "first":
						while ( (node = node.previousSibling) ) {
							if ( node.nodeType === 1 ) {
								return false;
							}
						}

						if ( type === "first" ) {
							return true;
						}

						node = elem;

						/* falls through */
					case "last":
						while ( (node = node.nextSibling) ) {
							if ( node.nodeType === 1 ) {
								return false;
							}
						}

						return true;
				}
			};
		},

		"PSEUDO": function( pseudo, argument, context, xml ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			var fn = Expr.pseudos[ pseudo ] || Expr.pseudos[ pseudo.toLowerCase() ];

			if ( !fn ) {
				Sizzle.error( "unsupported pseudo: " + pseudo );
			}

			// The user may set fn.sizzleFilter to indicate
			// that arguments are needed to create the filter function
			// just as Sizzle does
			if ( !fn.sizzleFilter ) {
				return fn;
			}

			return fn( argument, context, xml );
		}
	},

	pseudos: {
		"not": markFunction(function( selector, context, xml ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var matcher = compile( selector.replace( rtrim, "$1" ), context, xml );
			return function( elem ) {
				return !matcher( elem );
			};
		}),

		"enabled": function( elem ) {
			return elem.disabled === false;
		},

		"disabled": function( elem ) {
			return elem.disabled === true;
		},

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		"parent": function( elem ) {
			return !!elem.firstChild;
		},

		"empty": function( elem ) {
			return !elem.firstChild;
		},

		"contains": markFunction(function( text ) {
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"text": function( elem ) {
			var type, attr;
			// IE6 and 7 will map elem.type to 'text' for new HTML5 types (search, etc)
			// use getAttribute instead to test this case
			return elem.nodeName.toLowerCase() === "input" &&
				(type = elem.type) === "text" &&
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === type );
		},

		// Input types
		"radio": createInputFunction("radio"),
		"checkbox": createInputFunction("checkbox"),
		"file": createInputFunction("file"),
		"password": createInputFunction("password"),
		"image": createInputFunction("image"),

		"submit": createButtonFunction("submit"),
		"reset": createButtonFunction("reset"),

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"focus": function( elem ) {
			var doc = elem.ownerDocument;
			return elem === doc.activeElement && (!doc.hasFocus || doc.hasFocus()) && !!(elem.type || elem.href);
		},

		"active": function( elem ) {
			return elem === elem.ownerDocument.activeElement;
		}
	},

	setFilters: {
		"first": function( elements, argument, not ) {
			return not ? elements.slice( 1 ) : [ elements[0] ];
		},

		"last": function( elements, argument, not ) {
			var elem = elements.pop();
			return not ? elements : [ elem ];
		},

		"even": function( elements, argument, not ) {
			var results = [],
				i = not ? 1 : 0,
				len = elements.length;
			for ( ; i < len; i = i + 2 ) {
				results.push( elements[i] );
			}
			return results;
		},

		"odd": function( elements, argument, not ) {
			var results = [],
				i = not ? 0 : 1,
				len = elements.length;
			for ( ; i < len; i = i + 2 ) {
				results.push( elements[i] );
			}
			return results;
		},

		"lt": function( elements, argument, not ) {
			return not ? elements.slice( +argument ) : elements.slice( 0, +argument );
		},

		"gt": function( elements, argument, not ) {
			return not ? elements.slice( 0, +argument + 1 ) : elements.slice( +argument + 1 );
		},

		"eq": function( elements, argument, not ) {
			var elem = elements.splice( +argument, 1 );
			return not ? elements : elem;
		}
	}
};

// Deprecated
Expr.setFilters["nth"] = Expr.setFilters["eq"];

// Back-compat
Expr.filters = Expr.pseudos;

// IE6/7 return a modified href
if ( !assertHrefNotNormalized ) {
	Expr.attrHandle = {
		"href": function( elem ) {
			return elem.getAttribute( "href", 2 );
		},
		"type": function( elem ) {
			return elem.getAttribute("type");
		}
	};
}

// Add getElementsByName if usable
if ( assertUsableName ) {
	Expr.order.push("NAME");
	Expr.find["NAME"] = function( name, context ) {
		if ( typeof context.getElementsByName !== strundefined ) {
			return context.getElementsByName( name );
		}
	};
}

// Add getElementsByClassName if usable
if ( assertUsableClassName ) {
	Expr.order.splice( 1, 0, "CLASS" );
	Expr.find["CLASS"] = function( className, context, xml ) {
		if ( typeof context.getElementsByClassName !== strundefined && !xml ) {
			return context.getElementsByClassName( className );
		}
	};
}

// If slice is not available, provide a backup
try {
	slice.call( docElem.childNodes, 0 )[0].nodeType;
} catch ( e ) {
	slice = function( i ) {
		var elem, results = [];
		for ( ; (elem = this[i]); i++ ) {
			results.push( elem );
		}
		return results;
	};
}

var isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

// Element contains another
var contains = Sizzle.contains = docElem.compareDocumentPosition ?
	function( a, b ) {
		return !!( a.compareDocumentPosition( b ) & 16 );
	} :
	docElem.contains ?
	function( a, b ) {
		var adown = a.nodeType === 9 ? a.documentElement : a,
			bup = b.parentNode;
		return a === bup || !!( bup && bup.nodeType === 1 && adown.contains && adown.contains(bup) );
	} :
	function( a, b ) {
		while ( (b = b.parentNode) ) {
			if ( b === a ) {
				return true;
			}
		}
		return false;
	};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
var getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( nodeType ) {
		if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
			// Use textContent for elements
			// innerText usage removed for consistency of new lines (see #11153)
			if ( typeof elem.textContent === "string" ) {
				return elem.textContent;
			} else {
				// Traverse its children
				for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
					ret += getText( elem );
				}
			}
		} else if ( nodeType === 3 || nodeType === 4 ) {
			return elem.nodeValue;
		}
		// Do not include comment or processing instruction nodes
	} else {

		// If no nodeType, this is expected to be an array
		for ( ; (node = elem[i]); i++ ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	}
	return ret;
};

Sizzle.attr = function( elem, name ) {
	var attr,
		xml = isXML( elem ),
		normalized = xml ? name : name.toLowerCase();
	if ( Expr.attrHandle[ normalized ] ) {
		return Expr.attrHandle[ normalized ]( elem );
	}
	if ( assertAttributes || xml ) {
		return elem.getAttribute( normalized );
	}
	attr = elem.attributes || {};
	attr = attr[ normalized ] || attr[ name ];
	return attr ?
		typeof elem[ normalized ] === "boolean" ?
			elem[ normalized ] ? normalized : null :
			attr.specified ? attr.value : null :
		null;
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

// Check if the JavaScript engine is using some sort of
// optimization where it does not always call our comparision
// function. If that is the case, discard the hasDuplicate value.
//   Thus far that includes Google Chrome.
[0, 0].sort(function() {
	return (baseHasDuplicate = 0);
});


if ( docElem.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		return ( !a.compareDocumentPosition || !b.compareDocumentPosition ?
			a.compareDocumentPosition :
			a.compareDocumentPosition(b) & 4
		) ? -1 : 1;
	};

} else {
	sortOrder = function( a, b ) {
		// The nodes are identical, we can exit early
		if ( a === b ) {
			hasDuplicate = true;
			return 0;

		// Fallback to using sourceIndex (in IE) if it's available on both nodes
		} else if ( a.sourceIndex && b.sourceIndex ) {
			return a.sourceIndex - b.sourceIndex;
		}

		var al, bl,
			ap = [],
			bp = [],
			aup = a.parentNode,
			bup = b.parentNode,
			cur = aup;

		// If the nodes are siblings (or identical) we can do a quick check
		if ( aup === bup ) {
			return siblingCheck( a, b );

		// If no parents were found then the nodes are disconnected
		} else if ( !aup ) {
			return -1;

		} else if ( !bup ) {
			return 1;
		}

		// Otherwise they're somewhere else in the tree so we need
		// to build up a full list of the parentNodes for comparison
		while ( cur ) {
			ap.unshift( cur );
			cur = cur.parentNode;
		}

		cur = bup;

		while ( cur ) {
			bp.unshift( cur );
			cur = cur.parentNode;
		}

		al = ap.length;
		bl = bp.length;

		// Start walking down the tree looking for a discrepancy
		for ( var i = 0; i < al && i < bl; i++ ) {
			if ( ap[i] !== bp[i] ) {
				return siblingCheck( ap[i], bp[i] );
			}
		}

		// We ended someplace up the tree so do a sibling check
		return i === al ?
			siblingCheck( a, bp[i], -1 ) :
			siblingCheck( ap[i], b, 1 );
	};

	siblingCheck = function( a, b, ret ) {
		if ( a === b ) {
			return ret;
		}

		var cur = a.nextSibling;

		while ( cur ) {
			if ( cur === b ) {
				return -1;
			}

			cur = cur.nextSibling;
		}

		return 1;
	};
}

// Document sorting and removing duplicates
Sizzle.uniqueSort = function( results ) {
	var elem,
		i = 1;

	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort( sortOrder );

		if ( hasDuplicate ) {
			for ( ; (elem = results[i]); i++ ) {
				if ( elem === results[ i - 1 ] ) {
					results.splice( i--, 1 );
				}
			}
		}
	}

	return results;
};

function multipleContexts( selector, contexts, results, seed ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results, seed );
	}
}

function handlePOSGroup( selector, posfilter, argument, contexts, seed, not ) {
	var results,
		fn = Expr.setFilters[ posfilter.toLowerCase() ];

	if ( !fn ) {
		Sizzle.error( posfilter );
	}

	if ( selector || !(results = seed) ) {
		multipleContexts( selector || "*", contexts, (results = []), seed );
	}

	return results.length > 0 ? fn( results, argument, not ) : [];
}

function handlePOS( selector, context, results, seed, groups ) {
	var match, not, anchor, ret, elements, currentContexts, part, lastIndex,
		i = 0,
		len = groups.length,
		rpos = matchExpr["POS"],
		// This is generated here in case matchExpr["POS"] is extended
		rposgroups = new RegExp( "^" + rpos.source + "(?!" + whitespace + ")", "i" ),
		// This is for making sure non-participating
		// matching groups are represented cross-browser (IE6-8)
		setUndefined = function() {
			var i = 1,
				len = arguments.length - 2;
			for ( ; i < len; i++ ) {
				if ( arguments[i] === undefined ) {
					match[i] = undefined;
				}
			}
		};

	for ( ; i < len; i++ ) {
		// Reset regex index to 0
		rpos.exec("");
		selector = groups[i];
		ret = [];
		anchor = 0;
		elements = seed;
		while ( (match = rpos.exec( selector )) ) {
			lastIndex = rpos.lastIndex = match.index + match[0].length;
			if ( lastIndex > anchor ) {
				part = selector.slice( anchor, match.index );
				anchor = lastIndex;
				currentContexts = [ context ];

				if ( rcombinators.test(part) ) {
					if ( elements ) {
						currentContexts = elements;
					}
					elements = seed;
				}

				if ( (not = rendsWithNot.test( part )) ) {
					part = part.slice( 0, -5 ).replace( rcombinators, "$&*" );
				}

				if ( match.length > 1 ) {
					match[0].replace( rposgroups, setUndefined );
				}
				elements = handlePOSGroup( part, match[1], match[2], currentContexts, elements, not );
			}
		}

		if ( elements ) {
			push.apply( ret, elements );

			if ( (part = selector.slice( anchor )) && part !== ")" ) {
				multipleContexts( part, ret, results, seed );
			} else {
				push.apply( results, ret );
			}
		} else {
			Sizzle( selector, context, results, seed );
		}
	}

	// Do not sort if this is a single filter
	return len === 1 ? results : Sizzle.uniqueSort( results );
}

function tokenize( selector, context, xml ) {
	var tokens, soFar, type,
		groups = [],
		i = 0,

		// Catch obvious selector issues: terminal ")"; nonempty fallback match
		// rselector never fails to match *something*
		match = rselector.exec( selector ),
		matched = !match.pop() && !match.pop(),
		selectorGroups = matched && selector.match( rgroups ) || [""],

		preFilters = Expr.preFilter,
		filters = Expr.filter,
		checkContext = !xml && context !== document;

	for ( ; (soFar = selectorGroups[i]) != null && matched; i++ ) {
		groups.push( tokens = [] );

		// Need to make sure we're within a narrower context if necessary
		// Adding a descendant combinator will generate what is needed
		if ( checkContext ) {
			soFar = " " + soFar;
		}

		while ( soFar ) {
			matched = false;

			// Combinators
			if ( (match = rcombinators.exec( soFar )) ) {
				soFar = soFar.slice( match[0].length );

				// Cast descendant combinators to space
				matched = tokens.push({ part: match.pop().replace( rtrim, " " ), captures: match });
			}

			// Filters
			for ( type in filters ) {
				if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
					(match = preFilters[ type ]( match, context, xml )) ) ) {

					soFar = soFar.slice( match.shift().length );
					matched = tokens.push({ part: type, captures: match });
				}
			}

			if ( !matched ) {
				break;
			}
		}
	}

	if ( !matched ) {
		Sizzle.error( selector );
	}

	return groups;
}

function addCombinator( matcher, combinator, context ) {
	var dir = combinator.dir,
		doneName = done++;

	if ( !matcher ) {
		// If there is no matcher to check, check against the context
		matcher = function( elem ) {
			return elem === context;
		};
	}
	return combinator.first ?
		function( elem, context ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 ) {
					return matcher( elem, context ) && elem;
				}
			}
		} :
		function( elem, context ) {
			var cache,
				dirkey = doneName + "." + dirruns,
				cachedkey = dirkey + "." + cachedruns;
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 ) {
					if ( (cache = elem[ expando ]) === cachedkey ) {
						return false;
					} else if ( typeof cache === "string" && cache.indexOf(dirkey) === 0 ) {
						if ( elem.sizset ) {
							return elem;
						}
					} else {
						elem[ expando ] = cachedkey;
						if ( matcher( elem, context ) ) {
							elem.sizset = true;
							return elem;
						}
						elem.sizset = false;
					}
				}
			}
		};
}

function addMatcher( higher, deeper ) {
	return higher ?
		function( elem, context ) {
			var result = deeper( elem, context );
			return result && higher( result === true ? elem : result, context );
		} :
		deeper;
}

// ["TAG", ">", "ID", " ", "CLASS"]
function matcherFromTokens( tokens, context, xml ) {
	var token, matcher,
		i = 0;

	for ( ; (token = tokens[i]); i++ ) {
		if ( Expr.relative[ token.part ] ) {
			matcher = addCombinator( matcher, Expr.relative[ token.part ], context );
		} else {
			token.captures.push( context, xml );
			matcher = addMatcher( matcher, Expr.filter[ token.part ].apply( null, token.captures ) );
		}
	}

	return matcher;
}

function matcherFromGroupMatchers( matchers ) {
	return function( elem, context ) {
		var matcher,
			j = 0;
		for ( ; (matcher = matchers[j]); j++ ) {
			if ( matcher(elem, context) ) {
				return true;
			}
		}
		return false;
	};
}

var compile = Sizzle.compile = function( selector, context, xml ) {
	var tokens, group, i,
		cached = compilerCache[ selector ];

	// Return a cached group function if already generated (context dependent)
	if ( cached && cached.context === context ) {
		cached.dirruns++;
		return cached;
	}

	// Generate a function of recursive functions that can be used to check each element
	group = tokenize( selector, context, xml );
	for ( i = 0; (tokens = group[i]); i++ ) {
		group[i] = matcherFromTokens( tokens, context, xml );
	}

	// Cache the compiled function
	cached = compilerCache[ selector ] = matcherFromGroupMatchers( group );
	cached.context = context;
	cached.runs = cached.dirruns = 0;
	cachedSelectors.push( selector );
	// Ensure only the most recent are cached
	if ( cachedSelectors.length > Expr.cacheLength ) {
		delete compilerCache[ cachedSelectors.shift() ];
	}
	return cached;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	return Sizzle( expr, null, null, [ elem ] ).length > 0;
};

var select = function( selector, context, results, seed, xml ) {
	// Remove excessive whitespace
	selector = selector.replace( rtrim, "$1" );
	var elements, matcher, i, len, elem, token,
		type, findContext, notTokens,
		match = selector.match( rgroups ),
		tokens = selector.match( rtokens ),
		contextNodeType = context.nodeType;

	// POS handling
	if ( matchExpr["POS"].test(selector) ) {
		return handlePOS( selector, context, results, seed, match );
	}

	if ( seed ) {
		elements = slice.call( seed, 0 );

	// To maintain document order, only narrow the
	// set if there is one group
	} else if ( match && match.length === 1 ) {

		// Take a shortcut and set the context if the root selector is an ID
		if ( tokens.length > 1 && contextNodeType === 9 && !xml &&
				(match = matchExpr["ID"].exec( tokens[0] )) ) {

			context = Expr.find["ID"]( match[1], context, xml )[0];
			if ( !context ) {
				return results;
			}

			selector = selector.slice( tokens.shift().length );
		}


		findContext = (tokens.length >= 1 && rsibling.test( tokens[0] ) && context.parentNode) || context;

		// Get the last token, excluding :not
		notTokens = tokens.pop();
		token = notTokens.split(":not")[0];

		for ( i = 0, len = Expr.order.length; i < len; i++ ) {
			type = Expr.order[i];

			if ( (match = matchExpr[ type ].exec( token )) ) {
				elements = Expr.find[ type ]( (match[1] || "").replace( rbackslash, "" ), findContext, xml );

				if ( elements == null ) {
					continue;
				}

				if ( token === notTokens ) {
					selector = selector.slice( 0, selector.length - notTokens.length ) +
						token.replace( matchExpr[ type ], "" );

					if ( !selector ) {
						push.apply( results, slice.call(elements, 0) );
					}
				}
				break;
			}
		}
	}

	// Only loop over the given elements once
	// If selector is empty, we're already done
	if ( selector ) {
		matcher = compile( selector, context, xml );
		dirruns = matcher.dirruns;

		if ( elements == null ) {
			elements = Expr.find["TAG"]( "*", context );
		}
		for ( i = 0; (elem = elements[i]); i++ ) {
			cachedruns = matcher.runs++;
			if ( matcher(elem, context) ) {
				results.push( elem );
			}
		}
	}

	return results;
};

if ( document.querySelectorAll ) {
	(function() {
		var disconnectedMatch,
			oldSelect = select,
			rescape = /'|\\/g,
			rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,
			rbuggyQSA = [],
			// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
			// A support test would require too much code (would include document ready)
			// just skip matchesSelector for :active
			rbuggyMatches = [":active"],
			matches = docElem.matchesSelector ||
				docElem.mozMatchesSelector ||
				docElem.webkitMatchesSelector ||
				docElem.oMatchesSelector ||
				docElem.msMatchesSelector;

		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			div.innerHTML = "<select><option selected></option></select>";

			// IE8 - Some boolean attributes are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:checked|disabled|ismap|multiple|readonly|selected|value)" );
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here (do not put tests after this one)
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}
		});

		assert(function( div ) {

			// Opera 10-12/IE9 - ^= $= *= and empty values
			// Should not select anything
			div.innerHTML = "<p test=''></p>";
			if ( div.querySelectorAll("[test^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:\"\"|'')" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here (do not put tests after this one)
			div.innerHTML = "<input type='hidden'>";
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push(":enabled", ":disabled");
			}
		});

		rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );

		select = function( selector, context, results, seed, xml ) {
			// Only use querySelectorAll when not filtering,
			// when this is not xml,
			// and when no QSA bugs apply
			if ( !seed && !xml && (!rbuggyQSA || !rbuggyQSA.test( selector )) ) {
				if ( context.nodeType === 9 ) {
					try {
						push.apply( results, slice.call(context.querySelectorAll( selector ), 0) );
						return results;
					} catch(qsaError) {}
				// qSA works strangely on Element-rooted queries
				// We can work around this by specifying an extra ID on the root
				// and working up from there (Thanks to Andrew Dupont for the technique)
				// IE 8 doesn't work on object elements
				} else if ( context.nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
					var newSelector,
						oldContext = context,
						old = context.getAttribute( "id" ),
						nid = old || expando,
						parent = context.parentNode;

					if ( old ) {
						nid = nid.replace( rescape, "\\$&" );
					} else {
						context.setAttribute( "id", nid );
					}

					if ( parent && rsibling.test( selector ) ) {
						context = parent;
					}

					try {
						if ( context ) {
							newSelector = selector.replace( rtrim, "" ).replace( rgroups, "[id='" + nid + "'] $&" );
							push.apply( results, slice.call(context.querySelectorAll( newSelector ), 0) );
							return results;
						}
					} catch(qsaError) {
					} finally {
						if ( !old ) {
							oldContext.removeAttribute( "id" );
						}
					}
				}
			}

			return oldSelect( selector, context, results, seed, xml );
		};

		if ( matches ) {
			assert(function( div ) {
				// Check to see if it's possible to do matchesSelector
				// on a disconnected node (IE 9)
				disconnectedMatch = matches.call( div, "div" );

				// This should fail with an exception
				// Gecko does not error, returns false instead
				try {
					matches.call( div, "[test!='']:sizzle" );
					rbuggyMatches.push( Expr.match.PSEUDO );
				} catch ( e ) {}
			});

			// rbuggyMatches always contains :active, so no need for a length check
			rbuggyMatches = /* rbuggyMatches.length && */ new RegExp( rbuggyMatches.join("|") );

			Sizzle.matchesSelector = function( elem, expr ) {
				// Make sure that attribute selectors are quoted
				expr = expr.replace( rattributeQuotes, "='$1']" );

				// rbuggyMatches always contains :active, so no need for an existence check
				if ( !isXML( elem ) && !rbuggyMatches.test( expr ) && (!rbuggyQSA || !rbuggyQSA.test( expr )) ) {
					try {
						var ret = matches.call( elem, expr );

						// IE 9's matchesSelector returns false on disconnected nodes
						if ( ret || disconnectedMatch ||
								// As well, disconnected nodes are said to be in a document
								// fragment in IE 9
								elem.document && elem.document.nodeType !== 11 ) {
							return ret;
						}
					} catch(e) {}
				}

				return Sizzle( expr, null, null, [ elem ] ).length > 0;
			};
		}
	})();
}

// EXPOSE
if ( typeof define === "function" && define.amd ) {
	define(function() { return Sizzle; });
} else {
	window.Sizzle = Sizzle;
}
// EXPOSE

})( window );


  /**
   * @function selectElements
   * @function sizzle
   */

  _package.selectElements =
  _package.sizzle = window.Sizzle;

  /**
   * @function selectElement
   */
  _package.selectElement = function( selector, context, results, seed ) {
    return _package.sizzle.apply(_package.sizzle, arguments)[0];
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  function _supports_html_storage () {
    try {
      return 'localStorage' in ecma.window
          && ecma.window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * @class LocalStorage
   * Provides methods for getting and setting storage.
   *
   *  var storage = new ecma.dom.LocalStorage();
   */

  var _proto = {};

  this.LocalStorage = function () {
    if (!_supports_html_storage()) {
      throw new Error('Cannot find local storage');
    }
    this.serializer = ecma.data.json; // Supports .parse and .format
  };

  this.LocalStorage.prototype = _proto;

  /**
   * @function encode
   * Encode an object for storage.
   *
   *  var str = storage.encode(obj);
   *
   * @param obj <Object> Data object
   */

  _proto.encode = function (value) {
    return this.serializer.format(value);
  };

  /**
   * @function decode
   * Decode an encoded string.
   *
   *  var obj = storage.decode(str);
   *
   * @param str <String> Encoded string
   */

  _proto.decode = function (str) {
    return this.serializer.parse(str);
  };

  /**
   * @function setObject
   * Set a storage to hold the value of a data object.
   * @param name  <String> Name of the storage
   * @param obj   <Object> Cookie data
   */

  _proto.setObject = function (name, value) {
    value = this.encode(value);
    return this.set(name, value);
  };

  /**
   * @function getObject
   * Get a data object stored in a storage.
   * @param name <String> Name of the storage
   */

  _proto.getObject = function (name) {
    var value = this.get(name);
    return value ? this.decode(value) : null;
  };

  /**
   * @function set
   * Set a storage to the given value.
   * @param name  <String> Name of the storage
   * @param value <String> Value of the storage
   */

  _proto.set = function (name, value) {
    return ecma.window.localStorage.setItem(name, value);
  };

  /**
   * @function get
   * Get a storage by its name.
   * @param name <String> Name of the storage
   */

  _proto.get = function (name) {
    return ecma.window.localStorage.getItem(name);
  };

  /**
   * @function remove
   * Remove a storage.
   * @param name <String> Name of the storage
   */

  _proto.remove = function (name) {
    return ecma.window.localStorage.removeItem(name);
  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var _pendingAuth = [];
  var _loginDialog = null;
  var CRequest = ecma.http.Request;
  var _proto = ecma.lang.createPrototype(CRequest);

  function _resubmitPending () {
    var req = _pendingAuth.shift();
    while (req) {
      req.resubmit();
      req = _pendingAuth.shift();
    }
  }

  function _flushPending () {
    var req = _pendingAuth.shift();
    while (req) {
      req.completeRequest();
      req = _pendingAuth.shift();
    }
  }

  /**
   * @class Request
   * @base ecma.http.Request
   */

  this.Request = function CLivesiteRequest (uri, userOptions) {
    var options = ecma.util.overlay({
      method: 'POST',
      loginURI: '/res/login/login.dlg',
      headers: {
        'Accept': 'text/data-xfr',
        'X-Accept-Content-Encoding': 'base64',
        'X-Content-Format': 'text/data-xfr',
        'X-Content-Encoding': 'base64',
        'Content-Type': 'text/plain; charset=utf-8' // the base64 does javascript utf-8 encoding, ugh
      }
    }, userOptions);
    CRequest.apply(this, [uri, options]);
  };

  this.Request.prototype = _proto;

  _proto.parseBody = function (body) {
    return body ? ecma.data.xfr.format(body) : null;
  };

  _proto.parseResponse = function () {
    var format = this.xhr.getResponseHeader('X-Content-Format');
    if (format) {
      if (format == 'text/data-xfr') {
        var encoding = this.xhr.getResponseHeader('X-Content-Encoding');
        var xfr = this.getXFR(encoding);
        this.responseHash = xfr.parse(this.xhr.responseText);
      } else if (format == 'text/json') {
        this.responseJSON = ecma.data.json.parse(this.xhr.responseText);
      }
    }
  };

  _proto.getXFR = function (encoding) {
    return new ecma.data.XFR(encoding);
  };

  _proto.canComplete = function () {
    if (this.xhr.status == 401 || (this.xhr.status == 403 && ecma.dom.browser.isOpera)) {
      if (this.uri == this.loginURI) return true;
      if (!_loginDialog) _loginDialog = this.showLoginDialog();
      _pendingAuth.push(this);
      return false;
    }
    return true;
  };

  _proto.showLoginDialog = function () {
    var loginDialog = new ecma.lsn.ui.LoginDialog(this.loginURI);
    loginDialog.dlg.show({
      onSuccess: ecma.lang.createCallback(function () {
        _loginDialog = null;
        _resubmitPending();
      }, this),
      onCancel: ecma.lang.createCallback(function () {
        _loginDialog = null;
        _flushPending();
      }, this)
    });
    return loginDialog;
  };

});

/** @namespace http */
ECMAScript.Extend('http', function (ecma) {
  
  var CDispatcher = ecma.action.ActionDispatcher;

  var _proto = ecma.lang.createPrototype(CDispatcher);

  /**
   * @class PerlModule
   */

  this.PerlModule = function (url) {
    CDispatcher.call(this);
    this.moduleURL = url;
  };

  this.PerlModule.prototype = _proto;

  /**
   * @function submit
   */

  _proto.setModuleURL = function (url) {
    this.moduleURL = url;
  };

  _proto.submit = function (subName, params, cb) {
    var req = new ecma.lsn.Request(this.moduleURL + '/' + subName);
    req.addEventListener('onComplete', this.doSubmitComplete, this, [cb]);
    req.submit(params);
    this.dispatchClassAction('onSend', req);
  };

  _proto.doSubmitComplete = function (req, cb) {
    var data = req && req.responseHash
      ? req.responseHash.get('body')
      : undefined;
    if (cb) ecma.lang.callback(cb, this, [data, req]);
    this.dispatchClassAction('onRecv', req);
  };

});

/** @namespace http */
ECMAScript.Extend('http', function (ecma) {

  var CRequest = ecma.lsn.Request;
  var CAction = ecma.action.ActionDispatcher;

  /**
   * @class Stream
   * @base lsn.Request
   */

  this.Stream = function () {
    CAction.apply(this);
    CRequest.apply(this, arguments);
    this.responseParts = [];
    this.boundary = null; // content boundary
    this.pos = 0; // index into responseText
  };

  var _proto = this.Stream.prototype = ecma.lang.createPrototype(CAction, CRequest);

  _proto.parseResponseHeaders = function () {
    this.xContentFormat = this.xhr.getResponseHeader('X-Content-Format');
    this.xContentEncoding = this.xhr.getResponseHeader('X-Content-Encoding');
    var contentType = this.xhr.getResponseHeader('Content-Type');
    var match = contentType.match(/boundary=([^\s]+)/);
    this.boundary = match ? match[1] : undefined;
  };

  _proto.getXFR = function () {
    if (this.xfr) return this.xfr;
    if (this.xContentFormat && this.xContentFormat == 'text/data-xfr') {
      return this.xfr = new ecma.data.XFR(this.xContentEncoding);
    } else {
      throw new Error('Response content is not in XFR format');
    }
  };

  _proto.onInteractive = function () {
    this.parseResponse();
  };

  _proto.submit = function () {
    this.responseParts = [];
    this.boundary = null;
    this.pos = 0;
    CRequest.prototype.submit.apply(this, arguments);
  };

  _proto.resubmit = function () {
    this.responseParts = [];
    this.boundary = null;
    this.pos = 0;
    CRequest.prototype.resubmit.apply(this, arguments);
  };

  /**
   * The last part is either an empty segment because the text ends with 
   * the boundary, or it is an incomplete segment.
   */

  _proto.parseResponse = function () {
    try {
      if (!this.xhr.responseText) return;
    } catch (ex) {
      // Not available
      return;
    }
    if (this.pos == 0) this.parseResponseHeaders();
    if ((this.xhr.responseText.length) > this.pos) {
      var parts = this.boundary
        ? this.xhr.responseText.split(this.boundary)
        : [this.responseText, undefined];
      parts.pop();
      for (var i = this.responseParts.length, part; part = parts[i]; i++) {
        this.responseParts[i] = this.getXFR().parse(part);
        this.executeClassAction('onReceive', this.responseParts[i], i);
      }
      this.pos = this.xhr.responseText.length;
    }
  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var _zIndex = 102;
  var _zCount = 0;

  /**
   * @function zIndex
   */

  this.zIndex = function () {
    return _zIndex + (2 * _zCount);
  }

  /**
   * @function zIndexAlloc
   */

  this.zIndexAlloc = function () {
    _zCount++;
    return ecma.lsn.zIndex();
  }

  /**
   * @function zIndexFree
   */

  this.zIndexFree = function () {
    _zCount--;
    return ecma.lsn.zIndex();
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var CAction = ecma.action.ActionDispatcher;

  /**
   * @class Base
   */

  this.Base = function () {

    CAction.apply(this);
    this.zIndex = ecma.lsn.zIndex();

  };

  var _proto = this.Base.prototype = ecma.lang.createPrototype(
    CAction
  );

  /**
   * @function zIndexAlloc
   */

  _proto.zIndexAlloc = function () {
    return this.zIndex = ecma.lsn.zIndexAlloc();
  };

  /**
   * @function zIndexFree
   */

  _proto.zIndexFree = function () {
    return this.zIndex = ecma.lsn.zIndexFree();
  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var _globalMask = undefined;

  var _defaultStyles = {
    'opacity': .75,
    'background-color': 'white'
  };

  var _requiredStyles = {
    'position':'absolute',
    'margin':0, 'padding':0, 'border':0, 'overflow':'hidden',
    'top':0, 'left':0, 'width':0, 'height':0
  };

  /**
   * @class Mask
   * A layer mask over the viewport.
   *  var mask = new ecma.lsn.Mask();
   *  var mask = new ecma.lsn.Mask(optStyle);
   * The C<optStyle> object is passed to L<ecma.dom.createElement> as the style
   * for the DIV which is the mask.  The actual DIV element which is the mask 
   * is created here as the public member C<ui>.  You may access it after function
   * is complete:
   *  var mask = new ecma.lsn.Mask();
   *  var div = mask.ui;
   */
  this.Mask = function (optStyle) {
    this.showCount = 0;
    this.style = ecma.util.overlay({}, _defaultStyles, optStyle, _requiredStyles);
    this.ui = ecma.dom.createElement('div');
    if (ecma.dom.browser.isIE) {
      //Fix for ie5/6, mask unable to hide select boxes. The src attribute must 
      //be set or IE will complain about both secure and non-secure times being 
      //on the page.
      this.ui.appendChild(ecma.dom.createElement('iframe', {
        'width': '0',
        'height': '0',
        'frameborder': '0',
        'src': 'about:blank',
        'style': {
          'width': '0',
          'height': '0',
          'visibility': 'hidden'
        }
      }));
    }
  };

  this.Mask.prototype = {

    /**
     * @function show
     * Show the mask.
     *  mask.show();
     *  mask.show(optStyle);
     * The C<optStyle> object contains styles which are applied to the mask
     * when it is shown, overriding any set in the constructor.
     */
    show: function (optStyle) {
      this.showCount++;
      if (this.showCount > 1) return;
      this.initDOM();
      this.applyStyles(optStyle);
      this.ce.appendChild(this.ui);
      this.t = ecma.dom.getTop(this.ui);
      this.l = ecma.dom.getLeft(this.ui);
      ecma.dom.setStyle(this.html, 'width', '100%');
      ecma.dom.setStyle(this.html, 'height', '100%');
      this.resize();
      this.resizeEvent = new ecma.dom.EventListener(
        window, 'resize', this.resize, this
      );
      return this;
    },

    initDOM: function () {
      var body = ecma.dom.getBody();
      this.ce = ecma.dom.browser.isIE ? body : body.parentNode || body;
      this.html = body.parentNode;
      this.canvas = new ecma.dom.Canvas();
    },

    applyStyles: function (optStyle) {
      var style = ecma.util.overlay(this.style, optStyle);
      var opacity = undefined;
      if (style) {
        for (var k in style) {
          if (k == 'opacity') {
            opacity = style[k];
            continue;
          }
          ecma.dom.setStyle(this.ui, k, style[k]);
        }
      }
      if (ecma.util.defined(opacity)) ecma.dom.setOpacity(this.ui, opacity);
    },

    getElement: function () {
      return this.ui;
    },

    /**
     * @function hide
     * Hide the mask.
     *  mask.hide();
     */
    hide: function () {
      this.showCount--;
      if (this.showCount < 0) this.showCount = 0;
      if (this.showCount) return;
      try {
        this.ce.removeChild(this.ui);
        this.resizeEvent.remove();
      } catch (ex) {
      }
      return this;
    },

    /**
     * @function resize
     *
     * Resize the mask to match cover the viewport.  This function is called
     * internally when needed, but available if you need it.
     *
     *  mask.resize();
     *
     * This function does not work well when the window becomes a smaller size.
     * Reason being, this mask itself may be preventing the pageX and pageY
     * dimensions from returning the true size of the page.
     */

    resize: function () {
      var w = this.canvas.getWidth() - this.l;
      var h = this.canvas.getHeight() - this.t;
      ecma.dom.setStyle(this.ui, 'width', w + "px");
      ecma.dom.setStyle(this.ui, 'height', h + "px");
    }

  };

  /** @namespace lsn */

  /**
   * @function showMask
   * Convenience method for displaying a generic page mask.
   *  ecma.lsn.showMask();
   *  ecma.lsn.showMask(optStyle);
   * See L<ecma.lsn.Mask.show> for more information.
   */

  this.showMask = function (style) {
    if (!_globalMask) _globalMask = new ecma.lsn.Mask();
    return _globalMask.show(style);
  };

  /**
   * @function hideMask
   * Convenience method for hiding the generic page mask.
   *  ecma.lsn.hideMask();
   */

  this.hideMask = function () {
    if (_globalMask) return _globalMask.hide();
  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var _package = this;

  /**
   * @function setMoveTarget - Static method for backward compat
   */

  _package.setMoveTarget = function (event, elem) {
    return new ecma.lsn.Move(event, elem);
  };

  /**
   * @class Move
   *
   * @param event <Event> Initiating event (usually mousedown)
   * @param target <Element|ID> DOM Element to move
   *
   * Elements which are to be move targets should not have a margin set.
   */

  var CBase = ecma.lsn.ui.Base;

  _package.Move = function CMove (event, elem) {
    CBase.apply(this);
    this.elem = ecma.dom.getElement(elem);
    this.listenOn = ecma.dom.browser.isIE ? ecma.document : ecma.window;
    if (!this.elem) return;
    this.mmEvent = new ecma.dom.EventListener(this.listenOn, 'mousemove', this.onMouseMove, this);
    this.muEvent = new ecma.dom.EventListener(this.listenOn, 'mouseup', this.onMouseUp, this);
    var vp = ecma.dom.getViewportPosition();
    ecma.dom.makePositioned(elem);
    var pointer = ecma.dom.getEventPointer(event);
    this.min_x    = vp['left'];
    this.min_y    = vp['top'];
    this.abs_x    = ecma.dom.getLeft(this.elem);
    this.abs_y    = ecma.dom.getTop(this.elem);
    this.orig_x   = ecma.util.asInt(ecma.dom.getStyle(this.elem, 'left'));
    this.orig_y   = ecma.util.asInt(ecma.dom.getStyle(this.elem, 'top'));
    this.orig_z   = ecma.dom.getStyle(this.elem, 'z-index');
    // Current position
    this.curr_x   = this.orig_x;
    this.curr_y   = this.orig_y;
    this.curr_z   = this.zIndexAlloc();
    // Mouse position
    this.orig_mx  = pointer.x;
    this.orig_my  = pointer.y;
    // Constrain movement to the visible canvas
    this.max_x = vp['left'] + vp['width'] - ecma.dom.getWidth(this.elem);
    this.max_y = vp['top'] + vp['height'] - ecma.dom.getHeight(this.elem);
    // Position element
    ecma.dom.setStyle(this.elem, 'left', this.orig_x.toString(10) + 'px');
    ecma.dom.setStyle(this.elem, 'top', this.orig_y.toString(10) + 'px');
    ecma.dom.setStyle(this.elem, 'z-index', this.curr_z);
    // Stop event after all succeeds
    ecma.dom.stopEvent(event);
    this.executeClassAction('onMoveStart');
  };

  var PMove = _package.Move.prototype = ecma.lang.createPrototype(
    CBase
  );

  PMove.onMouseUp = function (event) {
    this.mmEvent.remove();
    this.muEvent.remove();
    this.curr_z = this.orig_z;
    ecma.dom.setStyle(this.elem, 'z-index', this.curr_z);
    ecma.dom.stopEvent(event);
    this.executeClassAction('onMoveEnd');
  };

  PMove.onMouseMove = function(event) {
    // Calculate
    var pointer = ecma.dom.getEventPointer(event);
    var delta_x = pointer.x - this.orig_mx;
    var delta_y = pointer.y - this.orig_my;
    this.curr_x = this.orig_x + delta_x;
    this.curr_y = this.orig_y + delta_y;
    // Constrain
    if (this.abs_x + delta_x >= this.max_x) this.curr_x = this.max_x;
    if (this.abs_y + delta_y >= this.max_y) this.curr_y = this.max_y;
    if (this.abs_x + delta_x <  this.min_x) this.curr_x = this.min_x;
    if (this.abs_y + delta_y <  this.min_y) this.curr_y = this.min_y;
    // Apply new position
    if (this.curr_x != null) {
      ecma.dom.setStyle(this.elem, 'left', (this.curr_x).toString(10) + 'px');
    }
    if (this.curr_y != null) {
      ecma.dom.setStyle(this.elem, 'top', (this.curr_y).toString(10) + 'px');
    }
    ecma.dom.stopEvent(event);
    this.executeClassAction('onMove');
  };

  PMove.hasMoved = function () {
    return this.orig_x == this.curr_x
        && this.orig_y == this.curr_y;
  };

});

/** @namespace lsn */

ECMAScript.Extend('lsn', function (ecma) {

  var _css = null;

  /**
   * @function initDialogStyles
   */

  this.initDialogStyles = function () {
    if (_css) return;
    _css = new ecma.dom.StyleSheet();
    _css.createRule('.dlghidden', {
      'visibility':'hidden',
      'z-index':'-1',
      'position':'absolute',
      'left':'-1000em'
    });
  };

  /**
   * @function includeHead
   * Insert CSS and JS specified in response to an L<ecma.lsn.Request>
   */

  this.includeHead = function () {
    ecma.lsn.includeHeadCSS.apply(this, arguments);
    ecma.lsn.includeHeadJS.apply(this, arguments);
  };

  /**
   * @function includeHeadCSS
   */

  this.includeHeadCSS = function(head, id, caller) {
    if (head) {
      var links = head.get('links/css');
      if (links) {
        links.iterate(function (k,v) {
          ecma.dom.include.style({'href':v});
        });
      }
      var text = head.get('css');
      if (text) {
        ecma.dom.include.style({'text':text});
      }
    }
  };

  /**
   * @function includeHeadJS
   * SCRIPT elements added to the DOM are not controlled by the browser's
   * document parser.  Thus the load order is not maintained.  This routine
   * will load SCRIPT elements in order, waiting for each to complete
   * before proceeding to the next.
   *
   * When all SCRIPT elements have been loaded the optional callback parameter
   * is run under the scope of the caller parameter.
   */

  this.includeHeadJS = function(head, id, caller, cb) {
    if (head) {
      var hasLoaded = false;
      // Links - Remote script inclusion
      var links = head.get('links/js');
      if (links) {
        var list = links.values();
        var includeNext;
        includeNext = function () {
          if (list.length) {
            var uri = new ecma.http.Location(list.shift());
//          uri.addParameter('uniq', new Date().getTime());
            ecma.dom.include.script({'src':uri.getHref()}, includeNext);
          } else {
            hasLoaded = true;
          }
        }
        includeNext();
      } else {
        hasLoaded = true;
      }
      // Global JavaScript
      var text = head.get('js');
      if (text) {
        ecma.dom.include.script({'text':text});
      }
      // Blocks - JavaScript contained within anonymous closure
      var blocks = head.get('blocks/js');
      if (blocks) {
        blocks.iterate(function (i, block) {
          ecma.dom.include.script({'text': block});
        });
      }
      // Events - Shorthand for binding javascript to widget events
      var events = head.get('events/js');
      if (events) {
        events.iterate(function (target, events) {
          events.iterate(function (idx, kvpair) {
            // Bind global variables to this context
            var js = ecma;
            var window = ecma.window;
            var document = ecma.document;
            var evtFunc = ecma.lang.Callback(function () {
              eval(kvpair.get('value'));
            }, caller);
            if (target == 'dialog' || target == 'widget') {
              if (caller) {
                caller.includeEvent(kvpair.get('key'), evtFunc);
              }
            } else {
              ecma.dom.addEventListener(eval(target), kvpair.get('key'), evtFunc);
            }
          });
        });
      }
      // Now we wait for the browser to complete loading scripts
      if (cb) {
        ecma.dom.waitUntil(cb, function () {return hasLoaded;}, 10, caller);
      }
    } else {
      if (cb) cb.apply(caller);
    }
  };

  /**
   * @class Widget
   * A response comprised of HTML, JS and CSS which is not a full document.
   *
   * @param uri       <String>    Location of widget resource
   * @param options   <Object>    Options
   *
   * Where C<options> are:
   *
   *  container       <HTMLElement> Append the widget to this container.
   *                                Default is the document body.
   *
   *  refetch         <boolean>   When the widget is shown after it has been
   *                              hidden, it will be refetched from the server
   *                              if this is true.  Default is false.
   *
   * Example:
   *
   *  var w = new js.lsn.Widget('/my.html', {container: 'mydiv'});
   *  w.show({param:'value'});
   */

  this.Widget = function (uri, options) {
    ecma.lsn.initDialogStyles();
    if (!this.id) this.id = ecma.util.randomId('widget_');
    this.request = new ecma.lsn.Request(uri, {
      'onSuccess': ecma.lang.Callback(this._onSuccess, this),
      'onInternalServerError': ecma.lang.Callback(this._onFailure, this)
    });
    this.container = undefined;
    this.handleKeypress = {};
    this.sticky = false; // prevents dom detatch when hiding
    this.nodeStyles = []; // for preserving between hide and show
    this.refetch = true;
    this.events = {};
    this.includeEvents = {};
    this.props = {};
    this.jsLoaded = false;
    this.hidden = false;
    for (var k in options) {
      this.setOption(k, options[k]);
    }
    this.reset();
  };

  this.Widget.prototype = {

    reset: function() {
      this.nodes = null;
      this.values = {};
      this.btn_events = [];
      this.includeEvents = {};
      this._stopEvent = {};
      this._eventName = [];
      this.hasLoaded = false;
    },

    setOption: function(key, value) {
      if (key.match(/^on[A-Z]/)) {
        this.addEvent(key, value);
      } else {
        this[key] = value;
      }
    },

    relayEvent: function(event, name) {
      ecma.dom.stopEvent(event);
      this.doEvent(name);
    },

    addEvent: function(name, func) {
      name = name.replace(/^on/, '');
      name = name.toLowerCase();
      if(!this.events[name]) this.events[name] = new Array();
      this.events[name].push(func);
    },

    includeEvent: function(name, func) {
      name = name.replace(/^on/, '');
      name = name.toLowerCase();
      if(!this.includeEvents[name]) this.includeEvents[name] = new Array();
      this.includeEvents[name].push(func);
    },

    stopEvent: function () {
      if (!this._eventName.length) return;
      var name = this._eventName[this._eventName.length - 1];
      this._stopEvent[name] = true;
    },

    _isStopped: function (name) {
      return this._stopEvent[name];
    },

    _beginEvent: function (name) {
      this._eventName.push(name);
    },

    _endEvent: function (name) {
      delete this._stopEvent[name];
      this._eventName.pop();
    },

    doEvent: function(name) {
      this._beginEvent(name);
      //ecma.console.log('doEvent', name);
      if (this._isStopped(name)) return this._endEvent(name);
      /* Fire events defined by the widget */
      if (this.includeEvents[name]) {
        for (var i = 0; i < this.includeEvents[name].length; i++) {
          this.includeEvents[name][i].apply(this);
          if (this._isStopped(name)) return this._endEvent(name);
        }
      }
      /* Fire events defined by the caller */
      if (this.events[name]) {
        for (var i = 0; i < this.events[name].length; i++) {
          var cb = this.events[name][i];
          ecma.lang.callback(cb, this, [this]);
          if (this._isStopped(name)) return this._endEvent(name);
        }
      }
      /* Internal event handling */
      if (name == 'init') {
        // The dialog is ready after it is shown. The ready event must not 
        // happen until the the dialog's JS and CSS have been processed *and* 
        // the elements which have been added to the DOM are ready.
        ecma.dom.waitUntil(this._onInit, this._jsLoaded, 10, this, ['ready']);
      }
      if (name == 'ok' || name == 'cancel') {
        this.hide();
      }
      if (name == 'hide') {
        this.onHide();
      }
      if (name == 'load') {
        this.hasLoaded = true;
      }
      this._endEvent(name);
    },

    show: function(params) {
      this.params = params ? params : {};
      this.beforeShow();
      if (this.nodes) {
        if (this.refetch) {
          this.destroy();
          this.request.submit();
        } else {
          this._enableUI();
          this.doEvent('init');
        }
      } else {
        /* Fetch the dialog from the server */
        this.request.submit();
      }
    },

    getElementById: function (id) {
      var elem = null;
      for (var i = 0, node; node = this.nodes[i]; i++) {
        elem = ecma.dom.getDescendantById(node, id);
        if (elem) break;
      }
      return elem;
    },

    beforeShow:function(){},

    _onFailure: function(xhr) {
      this.onHide();
    },

    _onSuccess: function(r) {
      this.doc = r.responseHash;
      var tmpDiv = ecma.dom.createElement('div', {'innerHTML': this.doc.get('body')});
      this.nodes = ecma.util.args(tmpDiv.childNodes);
      this.nodes.push(ecma.dom.createElement('noscript', {id:this.id+'_dom_ready'}));
      this._appendNodes();
      this._includeRes();
      this.doEvent('init');
    },

    _appendNodes: function () {
      var ce = ecma.dom.getElement(this.container || ecma.dom.getBody());
      for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (!node.style) {
          this.nodes.splice(i--, 1);
          continue;
        }
        if (this.zIndex) {
          ecma.dom.setStyle(node, 'z-index', this.zIndex);
        }
        ce.appendChild(node);
      }
      if (this.nodes.length == 1) { // 1 b/c the _dom_ready elem is appended
        throw new Error('No element nodes found');
      }
    },

    _includeRes: function () {
      ecma.lsn.includeHeadCSS(this.doc.get('head'), this.id, this);
      ecma.dom.waitUntil(this._includeJS, this._domLoaded, 10, this);
    },

    _includeJS: function () {
      this.jsLoaded = false;
      ecma.lsn.includeHeadJS(this.doc.get('head'), this.id, this, function () {
        this.jsLoaded = true;
      });
    },

    _domLoaded: function () {
      return ecma.dom.getElement(this.id+'_dom_ready') ? true : false;
    },

    _jsLoaded: function () {
      return this.jsLoaded;
    },

    _onInit: function () {
      if (!this.hasLoaded) this.doEvent('load');
      this.doEvent('show');
      this.hidden = false;
      this.doEvent('ready');
    },

    _removeUI: function() {
      if (this.nodes) {
        for (var i = 0; i < this.nodes.length; i++) {
          ecma.dom.removeElement(this.nodes[i]);
        }
      }
    },

    _disableUI: function () {
      if (!this.sticky) return this._removeUI();
      if (this.nodes) {
        for (var i = 0; i < this.nodes.length; i++) {
          this.nodeStyles[i] = this._hideElement(this.nodes[i]);
        }
      }
    },

    _enableUI: function () {
      if (!this.sticky) return this._appendNodes();
      if (this.nodes) {
        for (var i = 0; i < this.nodes.length; i++) {
          ecma.dom.setStyles(this.nodes[i], this.nodeStyles[i]);
        }
        this.nodeStyles = [];
      }
    },

    _hideElement: function (elem) {
      var bak = {
        'visibility': ecma.dom.getStyle(elem, 'visibility'),
        'z-index': ecma.dom.getStyle(elem, 'z-index'),
        'position': ecma.dom.getStyle(elem, 'position'),
        'left': ecma.dom.getStyle(elem, 'left')
      };
      ecma.dom.setStyles(elem, {
        'visibility':'hidden',
        'z-index':'-1',
        'position':'absolute',
        'left':'-1000em'
      });
      return bak;
    },

    _showElement: function () {
    },

    hide: function() {
      if (this.hidden) return;
      this.doEvent('hide');
      this._disableUI();
      this.hidden = true;
    },

    onHide:function(){},

    destroy: function() {
      this.hide();
      this._removeUI();
      this.doEvent('destroy');
      this.reset();
    }

  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var baseClass = ecma.lsn.Widget;
  var proto = ecma.lang.Methods(baseClass);

  /**
   * @class Dialog
   */

  this.Dialog = function (uri, userOpts) {
    this.id = ecma.util.randomId('dlg_');
    var opts = {
      modal: true,
      modalOpacity: .50
    };
    ecma.util.overlay(opts, userOpts);
    baseClass.apply(this, [uri, opts]);
    this.mask = null;
  };

  this.Dialog.prototype = proto;

  /**
   * @function beforeShow
   */

  proto.beforeShow = function () {
    if (this.sticky && this.zIndex) {
      // Do not reallocate zIndex when sticky
    } else {
      this.zIndex = ecma.lsn.zIndexAlloc();
    }
    if (this.modal) {
      this.mask = new ecma.lsn.Mask();
      this.mask.show({
        'opacity':this.modalOpacity,
        'z-index':this.zIndex - 1
      });
    }
  };

  /**
   * @function onHide
   */

  proto.onHide = function () {
    if (this.modal) {
      this.mask.hide();
      this.mask = null;
    }
    ecma.lsn.zIndexFree();
  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  /**
   * @class PageLayout
   * Wrapper class for window events.
   *
   *  new PageLayout();
   *  new PageLayout(opts);
   *
   *  opts.load     Window onLoad event callback
   *  opts.resize   Window onResize event callback
   *  opts.unload   Window onUnload event callback
   *
   * The default load function calls resize so you don't have to.  This class
   * is intended to be used simply as:
   * 
   *  new PageLayout({resize: function (event) {
   *
   *    // resize page elements
   *
   *  });
   */

  this.PageLayout = function (opts) {
    ecma.util.overlay(this, opts);
    ecma.dom.addEventListener(ecma.window, 'load', this.load, this);
    ecma.dom.addEventListener(ecma.window, 'resize', this.resize, this);
    ecma.dom.addEventListener(ecma.window, 'unload', this.unload, this);
  };

  this.PageLayout.prototype = {

    /** @internal load */
    load: function (event) {
      this.resize(event);
    },

    /** @internal resize */
    resize: function (event) {
    },

    /** @internal unload */
    unload: function (event) {
    }

  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  /**
   * @class DragHandle
   * Make an element a handle for dragging.
   *
   *  var dh = new ecma.lsn.DragHandle(elem);
   *  var dh = new ecma.lsn.DragHandle(elem, opts);
   *
   * The C<opt> object may contain:
   *
   *  opts.threshold      Pixels of dragging required to start
   *  opts.onMouseDown    Callback
   *  opts.onMouseUp      Callback
   *  opts.onMouseMove    Callback
   *
   * The callback functions are passed two arguments, the C<event> and the 
   * C<this> pointer.  For example:
   *
   *  new js.lsn.DragHandle('elem-id', {
   *    'onMouseMove': function (event, dh) {
   *      js.console.log(dh.delta_x, dh.delta_y);
   *      event.stop();
   *    }
   *  };
   *
   * @member orig_mx
   * Original mouse X position
   * @member orig_my
   * Original mouse Y position
   * @member delta_x
   * Difference between original and current mouse X position
   * @member delta_y
   * Difference between original and current mouse Y position
   *
   */
  this.DragHandle = function(elem, opts) {
    this.opts = {
      'threshold': 0,
      'onMouseDown': function (event, dh) { event.stop() },
      'onMouseUp': function (event, dh) { event.stop() },
      'onMouseMove': function (event, dh) { event.stop() }
    };
    ecma.util.overlay(this.opts, opts);
    this.elem = ecma.dom.getElement(elem);
    if (!this.elem) return;
    this.listenOn = ecma.dom.browser.isIE ? ecma.document : ecma.window;
    ecma.dom.addEventListener(this.elem, 'mousedown', this.onMouseDown, this);
    this.reset();
    this.mmEvent = null;
    this.muEvent = null;
  };

  this.DragHandle.prototype = {

    /**
     * @function reset
     * Reset the internal tracking data.
     *  dh.reset();
     */
    reset: function () {
      this.orig_mx = 0;
      this.orig_my = 0;
      this.delta_x = 0;
      this.delta_y = 0;
      this.dragging = false;
    },

    onMouseDown: function (event) {
      this.reset();
      var pointer = ecma.dom.getEventPointer(event);
      this.orig_mx = pointer.x;
      this.orig_my = pointer.y;
      this.mmEvent = new ecma.dom.EventListener(this.listenOn, 'mousemove', this.onMouseMove, this);
      this.muEvent = new ecma.dom.EventListener(this.listenOn, 'mouseup', this.onMouseUp, this);
      ecma.lang.callback(this.opts.onMouseDown, this, [event, this]);
    },

    onMouseUp: function (event) {
      this.mmEvent.remove();
      this.muEvent.remove();
      this.dragging = false;
      ecma.lang.callback(this.opts.onMouseUp, this, [event, this]);
    },

    onMouseMove: function(event) {
      var pointer = ecma.dom.getEventPointer(event);
      this.delta_x = pointer.x - this.orig_mx;
      this.delta_y = pointer.y - this.orig_my;
      if (!this.dragging
          && Math.abs(this.delta_x) < this.opts.threshold
          && Math.abs(this.delta_y) < this.opts.threshold) {
        return
      }
      this.dragging = true;
      ecma.lang.callback(this.opts.onMouseMove, this, [event, this]);
    }

  };

});

ECMAScript.Extend('lsn', function (ecma) {

  _impl = {}; // implementation classes

  /* ======================================================================== */

  this.ContentController = function () {
    this.impl =
      ecma.dom.browser.isIE       ? new _impl.IE() :
      ecma.dom.browser.isGecko    ? new _impl.Gecko() : new _impl.Gecko();
    if (!this.impl) throw new Error('no ContentController implementation for this browser');
  };

  this.ContentController.prototype.attach = function (elem) {
    elem = ecma.dom.getElement(elem);
    return this.impl.attach.apply(this.impl, [elem]);
  };

  this.ContentController.prototype.detach = function () {
    return this.impl.detach.apply(this.impl, []);
  };

  this.ContentController.prototype.insertHTML = function () {
    return this.impl.insertHTML.apply(this.impl, arguments);
  };

  this.ContentController.prototype.getFocusElement = function () {
    return this.impl.getFocusElement.apply(this.impl, arguments);
  };

  this.ContentController.prototype.insertElement = function () {
    return this.impl.insertElement.apply(this.impl, arguments);
  };

  this.ContentController.prototype.selectElement = function () {
    return this.impl.selectElement.apply(this.impl, arguments);
  };

  this.ContentController.prototype.focusBefore = function () {
    return this.impl.focusBefore.apply(this.impl, arguments);
  };

  this.ContentController.prototype.focusAfter = function () {
    return this.impl.focusAfter.apply(this.impl, arguments);
  };

  this.ContentController.prototype.exec = function () {
    return this.impl.exec.apply(this.impl, arguments);
  };

  this.ContentController.prototype.toggle = function (tagName) {
    return this.impl.toggle.apply(this.impl, arguments);
  };

  /* ======================================================================== */

  _impl.Gecko = function () {
  };

  _impl.Gecko.prototype = {

    attach: function (elem) {
      this.target = elem;
      this.exec('useCSS', true); // which means no, don't use css
    },

    detach: function () {
      this.target = undefined;
    },

    getFocusElement: function () {
      var sel = this.getSelection();
      var range = sel.getRangeAt(0);
      var elem = range.commonAncestorContainer;
      while (elem && elem.nodeType != Node.ELEMENT_NODE) {
        elem = elem.parentNode;
      }
      return elem;
    },

    /**
     * @param elem to insert
     * @param focus will give the inserted element the focus
     */

    insertElement: function (elem) {
      var sel = this.getSelection();
      if (false == sel.isCollapsed) {
        sel.deleteFromDocument();
        sel = this.getSelection();
      }
      if (sel.isCollapsed) {
        var nFocus = sel.focusNode;
        var focusOffset = sel.focusOffset;
        switch (nFocus.nodeType) {
          case Node.ELEMENT_NODE:
            var nCurr = focusOffset > 0 ? nFocus.childNodes[focusOffset - 1] : nFocus;
            if (nCurr === this.target) {
              if (nCurr.childNodes.length > 0) {
                nCurr.insertBefore(elem, nCurr.childNodes[0]);
              } else {
                nCurr.appendChild(elem);
              }
            } else {
              ecma.dom.insertChildrenAfter(nCurr, [elem]);
            }
            break;
          case Node.TEXT_NODE:
            var a = nFocus.nodeValue.substr(0, focusOffset);
            var b = nFocus.nodeValue.substr(focusOffset);
            var nA = ecma.dom.createElement('#text', {'nodeValue':a});
            var nB = ecma.dom.createElement('#text', {'nodeValue':b});
            ecma.dom.insertChildrenBefore(nFocus, [nA, elem, nB]);
            nFocus.parentNode.removeChild(nFocus);
            break;
          default:
            throw new Error('no implementation for selected nodeType');
        }
        this.focusAfter(elem);
      }
    },

    selectElement: function (elem) {
      var sel = this.getSelection();
      sel.removeAllRanges();
      var range = ecma.document.createRange();
      range.selectNode(elem);
      sel.addRange(range);
      return sel;
    },

    focusBefore: function (elem) {
      sel = this.selectElement(elem);
      sel.collapseToStart();
    },

    focusAfter: function (elem) {
      sel = this.selectElement(elem);
      sel.collapseToEnd();
    },

    insertHTML: function (html) {
      this.exec('insertHTML', html);
    },

    exec: function (cmd, args) {
      ecma.document.execCommand(cmd, false, args);
    },

    toggle: function (tagName) {
    },

    getSelection: function () {
      var sel = ecma.window.getSelection();
      if (!sel.anchorNode) throw new Error('target does not have focus');
      return sel;
    },

    setSelection: function () {
    }

  };

  /* ======================================================================== */

  _impl.IE = function () {
  };

  _impl.IE.prototype = {

    attach: function (elem) {
      this.target = elem;
    },

    detach: function () {
      this.target = undefined;
    },

    getFocusElement: function () {
      var sel = this.getSelection();
      var range = sel.createRange();
      return sel.type == 'Control' ? range.item(0) : range.parentElement();
    },

    insertElement: function (elem) {
      var sel = this.getSelection();
      var tmp = this._insertTemp();
      this.replaceElement(tmp, elem);
    },

    replaceElement: function (eOld, eNew) {
      eOld.appendChild(eNew);
      eOld.removeNode();
    },

    _insertTemp: function() {
      var id = ecma.util.randomId();
      var html = "<span id='" + id + "'></span>";
      this.getRange().pasteHTML(html);
      var elem = ecma.dom.getElement(id);
      return elem;
    },

    selectElement: function (elem) {
      var range = ecma.dom.getBody().createControlRange();
      range.addElement(elem);
      range.select();
    },

    focusBefore: function (elem) {
      this.selectElement(elem);
    },

    focusAfter: function (elem) {
      this.selectElement(elem);
    },


    insertHTML: function (html) {
      this.getRange().pasteHTML(html);
    },

    exec: function (cmd, args) {
      ecma.document.execCommand(cmd, args ? false : true, args);
    },

    toggle: function (tagName) {
      var sel = ecma.document.selection;
      var ranges = sel.createRangeCollection();
      for (var i = 0; i < ranges.length; i++) {
        var textRange = ranges.item(i);
        var html = textRange.htmlText;
        if (html) {
          var re = new RegExp('\\s*<' + tagName + '>');
          if (html.match(re, 'g')) {
          } else {
          }
          textRange.pasteHTML(html);
        }
      }
    },

    getSelection: function () {
      var sel = ecma.document.selection;
//    if (sel.type == 'None') throw new Error('target does not have focus');
      return sel;
    },

    getRange: function() {
      return this.getSelection().createRange();
    }

  };

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  /**
   * @class ComboBox
   * Base class for extending an INPUT control with a drop-down list.
   *
   *  // Create a class MyClass which extends ecma.lsn.ComboBox
   *
   *  var cbox = new MyClass();
   *  cbox.attach('ctrl1'); // where ctrl1 is the ID of an input control
   *  
   * Later on, you may want to call:
   *
   *  cbox.show(); // manually open the drop-down
   *  cbox.hide(); // manually close the drop-down
   */

  this.ComboBox = function () {
    this.ctrl = ecma.dom.createElement('input');
    this.toggle = ecma.dom.createElement('img', {
      'alt': '[...]',
      'src': '/res/images/dropdown.png',
      'onClick': [this.onToggle, this],
      'style': {
        'font-size':'8pt',
        'width':'16px',
        'height':'16px',
        'cursor':'pointer',
        'vertical-align':'text-bottom'
      }
    });
    if (!this.ui) this.ui = {box:null};
    this.mask = new ecma.lsn.Mask();
    this.vUnmask = new ecma.dom.EventListener(
      this.mask.getElement(), 'click', this.hide, this);
  };

  var proto = this.ComboBox.prototype = {};

  proto.destroy = function () {
    this.vUnmask.remove();
  };

  /**
   * @function attach
   * Attach to an input control.
   *  cbox.attach('ctrl1');
   * This will append an IMG element to the dom which functions as the drop-
   * down button for the control.
   */

  proto.attach = function (elem) {
    var ctrl = ecma.dom.getElement(elem);
    ecma.dom.insertAfter(this.toggle, ctrl);
    ecma.dom.addClassName(ctrl, 'combo');
    this.ctrl = ctrl;
  };

  proto.setPosition = function () {
    var box = this.getElement();
    ecma.dom.setStyle(box, 'top', ecma.dom.getBottom(this.ctrl) + 'px');
    ecma.dom.setStyle(box, 'left', ecma.dom.getLeft(this.ctrl) + 'px');
    ecma.dom.setStyle(box, 'width', (ecma.dom.getWidth(this.ctrl)) + 'px');
  };

  /**
   * @function show
   * Show the drop-down.
   *  cbox.show();
   */

  proto.show = function () {
    this.setPosition();
    var zIndex = ecma.lsn.zIndexAlloc();
    ecma.dom.setStyle(this.ui.box, 'z-index', zIndex);
    ecma.dom.setAttribute(this.ctrl, 'disabled', 'disabled');
    this.mask.show({
      'opacity':0,
      'z-index':zIndex - 1
    });
    ecma.dom.setStyle(this.ui.box, 'visibility', 'visible');
    ecma.dom.getBody().appendChild(this.ui.box);
    var boxBottom = ecma.dom.getBottom(this.ui.box);
    var vpHeight = ecma.dom.getViewportPosition().height;
    if (boxBottom > vpHeight) {
      this.ui.tmpBottomMargin = ecma.dom.createElement('div', {
        'style': {
          'position': 'relative',
          'height': ((boxBottom - vpHeight) + 50) + 'px'
        }
      });
      ecma.dom.getBody().appendChild(this.ui.tmpBottomMargin);
    }
    this.isVisible = true;
  };

  /**
   * @function hide
   * Hide the drop-down.
   *  cbox.hide();
   */

  proto.hide = function () {
    ecma.dom.removeAttribute(this.ctrl, 'disabled', 'disabled');
    ecma.dom.setStyle(this.ui.box, 'visibility', 'hidden');
    ecma.dom.removeElement(this.ui.box);
    ecma.lsn.zIndexFree();
    this.mask.hide();
    this.isVisible = false;
    if (this.ui.tmpBottomMargin) {
      ecma.dom.removeElement(this.ui.tmpBottomMargin);
      this.ui.tmpBottomMargin = null;
    }
  };

  proto.onToggle = function (event) {
    ecma.dom.stopEvent(event);
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  };

  proto.getElement = ecma.lang.createAbstractFunction();

});

/** @namespace lsn */
ECMAScript.Extend('lsn', function (ecma) {

  var CActionDispatcher = ecma.action.ActionDispatcher;
  var proto = ecma.lang.createPrototype(CActionDispatcher);

  /**
   * @class InputListener
   */

  this.InputListener = function (elem) {
    CActionDispatcher.apply(this);
    this.elem = ecma.dom.getElement(elem);
    this.setValue();
    this.events = [
      new ecma.dom.EventListener(elem, 'keydown', this.onKeyDown, this),
      new ecma.dom.EventListener(elem, 'focus', this.checkValue, this),
      new ecma.dom.EventListener(elem, 'blur', this.checkValue, this),
      new ecma.dom.EventListener(elem, 'propertychange', this.checkValue, this)
    ];
    this.checkInterval = 75;
    this.checkTimeout = 10 * this.checkInterval;
    this.checkCount = 0;
  };

  this.InputListener.prototype = proto;

  proto.setValue = function () {
    this.currentValue = ecma.dom.getValue(this.elem);
  };

  proto.onKeyDown = function (event) {
    if (this.intervalId) return;
    this.intervalId = ecma.dom.setInterval(this.checkValue, 
      this.checkInterval, this);
  };

  proto.checkValue = function () {
//  ecma.console.log('check value');
    var value = ecma.dom.getValue(this.elem);
    if (this.currentValue != value) {
      this.clearInterval();
      var prevValue = this.currentValue;
      this.setValue();
      this.dispatchAction('change', this.currentValue, prevValue);
    } else {
      this.checkCount++;
      if ((this.checkInterval * this.checkCount) > this.checkTimeout) {
//      ecma.console.log('-timeout');
        this.clearInterval();
      }
    }
  };

  proto.clearInterval = function () {
//  ecma.console.log('-clear');
    ecma.dom.clearInterval(this.intervalId);
    this.intervalId = null;
    this.checkCount = 0;
  };

  /**
   * @function destroy
   */

  proto.destroy = function () {
    this.clearInterval();
    for (var i = 0; i < this.events.length; i++) {
      try {
        this.events[i].remove();
      } catch (ex) {
      }
    }
    this.events = [];
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @function getAnchorsByRel
   *
   * DEPRECATED, instead use:
   *
   *  js.dom.selectElements("A[rel=" + name + "]", rootNode);
   */

  this.getAnchorsByRel = function (rootNode, name) {
    var links = ecma.dom.getElementsByTagName(rootNode, 'A');
    var result = [];
    for (var i = 0, node; node = links[i]; i++) {
      var rel = ecma.dom.getAttribute(node, 'rel');
      if (rel == name) {
        result.push(node);
      }
    }
    return result;
  };

  /**
   * @function findNode
   */

  this.findNode = function (node, cb) {
    if (!ecma.dom.node.isElement(node)) return null;
    var n = node.firstChild;
    while (n) {
      if (ecma.lang.callback(cb, null, [n])) return n;
      var r = ecma.dom.findNode(n, cb);
      if (r) return r;
      n = n.nextSibling;
    }
    return null;
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @class LocationListener
   * Watches the document location href and dispatches a change event.
   *
   *  var ll = new ecma.dom.LocationListener();  // starts polling immediately
   *
   *  ll.addActionListener('change', func);
   *  ll.addActionListener('change', func, scope);
   *  ll.addActionListener('change', func, scope, args);
   *
   * The check interval is 75ms.
   *
   * This class allows one to be notified when the document location changes.
   * Implemented because there is no C<onLocationChange> event.  Enables a
   * callback when only the C<hash> portion of the location is changing.
   */

  var CActionDispatcher = ecma.action.ActionDispatcher;
  var proto = ecma.lang.createPrototype(CActionDispatcher);

  this.LocationListener = function () {
    CActionDispatcher.apply(this);
    this.checkInterval = 75;
    this.setLocation();
    this.intervalId = ecma.dom.setInterval(this.checkLocation, 
      this.checkInterval, this);
  };

  this.LocationListener.prototype = proto;

  proto.setLocation = function () {
    this.currentHref = ecma.document.location.href;
    this.currentLocation = new ecma.http.Location();
  };

  proto.checkLocation = function () {
    var href = ecma.document.location.href;
    if (this.currentHref != href) {
      var prevLocation = this.currentLocation;
      this.setLocation();
      this.dispatchAction('change', this.currentLocation, prevLocation);
    }
  };

  proto.destroy = function () {
    ecma.dom.clearInterval(this.intervalId);
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * @class KeyListener
   * Keypress listener
   *
   *  var kl = new ecma.dom.KeyListener(elem, key, func);
   *  var kl = new ecma.dom.KeyListener(elem, key, [cb]);
   *  var kl = new ecma.dom.KeyListener(elem, key, func, scope);
   *  var kl = new ecma.dom.KeyListener(elem, key, func, scope, args);
   *  ...
   *  kl.destroy(); // detaches events
   */

  var CKeyPress = ecma.dom.KeyPress;

  this.KeyListener = function (elem, key, func, scope, args) {
    CKeyPress.call(this);
    this.elem = ecma.dom.getElement(elem);
    this.key = key;
    this.cb = ecma.lang.createCallbackArray(func, scope, args);
    this.attach(this.elem);
  };

  var proto = this.KeyListener.prototype = ecma.lang.createPrototype(
    CKeyPress
  );

  proto.getHandlers = function (seq) {
    var match = false;
    if (typeof(this.key) == 'function') {
      match = ecma.lang.callback(this.key, null, [seq]);
    } else {
      match = seq.numeric == this.key || seq.ascii == this.key;
    }
    return match ? [this.cb] : undefined;
  };

  proto.remove = function () {
    this.detach();
  };

  proto.destroy = function () {
    this.remove();
  };

});

/** @namespace dom */
ECMAScript.Extend('dom', function (ecma) {

  /**
   * ACCEPT_TAGS - Tag names of acceptable elements.
   *
   * Any element with a tag name which is NOT in this list will be removed (and 
   * so will its children).
   *
   * This of course is DOCTYPE specific, however the below list is HTML 4.01.
   */

  var ACCEPT_TAGS = [
    'A',
    'ABBR',
    'ACRONYM',
    'ADDRESS',
    'B',
    'BDO',
    'BIG',
    'BLOCKQUOTE',
    'BR',
    'BUTTON',
    'CAPTION',
    'CENTER',
    'CITE',
    'CODE',
    'COL',
    'COLGROUP',
    'DD',
    'DEL',
    'DFN',
    'DIV',
    'DL',
    'DT',
    'EM',
    'FONT',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HR',
    'I',
    'IMG',
    'INS',
    'KBD',
    'LABEL',
    'LI',
    'OL',
    'OPTGROUP',
    'OPTION',
    'P',
    'PRE',
    'Q',
    'S',
    'SAMP',
    'SMALL',
    'SPAN',
    'STRIKE',
    'STRONG',
    'SUB',
    'SUP',
    'TABLE',
    'TBODY',
    'TD',
    'TFOOT',
    'TH',
    'THEAD',
    'TR',
    'TT',
    'U',
    'UL',
    'VAR'
  ];

  /**
   * EMPTY_TAGS - Tag names of elements which are allowed to not have children.
   *
   * Any element which is not in this list, and has no child nodes will be
   * removed.
   */

  var EMPTY_TAGS = [
    'BR',
    'IMG',
    'INPUT',
    'TBODY',
    'TD',
    'TFOOT',
    'TH',
    'THEAD',
    'TR',
  ];

  /**
   * REMOVE_TAGS - Tag names which should not be used.
   *
   * Any element with a tag name which is in this list will be removed, however
   * its children will remain.  Note that any tag name in this list must first
   * be accepted (see ACCEPT_TAGS).
   */

  var REMOVE_TAGS = [
    'FONT',
    'SPAN',
    'LABEL'
  ];

  /**
   * REMAP_TAG_MAP - Tag names which should be remapped.
   *
   * Any element with a tag name which is a key in this hash will be replaced
   * with an element of the corresponding value.  Child nodes will be adopted.
   */

  var REMAP_TAG_MAP = {
    'STRONG': 'B',
    'EM': 'I'
  };

  var REMAP_TAGS = [];
  for (var tag in REMAP_TAG_MAP) {
    REMAP_TAGS.push(tag);
  }

  /**
   * PRESERVE_WS_TAGS - Tag names of elements where whitespace matters.
   *
   * The nodeValue of any text node within an element whose tag name is not in 
   * this list will undergo the substition s/\s+/ /g.
   *
   * In other words, white-space is removed from inside all elements unless 
   * they are listed here.
   */

  var PRESERVE_WS_TAGS = [
    'CODE',
    'PRE',
    'TEXTAREA',
    'TT'
  ];

  /**
   * DENY_INBREEDING - Tag names of elements which should not be descendants of 
   * themselves.
   */

  var DENY_INBREEDING = [
    'A',
    'ABBR',
    'ACRONYM',
    'ADDRESS',
    'B',
    'BDO',
    'BIG',
    'BR',
    'BUTTON',
    'CAPTION',
    'CENTER',
    'CITE',
    'CODE',
    'DEL',
    'DFN',
    'EM',
    'FONT',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HR',
    'I',
    'IMG',
    'INS',
    'KBD',
    'LABEL',
    'OPTION',
    'P',
    'PRE',
    'Q',
    'S',
    'SAMP',
    'SMALL',
    'STRIKE',
    'STRONG',
    'SUB',
    'SUP',
    'TT',
    'U',
    'VAR'
  ];

  /**
   * ACCEPT_STYLES - Inline style attributes which will be preserved.
   *
   * Any style which is not in this list will be removed.
   */

  var ACCEPT_STYLES = [
//  'color',
    'align',
    'clear'
  ];

  /**
   * DENY_ATTRS - Element attributes which will be removed.
   */

  var DENY_ATTRS = [
//  'id',
    'class'
  ];

  this.Scrubber = function (js) {
    this.js = js;
  }

  var Scrubber = this.Scrubber.prototype = ecma.lang.createPrototype();

  Scrubber.scrub = function (elem) {
    return this.collapse(this.clean(elem));
  };

  Scrubber.clean = function (elem) {
    var node = elem.firstChild;
    while (node) {
      var next = node.nextSibling;
      switch (node.nodeType) {
        case ecma.dom.constants.ELEMENT_NODE:
          if (!ecma.util.grep(node.tagName, ACCEPT_TAGS)) {
            // Remove nodes which we don't accept
            ecma.console.log('removeChild', node.tagName, '(do not accept)');
            elem.removeChild(node);
            break;
          }
          if (!node.childNodes.length && !ecma.util.grep(node.tagName, EMPTY_TAGS)) {
            // Remove empty nodes
            ecma.console.log('removeChild', node.tagName, '(is empty and content is required)');
            elem.removeChild(node);
            break;
          }
          if (ecma.util.grep(node.tagName, REMOVE_TAGS)) {
            // Remove node wrappers
            next = node.firstChild;
            this.js.dom.removeElementOrphanChildren(node);
            ecma.console.log('removeChild', node.tagName, '(remove this wrapper)');
            break;
          }
          if (ecma.util.grep(node.tagName, REMAP_TAGS)) {
            var newTag = REMAP_TAG_MAP[node.tagName];
            var newNode = this.js.dom.createElement(newTag);
            this.js.dom.insertAfter(newNode, node);
            this.js.dom.appendChildren(newNode, node.childNodes);
            this.js.dom.removeElement(node);
            node = newNode;
          }
          // Scrub children
          this.clean(node);
          // Remove attributes
          for (var i = 0, attr; attr = DENY_ATTRS[i]; i++) {
            this.js.dom.removeAttribute(node, attr);
          }
          // Scrub styles
          this.scrubStyles(node);
          break;
        case ecma.dom.constants.TEXT_NODE:
/*
 * TODO - Only when prev/next siblings are BLOCK level elements. Because for 
 * instnace, the space matters here:
 *
 *        <b>Hello</b> <i>World</i>
 *
          if (node.nodeValue.match(/^\s*$/)
              && (node === elem.firstChild || ecma.dom.node.isElement(node.previousSibling))
              && (node === elem.lastChild || ecma.dom.node.isElement(node.nextSibling))) {
            // Remove ws nodes between elements
            ecma.console.log('removeChild', '#text', '(ws between elems)');
            this.js.dom.removeElement(node);
            break;
          }
*/
          if (this.wsMatters(node)) {
            // Retain node as is
            break;
          }
          // Condense ws inside text nodes
          node.nodeValue = node.nodeValue.replace(/\s+/g, ' ');
          if (node.nodeValue) {
            // Retain nodes with content
            break;
          }
        default:
          // Remove nodes which didn't pass the previous checks
          ecma.console.log('removeChild', node.tagName, '(did not pass)');
          elem.removeChild(node);
      }
      node = next;
    }
    return elem;
  };

  Scrubber.scrubStyles = function (elem) {
    var styles = {};
    for (var i = 0, name; name = ACCEPT_STYLES[i]; i++) {
      var value = elem.style[name];
      if (ecma.util.defined(value)) {
        styles[name] = value;
      }
    }
    var styleAttr = this.js.dom.getAttribute(elem, 'style');
    this.js.dom.removeAttribute(elem, 'style');
    for (var name in styles) {
      var value = styles[name];
      if (value || value == '0') {
        this.js.dom.setStyle(elem, name, styles[name]);
      }
    }
    var styleAttr2 = this.js.dom.getAttribute(elem, 'style');
    if (styleAttr != styleAttr2) {
      ecma.console.log('scrubStyles', '"'+styleAttr+'"', '-->', '"'+styleAttr2+'"');
    }
  };

  Scrubber.wsMatters = function (node) {
    if (ecma.dom.node.isElement(node.previousSibling) ||
        ecma.dom.node.isElement(node.nextSibling)) {
      // e.g., <p><b>bold</b> <i>italic</i></p>
      return true;
    }
    var pNode = node.parentNode;
    while (pNode) {
      if (ecma.util.grep(pNode.tagName, PRESERVE_WS_TAGS)) return true;
      if (pNode.parentNode === pNode) break;
      pNode = pNode.parentNode;
    }
    return false;
  };

  Scrubber.collapse = function (elem, stack) {
    if (!stack) stack = new this.NodeStack();
    stack.push(elem);
    var node = elem.firstChild;
    while (node) {
      var next = node.nextSibling;
      if (stack.isAllowed(node)) {
        this.collapse(node, stack);
      } else {
        ecma.console.log('collapse', stack.toString(), node.tagName);
        var referenceNode = elem.nextSibling;
        if (referenceNode) {
          while (node) {
            next = node.nextSibling;
            js.dom.insertBefore(node, referenceNode);
            node = next;
          }
        } else {
          referenceNode = elem;
          while (node) {
            next = node.nextSibling;
            js.dom.insertAfter(node, referenceNode);
            referenceNode = node;
            node = next;
          }
        }
        break;
      }
      node = next;
    }
    stack.pop();
    return elem;
  };

  /**
   * @class NodeStack
   */

  Scrubber.NodeStack = function () {
    this.stack = [];
  };

  var NodeStack = Scrubber.NodeStack.prototype = ecma.lang.createPrototype();

  NodeStack.push = function (elem) {
    return this.stack.push(elem);
  };

  NodeStack.pop = function () {
    return this.stack.pop();
  };

  NodeStack.toString = function () {
    var tagNames = [];
    for (var i = 0, node; node = this.stack[i]; i++) {
      switch (node.nodeType) {
        case ecma.dom.constants.ELEMENT_NODE:
          tagNames.push(node.tagName);
          break;
        case ecma.dom.constants.TEXT_NODE:
          tagNames.push('#TEXT');
          break;
        default:
          tagNames.push('#OTHER');
      }
    }
    return tagNames.join('>');
  };

  NodeStack.isAllowed = function (child) {
    for (var i = 0, node; node = this.stack[i]; i++) {
      if (!ecma.dom.node.isElement(node)) continue;
      if (this.canContain(node, child)) continue;
      return false;
    }
    return true;
  };

  NodeStack.canContain = function (node, child) {
    return node.tagName == child.tagName
      && ecma.util.grep(node.tagName, DENY_INBREEDING) ? false : true
  };

});

/** @namespace lsn.auth */
ECMAScript.Extend('lsn.auth', function (ecma) {

  var _basic_auth_token = null;

  /**
   * @function setAuthToken
   */

  this.setAuthToken = function (tk) {
    _basic_auth_token = tk;
  };

  /**
   * @function getAuthToken
   */

  this.getAuthToken = function () {
    if (_basic_auth_token === null) {
      var nodeList = ecma.document.head.getElementsByTagName('META');
      for (var i = 0, node; node = nodeList[i]; i++) {
        if (ecma.dom.getAttribute(node, 'name') == 'auth-token') {
          _basic_auth_token = ecma.dom.getAttribute(node, 'content');
          break;
        }
      }
    }
    return _basic_auth_token ? _basic_auth_token : '';
  };

  /**
   * @function basic
   */

  this.basic = function (un, pw) {
    var h1 = ecma.crypt.hex_sha1(pw);
    var h2 = ecma.crypt.hex_sha1(h1 + ':' + _basic_auth_token);
    return {'un': un, 'h2': h2};
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var UI_STATE_DEFAULT = 1;
  var UI_STATE_AUTHENTICATING = 2;
  var UI_STATE_AUTHENTICATED = 3;
  var UI_STATE_FAILED = 4;

  /**
   * @class LoginDialog
   */

  this.LoginDialog = function (dlgUri, loginUri) {
    this.ui = {};
    this.dlgUri = dlgUri || '/res/login/login.dlg';
    this.loginUri = loginUri || '/res/login/module.pm/login';
    this.dlg = new ecma.lsn.Dialog(this.dlgUri, {refetch: false});
    this.dlg.addEvent('load', [this.onLoad, this]);
    this.dlg.addEvent('show', [this.onShow, this]);
    this.dlg.addEvent('ok', [this.onOk, this]);
    this.dlg.addEvent('cancel', [this.onCancel, this]);
    this.dlg.addEvent('destroy', [this.onDestroy, this]);
    this.req = new ecma.lsn.Request(this.loginUri);
    this.req.addEventListener('success', this.onSuccess, this);
    this.req.addEventListener('failure', this.onFailure, this);
  };
  var proto = {};
  this.LoginDialog.prototype = proto;

  /**
   * @function show
   */

  proto.show = function (params) {
    this.dlg.show(params);
  };

  /**
   * @function hide
   */

  proto.hide = function () {
    this.dlg.hide();
  };

  proto.onLoad = function () {
    this.ui.un = this.dlg.getElementById('un');
    this.ui.pw = this.dlg.getElementById('pw');
    this.ui.msg = this.dlg.getElementById('msg');
    this.ui.btnbar = this.dlg.getElementById('btnbar');
    this.ui.btnOk = this.dlg.getElementById('btn_ok');
    this.ui.btnCancel = this.dlg.getElementById('btn_cancel');
    this.ui.kbUnEnter = new ecma.dom.KeyListener(this.ui.un, 'enter', this.onEnter, this);
    this.ui.kbPwEnter = new ecma.dom.KeyListener(this.ui.pw, 'enter', this.onEnter, this);
  };

  proto.enableButtons = function () {
    ecma.dom.removeAttribute(this.ui.un, 'readonly');
    ecma.dom.removeAttribute(this.ui.pw, 'readonly');
    ecma.dom.removeAttribute(this.ui.btnOk, 'disabled');
    ecma.dom.removeAttribute(this.ui.btnCancel, 'disabled');
  };

  proto.disableButtons = function () {
    ecma.dom.setAttribute(this.ui.un, 'readonly', 'readonly');
    ecma.dom.setAttribute(this.ui.pw, 'readonly', 'readonly');
    ecma.dom.setAttribute(this.ui.btnOk, 'disabled', 'disabled');
    ecma.dom.setAttribute(this.ui.btnCancel, 'disabled', 'disabled');
  };

  proto.updateUI = function (state) {
    if (state == UI_STATE_DEFAULT) {
      this.enableButtons();
      ecma.dom.setValue(this.ui.msg, '');
      ecma.dom.setClassName(this.ui.msg, 'authenticating');
      if (this.ui.cont) {
        ecma.dom.removeElement(this.ui.cont);
        delete this.ui.cont;
        this.ui.btnbar.appendChild(this.ui.btnCancel);
        this.ui.btnbar.appendChild(this.ui.btnOk);
      }
    } else if (state == UI_STATE_AUTHENTICATING) {
      this.disableButtons();
      ecma.dom.setClassName(this.ui.msg, 'authenticating');
      ecma.dom.setValue(this.ui.msg, 'Authenticating...');
    } else if (state == UI_STATE_FAILED) {
      this.enableButtons();
      ecma.dom.setValue(this.ui.msg, 'Login incorrect');
      ecma.dom.setClassName(this.ui.msg, 'failed');
    } else if (state == UI_STATE_AUTHENTICATED) {
      ecma.dom.setClassName(this.ui.msg, 'authenticated');
      ecma.dom.setValue(this.ui.msg, 'Success');
    } else {
      throw new Error('Unknown ui state: ' + state);
    }
  };

  proto.onShow = function () {
    ecma.dom.setValue(this.ui.un, '');
    ecma.dom.setValue(this.ui.pw, '');
    ecma.dom.setValue(this.ui.msg, '');
    this.updateUI(UI_STATE_DEFAULT);
    this.ui.un.focus();
  };

  proto.onEnter = function (event) {
    js.dom.stopEvent(event);
    this.onOk();
  };

  proto.onOk = function () {
    this.dlg.stopEvent();
    this.updateUI(UI_STATE_AUTHENTICATING);
    var un = ecma.dom.getValue(this.ui.un);
    var pw = ecma.dom.getValue(this.ui.pw);
    this.req.submit(ecma.lsn.auth.basic(un, pw));
  };

  proto.onCancel = function () {
    this.goNext(this.dlg.params.onCancel, this.dlg.params.onCancelUri);
  };

  proto.onDestroy = function () {
    this.ui.kbUnEnter.destroy();
    this.ui.kbPwEnter.destroy();
  };

  proto.onSuccess = function () {
    this.updateUI(UI_STATE_AUTHENTICATED);
    this.goNext(this.dlg.params.onSuccess, this.dlg.params.onSuccessUri);
  };

  proto.goNext = function (cb, uri) {
    if (cb) {
      this.hide();
      ecma.lang.callback(cb, this.dlg);
    } else if (uri) {
      var loc = new ecma.http.Location(uri);
      ecma.lang.assert(loc.isSameOrigin());
      if (false && ecma.dom.browser.isIE) {
        // Because in IE setting the document location via JavaScript
        // does not set the Referer header.
        // See: http://connect.microsoft.com/IE/feedback/ViewFeedback.aspx?FeedbackID=379975
        this.ui.cont = ecma.dom.createElement('a', {
          'href': loc.getUri(),
          'innerHTML': 'Continue'
        });
        ecma.dom.removeElement(this.ui.btnCancel);
        ecma.dom.removeElement(this.ui.btnOk);
        this.ui.btnbar.appendChild(this.ui.cont);
        this.ui.cont.focus();
      } else {
        if (ecma.document.location.href == loc.getUri()) {
          ecma.document.location.reload();
        } else {
          ecma.document.location.replace(loc.getUri());
        }
      }
    } else {
      this.hide();
    }
  };

  proto.onFailure = function (req) {
    var resp = req.xhr.responseText;
    var match = req.xhr.responseText.match(/nonce=([^;]+);/);
    if (match[1]) js.lsn.auth.setAuthToken(match[1]);
    ecma.dom.setValue(this.ui.pw, '');
    this.updateUI(UI_STATE_FAILED);
  };

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  /**
   * @function createEffect
   */

  this.createEffect = function () {
    var args = ecma.util.args(arguments);
    var name = args.shift().toLowerCase();
    var klass = null;
    for (var key in ecma.fx.effects) {
      if (key.toLowerCase() == name) {
        klass = ecma.fx.effects[key];
        break;
      }
    }
    if (!klass) throw new Error('No such effect class');
    return ecma.lang.createObject(klass, args);
  };

  /**
   * @function perform
   */

  this.perform = function () {
    var args = ecma.util.args(arguments);
    var effect = ecma.fx.createEffect.apply(null, args.shift());
    var cb = args.length ? [ecma.fx.perform, null, args] : null;
    effect.start(cb);
  };

  /**
   * @structure effects
   * The namespace ecma.fx.effects is used as a structure.
   */

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  var proto = {};

  /**
   * @class Effect
   */

  this.Effect = function (delta, duration) {
    this.fxDelta = delta;
    this.fxRate = 1000; // fallback
    this.fxInterval = 25; // for stand-alone playback
    this.fxDuration = duration;
    this.fxListeners = null;
    this.fxAnimator = null;
  };

  this.Effect.prototype= proto;

  /**
   * @function getDelta
   */

  proto.getDelta = function () {
    return this.fxDelta;
  };

  /**
   * @function getDuration
   */

  proto.getDuration = function () {
    return this.fxDuration;
  };

  /**
   * @function setDuration
   */

  proto.setDuration = function (duration) {
    return this.fxDuration = duration;
  };

  /**
   * @function start
   */

  proto.start = function (cb) {
    if (!this.fxDuration) {
      this.setDuration((this.getDelta() / this.fxRate) * 1000);
    }
    this.cb = cb;
    this.setAnimator(new ecma.fx.Animator(this.fxInterval, this.fxDuration));
    this.getAnimator().start();
    return this;
  };

  /**
   * @function stop
   */

  proto.stop = function () {
    this.removeAnimator();
  };

  /**
   * @function getAnimator
   */

  proto.getAnimator = function () {
    return this.fxAnimator;
  };

  /**
   * @function setAnimator
   */

  proto.setAnimator = function (ani) {
    if (this.fxListeners) this.removeAnimator();
    this.fxListeners = {};
    this.fxListeners.onFirst = ani.addActionListener('onFirst', this.onFirst, this);
    this.fxListeners.onNext = ani.addActionListener('onNext', this.onNext, this);
    this.fxListeners.onLast = ani.addActionListener('onLast', this.onLast, this);
    return this.fxAnimator = ani;
  };

  /**
   * @function removeAnimator
   */

  proto.removeAnimator = function () {
    try {
      this.fxListeners.onFirst.remove();
      this.fxListeners.onNext.remove();
      this.fxListeners.onLast.remove();
    } catch (ex) {
      // Not reported
    } finally {
      this.fxListeners = null;
      this.fxAnimator = null;
    }
  };

  /**
   * @function onFirst
   */

  proto.onFirst = function (action, progress) {
    this.draw(action, progress);
  };

  /**
   * @function onNext
   */

  proto.onNext = function (action, progress) {
    this.draw(action, progress);
  };

  /**
   * @function onLast
   */

  proto.onLast = function (action, progress) {
    this.draw(action, progress);
    if (this.cb) {
      var cb = this.cb;
      this.cb = null;
      ecma.lang.callback(cb);
    }
  };

  /**
   * @function draw
   */

  proto.draw = ecma.lang.createAbstractFunction();

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  var CActionDispatcher = ecma.action.ActionDispatcher;

  var proto = ecma.lang.createPrototype(CActionDispatcher);

  /**
   * @class Sequencer
   */

  this.Sequencer = function (interval, loop) {
    CActionDispatcher.apply(this);
    this.seqEvents = {}; // event handles
    this.seqItems = []; // the sequence
    this.seqInterval = interval; // milliseconds
    this.seqAutoAdvance = null; // 1=forward, -1=backward
    this.seqBlocking = false; // semiphore
    this.seqIndex = -1; // array index of current item
  };

  this.Sequencer.prototype = proto;

  proto.createActionEvent = function (name) {
    return new ecma.fx.SequencerEvent(name, this);
  };

  proto.isValid = function () {
    return this.seqItems.length > 0;
  };

  proto.isValidIndex = function (idx) {
    return 0 <= this.seqIndex && this.seqIndex < this.seqItems.length;
  };

  proto.setInterval = function (ms) {
    return this.seqInterval = ms;
  };

  proto.getInterval = function () {
    return ecma.util.defined(this.seqInterval) ? this.seqInterval : 0;
  };

  proto.getIndex = function () {
    return this.seqIndex;
  };

  proto.addItem = function (item) {
    return this.seqItems.push(item);
  };

  proto.getItem = function (idx) {
    return this.seqItems[idx];
  };

  proto.removeItem = function (item) {
    var idx = -1;
    for (var i = 0; i < this.seqItems.length; i++) {
      if (this.seqItems[i] === item) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      return this.seqItems.splice(idx, 1);
    }
  };

  proto.start = function () {
    this.executeAction('start');
    this.seqAutoAdvance = 1;
    return this.autoAdvance();
  };

  proto.prev = function () {
    if (this.seqAutoAdvance) {
      this.seqAutoAdvance = -1;
      return this.autoAdvance()
    } else {
      this.select(this.seqIndex - 1);
    }
  };

  proto.next = function () {
    if (this.seqAutoAdvance) {
      this.seqAutoAdvance = 1;
      return this.autoAdvance()
    } else {
      this.select(this.seqIndex + 1);
    }
  };

  proto.autoAdvance = function () {
    this.select(this.seqIndex + this.seqAutoAdvance);
    return this;
  };

  proto.select = function (idx) {
    if (!this.isValid() || this.seqBlocking) return;
    if (this.seqIndex == idx) return;
    ecma.dom.clearTimeout(this.seqEvents.tid);
    // Loop if necessary
    if (idx + 0 != idx) {
      throw new Error('Invalid index');
    }
    try {
      // Deselect current
      this.seqBlocking = true;
      if (this.isValidIndex(this.seqIndex)) {
        this.executeAction('deselect', this.getItem(this.seqIndex), this.seqIndex);
      }
    } finally {
      this.seqBlocking = false;
    }
    if (idx < 0) {
      return this.loop(this.seqItems.length - 1);
    } else if (idx >= this.seqItems.length) {
      return this.loop(0);
    }
    try {
      // Select
      this.seqBlocking = true;
      this.seqIndex = idx;
      this.executeAction('select', this.getItem(this.seqIndex), this.seqIndex);
    } finally {
      this.seqBlocking = false;
    }
    if (this.seqAutoAdvance) {
      this.seqEvents.tid = ecma.dom.setTimeout(this.autoAdvance, this.getInterval(), this);
    }
    return this;
  }

  proto.loop = function (idx) {
    this.select(idx);
  };

  proto.stop = function () {
    this.seqAutoAdvance = null;
    this.dispatchAction('stop');
    return this;
  };

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  var CActionEvent = ecma.action.ActionEvent;

  var proto = ecma.lang.createPrototype(CActionEvent);

  /**
   * @class SequencerEvent
   */

  this.SequencerEvent = function (name, dispatcher) {
    CActionEvent.apply(this, arguments);
  };

  this.SequencerEvent.prototype = proto;

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  var CActionDispatcher = ecma.action.ActionDispatcher;

  var proto = ecma.lang.createPrototype(CActionDispatcher);

  /**
   * @class Animator
   */

  this.Animator = function (interval, duration) {
    CActionDispatcher.apply(this);
    this.aniEvents = {};
    this.aniEffects = [];
    this.aniDuration = duration; // milliseconds
    this.aniInterval = interval || 25; // milliseconds
    this.aniBlocking = true;
    this.aniProgress = null;
  };

  this.Animator.prototype = proto;

  function next() {
    if (!this.isRunning()) return;
    if (this.aniBlocking) return;
    this.aniBlocking = true;
    this.aniProgress.update();
    try {
      if (this.aniProgress.isComplete()) {
        this.executeAction('last', this.aniProgress);
        this.stop();
      } else {
        this.executeAction('next', this.aniProgress);
      }
    } finally {
      this.aniBlocking = false;
    }
    return this;
  }

  /**
   * @function isRunning
   */

  proto.isRunning = function () {
    return this.aniEvents.iid && true;
  };

  /**
   * @function setDuration
   */

  proto.setDuration = function (duration) {
    if (this.isRunning()) throw new Error('Cannot update duration while running');
    this.aniDuration = duration;
  };

  /**
   * @function addEffect
   */

  proto.addEffect = function (arg1) {
    var effect = ecma.util.isObject(arg1)
      ? arg1
      : ecma.fx.createEffect.apply(null, arguments);
    effect.setAnimator(this);
    this.aniEffects.push(effect)
    return effect;
  };

  /**
   * @function removeEffect
   */

  proto.removeEffect = function (effect) {
    var idx = -1;
    for (var i = 0; i < this.aniEffects.length; i++) {
      if (this.aniEffects[i] === effect) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      var effect = this.aniEffects[idx];
      effect.removeAnimator();
      this.aniEffects.splice(idx, 1);
    }
  };

  /**
   * @function start
   */

  proto.start = function (cb) {
    /*
    for (var i = 0; i < this.aniEffects.length; i++) {
      this.aniEffects[i].setDuration(this.aniDuration);
    }
    */
    this.executeAction('start');
    this.aniProgress = new ecma.fx.AnimatorProgress(this.aniInterval, this.aniDuration);
    this.aniEvents.iid = ecma.dom.setInterval(next, this.aniInterval, this);
    this.executeAction('first', this.aniProgress);
    this.aniBlocking = false;
    return this;
  };

  /**
   * @function stop
   */

  proto.stop = function () {
    if (this.aniEvents.iid) {
      this.aniBlocking = true;
      ecma.dom.clearInterval(this.aniEvents.iid);
      delete this.aniEvents.iid;
      this.aniProgress = null;
      this.dispatchAction('stop');
    }
    return this;
  };

});

/** @namespace fx */
ECMAScript.Extend('fx', function (ecma) {

  var proto = {};

  /**
   * @class AnimatorProgress
   */

  this.AnimatorProgress = function (interval, duration) {
    this.interval = interval;
    this.duration = duration;
    this.last = this.now = this.begin = new Date();
  };

  this.AnimatorProgress.prototype = proto;

  /**
   * @function update
   */

  proto.update = function () {
    this.last = this.now;
    this.now = new Date();
  };

  /**
   * @function isComplete
   */

  proto.isComplete = function () {
    return this.duration && (this.getElapsed() >= this.duration);
  };

  /**
   * @function getLap
   */

  proto.getLap = function () {
    return this.now - this.last;
  };

  /**
   * @function getElapsed
   */

  proto.getElapsed = function () {
    return this.now - this.begin;
  };

  /**
   * @function getProportion
   */

  proto.getProportion = function () {
    var p = this.duration ? this.getElapsed() / this.duration : -1;
    return Math.min(p, 1);
  };

  /**
   * @function toString
   */

  proto.toString = function () {
    var result = [
      'proportion=' + this.getProportion(),
      'lap=' + this.getLap(),
      'elapsed=' + this.getElapsed(),
      'isComplete=' + this.isComplete()
    ]
    return result.join(', ');
  };

});

/** @namespace fx.effects */
ECMAScript.Extend('fx.effects', function (ecma) {

  var CEffect = ecma.fx.Effect;

  var proto = ecma.lang.createPrototype(CEffect);

  /**
   * @class Style
   */

  this.Style = function (elem, attr, p1, p2, units, duration) {
    this.elem = ecma.dom.getElement(elem);
    this.attr = attr;
    this.units = units || '';
    this.end = p2;
    this.begin = p1;
    this.dir = this.begin > this.end ? -1 : 1;
    var delta = Math.abs(this.dir > 0 ? this.end - this.begin : this.end - this.begin);
    CEffect.apply(this, [delta, duration]);
  };

  this.Style.prototype = proto;

  proto.draw = function (action, progress) {
    var d = this.getDelta() * progress.getProportion();
    var value = (d * this.dir) + this.begin;
    ecma.dom.setStyle(this.elem, this.attr, value + this.units);
    //ecma.console.log(this.attr, value + this.units);
  };

});

/** @namespace fx.effects */
ECMAScript.Extend('fx.effects', function (ecma) {

  var CEffect = ecma.fx.Effect;

  var proto = ecma.lang.createPrototype(CEffect);

  /**
   * @class Opacify
   */

  this.Opacify = function (elem, beg, end, duration) {
    this.elem = ecma.dom.getElement(elem);
    this.begin = beg;
    this.end = end;
    var delta = this.getDelta();
    CEffect.apply(this, [delta, duration]);
  };

  this.Opacify.prototype = proto;

  /**
   * @function getDelta
   */

  proto.getDelta = function () {
    this.dir = this.begin > this.end ? -1 : 1;
    return Math.abs(this.dir > 0 ? this.end - this.begin : this.end - this.begin);
  };

  /**
   * @function draw
   */

  proto.draw = function (action, progress) {
    var d = this.getDelta() * progress.getProportion();
    var value = (d * this.dir) + this.begin;
    ////ecma.console.log('fx:setOpacity', ecma.dom.getXPath(this.elem), value);
    ecma.dom.setOpacity(this.elem, value);
  };

});

ECMAScript.Extend('fx.effects', function (ecma) {

  var CEffect = ecma.fx.Effect;

  var proto = ecma.lang.createPrototype(CEffect);

  this.Swap = function (attr, units, duration) {
    this.attr = attr;
    this.units = units || '';
    CEffect.apply(this, [0, duration]);
  };

  this.Swap.prototype = proto;

  proto.start = function (elem1, elem2, cb) {
    this.elem1 = ecma.dom.getElement(elem1);
    this.elem2 = ecma.dom.getElement(elem2);
    var p1 = ecma.dom.getStyle(elem1, this.attr);
    var p2 = ecma.dom.getStyle(elem2, this.attr);
    if (this.units) {
      p1 = p1.substr(0, p1.length - this.units.length);
      p2 = p2.substr(0, p2.length - this.units.length);
    }
    p1 = ecma.util.asInt(p1);
    p2 = ecma.util.asInt(p2);
    this.sum = p1 + p2;
    this.begin = p1;
    this.end = p2;
    this.dir = p1 > p2 ? -1 : 1;
    this.fxDelta = Math.abs(this.dir > 0 ? p2 - p1 : p2 - p1);
    CEffect.prototype.start.call(this, cb);
  };

  proto.draw = function (action, progress) {
    var d = this.getDelta() * progress.getProportion();
    var v1 = (d * this.dir) + this.begin;
    var v2 = (d * -this.dir) + this.end;
    ecma.dom.setStyle(this.elem1, this.attr, v1 + this.units);
    ecma.dom.setStyle(this.elem2, this.attr, v2 + this.units);
//  ecma.console.log('elem1', this.attr, v1 + this.units);
//  ecma.console.log('elem2', this.attr, v2 + this.units);
//  ecma.console.log('elems', this.attr, v1 + v2, this.units);
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  /**
   * @structure colors
   */

  this.colors = {};
  this.colors.white = 'rgb(255,255,255)';
  this.colors.black = 'rgb(0,0,0)';
  this.colors.red1 = 'rgb(164,0,0)';
  this.colors.red2 = 'rgb(204,0,0)';
  this.colors.red3 = 'rgb(239,41,41)';
  this.colors.green1 = 'rgb(78,154,6)';
  this.colors.green2 = 'rgb(115,210,22)';
  this.colors.green3 = 'rgb(138,226,52)';
  this.colors.blue1 = 'rgb(32,74,135)';
  this.colors.blue2 = 'rgb(52,101,164)';
  this.colors.blue3 = 'rgb(114,159,207)';
  this.colors.yellow1 = 'rgb(196,160,0)';
  this.colors.yellow2 = 'rgb(237,212,0)';
  this.colors.yellow3 = 'rgb(252,233,79)';
  this.colors.orange1 = 'rgb(206,92,0)';
  this.colors.orange2 = 'rgb(245,121,0)';
  this.colors.orange3 = 'rgb(252,175,62)';
  this.colors.purple1 = 'rgb(92,53,102)';
  this.colors.purple2 = 'rgb(117,80,123)';
  this.colors.purple3 = 'rgb(173,127,168)';
  this.colors.brown1 = 'rgb(143,89,2)';
  this.colors.brown2 = 'rgb(193,125,17)';
  this.colors.brown3 = 'rgb(233,185,110)';
  this.colors.gray1 = 'rgb(46,52,54)';
  this.colors.gray2 = 'rgb(186,189,182)';
  this.colors.gray3 = 'rgb(238,238,236)';
  this.colors.gray4 = 'rgb(242,242,242)';

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var LOADING = 0;
  var LOADED = 1;
  var UNLOADING = 2;
  var UNLOADED = 3;

  /**
   * @class Page
   * Provides common events and methods for javascript web pages.
   *
   *  // Before Document onLoad
   *  var p = new Page();
   *
   * Action Listeners
   *
   *  p.addActionListener(name, cb);
   *
   *  name    Action name L<1>
   *  cb      Callback L<2>
   *
   * N<1> Actions
   *
   *  Name          Called When
   *  ------------- ------------------------------------------------------------
   *  onPageLoad        DOM load   
   *  onPageResize      Window resize
   *  onPageScroll      Window scroll
   *  onPageUnload      Window unload
   *
   * N<2> Callback API
   *
   *  function (action, event);
   */

  var CDispatcher = ecma.action.ActionDispatcher;

  var _proto = ecma.lang.createPrototype(CDispatcher);

  this.Page = function () {
    CDispatcher.call(this);
    this.pgState = LOADING;
    this.pgRefreshRate = 250; // milliseconds
    this.pgBuffer = {}; // buffer events
    this.pgCanvas = {width: 0, height: 0, delta: {width: 0, height: 0}};
    this.pgViewport = {width: 0, height: 0, left: 0, top: 0, delta: {width: 0, 
      height: 0, top: 0, left: 0}};
    this.pgStyleSheet = null; // not available until dom loaded
    ecma.dom.addEventListener(ecma.document, 'load', this.onLoadEvent, this);
    ecma.dom.addEventListener(ecma.window, 'resize', this.onResizeEvent, this);
    ecma.dom.addEventListener(ecma.window, 'scroll', this.onScrollEvent, this);
    ecma.dom.addEventListener(ecma.window, 'beforeunload', this.onBeforeUnloadEvent, this);
    ecma.dom.addEventListener(ecma.window, 'unload', this.onUnloadEvent, this);
  };

  this.Page.prototype = _proto;

  _proto.getViewport = function () {
    return this.pgViewport;
  };

  _proto.getCanvas = function () {
    return this.pgCanvas;
  };

  _proto.getStyleSheet = function () {
    return this.pgStyleSheet;
  };

  _proto.hasPageLoaded = function () {
    return ecma.dom.content.hasLoaded;
  };

  _proto.addActionListener = function (name, listener, scope, args) {
    var listener = CDispatcher.prototype.addActionListener.apply(this, arguments);
    if (listener.name == this.normalizeActionName('onPageLoad')) {
      try {
        listener.invoke(null); // onLoad event object no longer available
      } catch (ex) {
        js.console.log(ex);
      }
    }
    return listener;
  };

  /** Class derivation hooks */

  _proto.onPageLoad = function (event) {
  };

  _proto.onPageResize = function (event) {
  };

  _proto.onPageScroll = function (event) {
  };

  _proto.onPageBeforeUnload = function (event) {
  };

  _proto.onPageUnload = function (event) {
  };

  /** DOM Event handlers */

  _proto.onLoadEvent = function (event) {
    this.pgState = LOADED;
    this.pgStyleSheet = new ecma.dom.StyleSheet();
    this.doAction(event, 'onPageLoad');
  };

  _proto.onResizeEvent = function (event) {
    this.bufferAction(event, 'onPageResize');
  };

  _proto.onScrollEvent = function (event) {
    this.bufferAction(event, 'onPageScroll');
  };

  _proto.onBeforeUnloadEvent = function (event) {
    this.pgState = UNLOADING;
    this.doAction(event, 'onPageBeforeUnload');
  };

  _proto.onUnloadEvent = function (event) {
    this.pgState = UNLOADED;
    this.doAction(event, 'onPageUnload');
  };

  /** Action handlers **/

  _proto.bufferAction = function (event, name) {
    if (this.pgBuffer[name]) return;
    this.pgBuffer[name] = ecma.dom.setTimeout(this.doBufferedAction,
      this.pgRefreshRate, this, [event, name]);
  };

  _proto.doBufferedAction = function (event, name) {
    delete this.pgBuffer[name];
    this.doAction(event, name);
  };

  _proto.doAction = function (event, name) {
    this.pgUpdate(name);
    var func = this[name];
    if (func) {
      func.call(this, event);
    } else {
      throw new Error('No class method defined for action: ' + name);
    }
    this.executeAction(name, event);
  };

  /** Internal methods */

  /**
   * @internal pgUpdate
   * Sets member values from window size and position
   * The name is passed for using it may improve speed by limiting what 
   * calculations are done.
   */

  _proto.pgUpdate = function (name) {
    var pos = ecma.dom.canvas.getPosition();
    var vp = this.pgViewport;
    var c = this.pgCanvas;
    // Size
    c.delta.width = pos.width - c.width;
    c.delta.height = pos.height - c.height;
    c.width = pos.width;
    c.height = pos.height;
    vp.delta.width = pos.windowX - vp.width;
    vp.delta.height = pos.windowY - vp.height;
    vp.width = pos.windowX;
    vp.height = pos.windowY;
    // Position
    vp.delta.left = pos.scrollX - vp.left;
    vp.delta.top = pos.scrollY - vp.top;
    vp.top = pos.scrollY;
    vp.left = pos.scrollX;
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var proto = {};

  /**
   * @class Element
   */

  this.Element = function () {
    this.uiElems = {root:null};
    this.uiEvents = {};
  };

  this.Element.prototype = proto;

  proto.createElement = function () {
    var args = ecma.util.args(arguments);
    var arg1 = args.shift();
    var parts = arg1.split('_');
    var tag = parts[0];
    var id = parts[1];
    var elem = null;
    if (tag && id) {
      args.unshift(tag);
      elem = this.uiElems[arg1] = ecma.dom.createElement.apply(null, args);
    } else {
      elem = ecma.dom.createElement.apply(null, arguments);
    }
    return elem;
  };

  proto.getRootElement = ecma.lang.createAbstractFunction();

  proto.getElement = function (id) {
    return this.uiElems[id];
  };

  proto.setElement = function (id, elem) {
    return this.uiElems[id] = elem;
  };

  proto.removeElement = function (id) {
    var elem = this.getElement(id);
    if (!elem) return;
    return delete this.uiElems[id];
  };

  function formatEventKey (id, type) {
    return id + '.' + type;
  };

  proto.addEventListener = function (id) {
    var elem = this.getElement(id);
    if (!elem) return;
    var args = ecma.util.args(arguments);
    args[0] = elem;
    var key = formatEventKey(id, args[1]);
    return this.uiEvents[key] = ecma.lang.createObject(ecma.dom.EventListener, args);
  }

  proto.removeEventListener = function (id, type) {
    var elem = this.getElement(id);
    if (!elem) return;
    var key = formatEventKey(id, type);
    this.uiEvents[key].remove();
    return delete this.uiEvents[key];
  }

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var CActionDispatcher = ecma.action.ActionDispatcher;

  var proto = ecma.lang.createPrototype(CActionDispatcher);

  /**
   * @class View
   */

  this.View = function (rootElem) {
    CActionDispatcher.apply(this);
    this.ui = new Object();
    this.rootElem = rootElem;
  };

  this.View.prototype = proto;

  proto.createUI = function () {
    return this;
  };

  proto.updateUI = function () {
    return this;
  };

  proto.destroyUI = function () {
    return this;
  };

  proto.attachUI = function (elem) {
    if (!elem) elem = this.rootElem;
    if (!elem) throw new Error('Missing element');
    var nlist = elem.getElementsByClassName('ui');
    for (var i = 0, node; node = nlist[i]; i++) {
      if (!node.id) continue;
      this.ui[node.id] = node;
    }
    return this;
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var _css = null;

  function initBannerStyles () {
    if (_css) return;
    _css = new ecma.dom.StyleSheet();
    _css.createRule('.bnrViewport', {
      'overflow':'hidden',
      'position':'relative'
    });
    _css.createRule('.bnrItems', {
      'position':'absolute',
      'border-collapse':'collapse',
      'border-spacing':'0',
      'margin':'0',
      'padding':'0'
    });
    _css.createRule('.bnrCell', {
      'vertical-align':'center',
      'margin':'0',
      'padding':'0'
    });
  };

  var CElement = ecma.lsn.ui.Element;
  var CSequencer = ecma.fx.Sequencer;

  var proto = ecma.lang.createPrototype(CElement, CSequencer);

  /**
   * @class Banner
   */

  this.Banner = function (interval) {
    initBannerStyles();
    CElement.apply(this);
    CSequencer.apply(this, [interval || 1000]);
    this.createUI();
    this.frames = [];
    this.addActionListener('select', this.onSelect, this);
    this.addActionListener('deselect', this.onDeselect, this);
    this.addActionListener('loop', this.onLoop, this);
  };

  this.Banner.prototype = proto;

  proto.attach = function (div, table, row) {
    div = ecma.dom.getElement(div);
    table = ecma.dom.getElement(table);
    row = ecma.dom.getElement(row);
    this.setElement('div_vp', div);
    this.setElement('table_items', table);
    this.setElement('tr_items', row);
    var nodes = row.getElementsByTagName('td');
    for (var i = 0, cell; cell = nodes[i]; i++) {
      CSequencer.prototype.addItem.call(this, cell);
    }
  };

  proto.sizeTo = function (elem) {
    elem = ecma.dom.getElement(elem);
    var vp = this.getElement('div_vp');
    ecma.dom.setStyle(vp, 'width', ecma.dom.getInnerWidth(elem) + 'px');
    ecma.dom.setStyle(vp, 'height', ecma.dom.getInnerHeight(elem) + 'px');
  };

  proto.getRootElement = function (elem) {
    return this.getElement('div_vp');
  };

  proto.createUI = function () {
    this.createElement('div_vp', {'class':'bnrViewport'}, [
      this.createElement('table_items', {'class':'bnrItems'}, [
        'tbody', [this.createElement('tr_items')]
      ]),
      this.getElement('table_items')
    ]);
  };

  proto.onClickNext = function (event) {
    this.next();
  };

  proto.onClickPrev = function (event) {
    this.prev();
  };

  proto.onClickSelect = function (event, idx) {
    this.select(idx);
  };

  proto.onClickStart = function (event) {
    this.start();
  };

  proto.onClickStop = function (event) {
    this.stop();
  };

  proto.addItem = function (item) {
    var td = this.createElement('td', {'class': 'bnrCell'}, [item]);
    this.getElement('tr_items').appendChild(td);
    return CSequencer.prototype.addItem.call(this, td);
  };

  proto.getMovement = function (idx) {
    var left = 0;
    for (var i = 0; i < idx; i++) {
      var td = this.getItem(i);
      left += ecma.dom.getWidth(td);
    }
    left *= -1;
    var tbl = this.getElement('table_items');
    var pos = ecma.util.asInt(ecma.dom.getStyle(tbl, 'left'));
    return [pos, left]; // from, to
  }

  proto.onSelect = function (action, target, idx) {
//  ecma.console.log('select', idx);
    var left = this.getMovement(idx);
    if (left[0] != left[1]) {
      var tbl = this.getElement('table_items');
      var ani = new ecma.fx.Animator(25, 500);
      ani.addEffect('style', tbl, 'left', left[0], left[1], 'px');
      ani.addEffect('style', target, 'opacity', 0, 1);
      ani.start();
    }
  };

  proto.onDeselect = function (action, target) {
//  ecma.console.log('deselect', action.getDispatcher().getIndex());
  };

  proto.loop = function (idx) {
    var left = this.getMovement(idx);
    var tbl = this.getElement('table_items');
//  ecma.console.log('loop', left[0], left[1]);
    new ecma.fx.effects.Style(tbl, 'opacity', 1, 0, null, 250).start([function () {
      ecma.dom.setStyle(tbl, 'left', left[1] + 'px');
      new ecma.fx.effects.Style(tbl, 'opacity', 0, 1, null, 250).start([this.select, this, [idx]]);
    }, this]);
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var _defaultBackground = '#f2f2f2';
  var _defaultOpacity = .75;

  var COVER_CANVAS = 0;
  var COVER_ELEMENT = 1;

  var CBase = ecma.lsn.ui.Base;

  /**
   * @class Mask - An element which covers the entire page.
   *
   = Action Interface
   *
   * The below actions also invoke derived class methods of the same name and
   * are synchronous.
   *
   *    onMaskLoad      When .show() is called the first time
   *    onMaskShow      When .show() is invoked (and before anything happens)
   *    onMaskAttach    After the elements have been added to the document
   *    onMaskReady     After the mask appears (asynchronous callbacks)
   *    onMaskHide      When .hide() is invoked (and before anything happens)
   *    onMaskDetach    After the elements have been removed from the document
   *
   *    Example:
   *
   *      var mask = new ecma.lsn.ui.Mask();
   *
   *      mask.show();    // onMaskLoad (iff this is the first time)
   *                      // onMaskShow
   *                      // onMaskAttach
   *                      // onMaskReady
   *
   *      mask.hide();    // onMaskHide
   *                      // onMaskDetach
   *
   */

  this.Mask = function (seedElement) {
    CBase.apply(this);
    this.hasLoaded = false;
    this.createUI();
    this.fxShow = new ecma.fx.effects.Opacify(this.getRoot(), 0, _defaultOpacity, 100);
    this.fxHide = new ecma.fx.effects.Opacify(this.getRoot(), _defaultOpacity, 0, 100);
    this.seedElement = seedElement;
  };

  var _proto = this.Mask.prototype = ecma.lang.createPrototype(
    CBase
  );

  /**
   * getRoot - Return the root element (DIV) of this mask.
   */

  _proto.getRoot = function () {
    return this.uiRoot;
  };

  _proto.setOpacity = function (opacity) {
    this.fxShow.end = opacity;
    this.fxHide.begin = opacity;
    return opacity;
  };

  _proto.setDuration = function (ms) {
    this.fxShow.setDuration(ms);
    this.fxHide.setDuration(ms);
    return ms;
  };

  _proto.setBackground = function (cssValue) {
    ecma.dom.setStyle(this.uiRoot, 'background', cssValue);
    return cssValue;
  };

  _proto.load = function () {
    if (this.hasLoaded) return;
    this.canvas = new ecma.dom.Canvas();
    this.executeClassAction('onMaskLoad');
    this.hasLoaded = true;
  }

  _proto.setUIParent = function (parentElem) {
    var body = ecma.dom.getBody();
    this.html = body.parentNode;
    if (parentElem) {
      this.uiParent = parentElem;
      this.maskMethod = COVER_ELEMENT;
    } else {
      this.uiParent = ecma.dom.browser.isIE ? body : this.html || body;
      this.maskMethod = COVER_CANVAS;
    }
  };

  _proto.getDimensions = function () {
    var result = {'width':0, 'height':0};
    switch (this.maskMethod) {
      case COVER_ELEMENT:
        result.width = ecma.dom.getWidth(this.uiParent);
        result.height = ecma.dom.getHeight(this.uiParent);
        break;
      case COVER_CANVAS:
      default:
        result.width = this.canvas.getWidth();
        result.height = this.canvas.getHeight();
    }
    return result;
  };

  /**
   * show - Show the mask.
   */

  _proto.show = function () {
    this.load();
    this.executeClassAction('onMaskShow');
    this.attach();
    this.appear([function () {
      this.dispatchClassAction('onMaskReady');
    }, this]);
  };

  /**
   * hide - Hide the mask.
   */

  _proto.hide = function () {
    this.executeClassAction('onMaskHide');
    this.disappear([function () {
      this.detach();
    }, this]);
  };

  /**
   * attach - Attach the UI to the DOM.
   */

  _proto.attach = function () {
    if (!this.uiParent) this.setUIParent(this.seedElement);
    switch (this.maskMethod) {
      case COVER_ELEMENT:
        break;
      case COVER_CANVAS:
      default:
        ecma.dom.setStyle(this.html, 'width', '100%');
        ecma.dom.setStyle(this.html, 'height', '100%');
    }
    ecma.dom.setStyle(this.uiRoot, 'z-index', this.zIndexAlloc());
    this.resizeEvent = new ecma.dom.EventListener(ecma.window, 'resize', this.resize, this);
    this.resize();
    ecma.dom.appendChild(this.uiParent, this.uiRoot);
    this.executeClassAction('onMaskAttach');
  };

  _proto.resize = function () {
    var dims = this.getDimensions();
    ecma.dom.setStyle(this.uiRoot, 'width', dims.width + "px");
    ecma.dom.setStyle(this.uiRoot, 'height', dims.height + "px");
  };

  /*
   * detach - Detach the UI from the DOM.
   */

  _proto.detach = function () {
    try {
      ecma.dom.removeElement(this.uiRoot);
      this.resizeEvent.remove();
    } catch (ex) {
    }
    this.zIndexFree();
    ecma.dom.setStyle(this.uiRoot, 'z-index', '-1');
    this.executeClassAction('onMaskDetach');
  };

  _proto.appear = function (cb) {
    this.fxShow.start(cb);
  };

  _proto.disappear = function (cb) {
    this.fxHide.start(cb);
  };

  /**
   * createUI - Create the UI elements.
   */

  _proto.createUI = function () {
    this.uiRoot = ecma.dom.createElement('div', {
      'style': {
        'background': _defaultBackground,
        'position': 'absolute',
        'overflow': 'hidden',
        'z-index': '-1',
        'margin': 0,
        'padding': 0,
        'border': 0,
        'top': 0,
        'left': 0,
        'width': 0,
        'height': 0
      }
    });
    this.fixupUI();
    ecma.dom.setOpacity(this.uiRoot, 0);
    return this.uiRoot;
  };

  if (ecma.dom.browser.isIE) {

    /**
     * fixupUI - Conditional elements based on browser.
     *
     * Fix for ie5/6, mask unable to hide select boxes. The src attribute must 
     * be set or IE will complain about both secure and non-secure times being 
     * on the page.
     */

    _proto.fixupUI = function () {
      this.uiRoot.appendChild(ecma.dom.createElement('iframe', {
        'width': 0,
        'height': 0,
        'frameborder': 0,
        'src': 'about:blank',
        'style': {
          'width': 0,
          'height': 0,
          'visibility': 'hidden'
        }
      }));
    };

  } else {

    _proto.fixupUI = function () {
    };

  }

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var CBase = ecma.lsn.ui.Base;

  /**
   * @class Dialog
   * Implementation for HTML dialogs.
   *
   = Action Interface
   *
   * The below actions also invoke derived class methods of the same name.  By
   * default, actions are synchronous to allow for asynchronous actions (such
   * as effects and XHR loading) to complete.
   *
   *    onDialogLoad      When .show() is called the first time.
   *    onDialogShow      When .show() is invoked (and before anything happens)
   *    onDialogAttach    After the elements have been added to the document
   *    onDialogReady     After the dialog appears (asynchronous callbacks)
   *    onDialogHide      When .hide() is invoked (and before anything happens)
   *    onDialogDetach    After the elements have been removed from the document
   *
   *    Example:
   *
   *      var dlg = new ecma.lsn.ui.Dialog();
   *
   *      dlg.show();     // onDialogShow
   *                      // onDialogAttach
   *                      //  - The dialog is centered
   *                      //  - The appear affect is applied
   *                      // onDialogReady
   *
   *      dlg.hide();     // onDialogHide
   *                      //  - The disappear affect is applied
   *                      // onDialogDetach
   *
   */

  var REL_PERSIST   = 0; // Content remains attached to the DOM after detach
  var REL_ORPHAN    = 1; // Content elements are removed after detach

  this.Dialog = function (content, rel) {
    CBase.apply(this);
    this.rel = rel || REL_PERSIST;
    this.swapMarker = null;
    this.hasLoaded = false;
    this.position = null;
    this.mask = null;
    this.createUI();
    this.fxDuration = 100;
    this.fxShow = new ecma.fx.effects.Opacify(this.getRoot(), 0, 1, this.fxDuration);
    this.fxHide = new ecma.fx.effects.Opacify(this.getRoot(), 1, 0, this.fxDuration);
    if (content) this.setContent(content);
    this.addActionListener('onClose', this.hide, this); // ui callback
  };

  var _proto = this.Dialog.prototype = ecma.lang.createPrototype(
    CBase
  );

  /**
   * getRoot - Return the root element (DIV) of this dialog.
   */

  _proto.getRoot = function () { return this.uiRoot; };

  /**
   * load - Load any resources needed by this dialog.
   *
   * This is NOT an asynchronous method as the dialog cannot proceed until the
   * resources have been loaded.  If XHR requests are employed they should be
   * called synchronously.
   */

  _proto.load = function () {
  };

  /**
   * show - Show the dialog.
   */

  _proto.show = function (/*...*/) {
    var args = ecma.util.args(arguments);
    if (!this.hasLoaded) {
      this.load();
      this.executeClassAction('onDialogLoad');
      this.hasLoaded = true;
    }
    this.executeClassAction.apply(this, ['onDialogShow'].concat(args));
    this.attach();
    this.appear([function () {
      this.dispatchClassAction('onDialogReady');
    }, this]);
  };

  /**
   * hide - Hide the dialog.
   */

  _proto.hide = function () {
    this.executeClassAction('onDialogHide');
    this.disappear([function () {
      this.detach();
    }, this]);
  };

  _proto.setParentElement = function (parentElem) {
    if (this.mask) this.mask.setUIParent(parentElem);
    return this.uiParent = parentElem;
  };

  _proto.getParentElement = function (parentElem) {
    return parentElem || this.uiParent || ecma.dom.getBody();
  };

  /**
   * attach - Attach the UI to the DOM.
   */

  _proto.attach = function (parentElem) {
    ecma.dom.setStyle(this.uiRoot, 'z-index', this.zIndexAlloc());
    ecma.dom.appendChild(this.getParentElement(parentElem), this.uiRoot);
    this.executeClassAction('onDialogAttach');
    this.setPosition();
  };

  /**
   * setPosition - Center the dialog within the viewport.
   */

  _proto.setPosition = function () {
    var elem = this.getRoot();
    ecma.dom.setStyles(elem, {
      'top': '0px',
      'left': '0px'
    });
    this.center();
  };

  _proto.center = function () {
    var elem = this.getRoot();
    var w = ecma.dom.getContentWidth(elem);
    var h = ecma.dom.getContentHeight(elem);
    var vp = ecma.dom.getViewportPosition();
    var posTop = (vp.height - h) / 4;
    var posLeft = (vp.width - w) / 2;
    var minTop = 0;
    var minLeft = 0;
    if (this.position == 'absolute') {
      posTop += vp.top;
      posLeft += vp.left;
      minTop = vp.top;
      minLeft = vp.left;
    }
    posTop = Math.max(posTop, minTop);
    posLeft = Math.max(posLeft, minLeft);
    ecma.dom.setStyles(elem, {
      'top': posTop + 'px',
      'left': posLeft + 'px'
    });
  };

  /*
   * detach - Detach the UI from the DOM.
   */

  _proto.detach = function () {
    if (this.rel == REL_ORPHAN) {
      ecma.dom.removeElement(this.uiRoot);
    }
    ecma.dom.setStyle(this.uiRoot, 'z-index', '-1');
    this.zIndexFree();
    this.executeClassAction('onDialogDetach');
  };

  _proto.appear = function (cb) {
    this.fxShow.start(cb);
  };

  _proto.disappear = function (cb) {
    this.fxHide.start(cb);
  };

  /**
   * createUI - Create the UI elements.
   *
   * TODO
   *  - Use capabilities [not vendor] for position style
   *  - Upgrade ecma.platform w/ capabilities support
   * 
   * XXX
   *  Fixed position works with IE8, however top and left coordinates are
   *  relative to a different origin.
   */

  _proto.createUI = function () {
    this.position = ecma.platform.isIE ? 'absolute' : 'fixed';
    this.uiRoot = ecma.dom.createElement('div', {
      'style': {
        'position': this.position,
        'z-index': '-1'
      }
    });
    ecma.dom.setOpacity(this.uiRoot, 0);
    return this.uiRoot;
  };

  /**
   * setContents - Set the dialog contents
   *
   *  @param content <Element> An element whose child nodes make up the dialog.
   *
   * The single argument C<content> is used in favor of the method where that
   * element exists on the page, however it is set to display:none.  Its
   * children are then detached and append to this dialog's root element.
   */

  _proto.setContents = function (content) {
    this.hook(content);
    ecma.dom.replaceChildren(this.uiRoot, content.childNodes);
    return this.uiRoot;
  };

  /**
   * setContent - Set the dialog contents
   *
   *  @param content <Element> An element which comprises the dialog
   *
   */

  _proto.setContent = function (content) {
    this.hook(content);
    ecma.dom.replaceChildren(this.uiRoot, [content]);
    return this.uiRoot;
  };

  /**
   * hook - Create handlers for action elements.
   *
   * Elements which indicate actions are assigned an onClick handler which
   * invokes any action listeners.  The way to do this is:
   *
   *    A       set the rel attribute to "action"
   *            set the hash portion of the href attribute to the action name
   *
   *    BUTTON  type cannot be "submit"
   *            set the name to "action"
   *            set the value to the name of the action
   *
   * Examples:
   *
   *    <a rel="action" href="#close">Close</a>
   *
   *    <button type="button" name="action" value="close">Close</button>
   *
   */

  _proto.hook = function (content) {

    var list = [];

    // Anchors
    var links = ecma.dom.getElementsByTagName(content, 'A');
    for (var i = 0, node; node = links[i]; i++) {
      var rel = ecma.dom.getAttribute(node, 'rel');
      if (rel == 'action') {
        var action = new ecma.http.Location(node.href).getHash();
        list.push([node, action]);
      }
    }

    // Buttons
    var buttons = ecma.dom.getElementsByTagName(content, 'BUTTON');
    for (var i = 0, node; node = buttons[i]; i++) {
      var type = ecma.dom.getAttribute(node, 'type');
      if (type == 'submit') continue;
      var name = ecma.dom.getAttribute(node, 'name');
      if (name != 'action') continue;
      var action = ecma.dom.getAttribute(node, 'value');
      list.push([node, action]);
    }

    // Make them into handlers
    for (var i = 0, item; item = list[i]; i++) {
      var elem = item[0];
      var action = item[1];
      ecma.dom.addEventListener(elem, 'onClick', function (event, action) {
        ecma.dom.stopEvent(event);
        this.executeAction(action);
      }, this, [action]);
    }

  };

  /**
   * @function getElementById
   */

  _proto.getElementById = function (id) {
    function walk (elem) {
      if (elem.id == id) return elem;
      var child = elem.firstChild;
      var result = undefined;
      while (!result && child) {
        result = walk(child);
        child = child.nextSibling;
      }
      return result;
    }
    return this.uiRoot ? walk(this.uiRoot) : undefined;
  };

  /**
   * @function makeModal
   * Display an underlying modal mask when the dialog is shown.
   */

  _proto.makeModal = function () {
    if (!this.mask) {
      this.mask = new ecma.lsn.ui.Mask(this.uiParent);
      this.mask.setOpacity(0);
      this.addActionListener('onDialogShow', this.mask.show, this.mask);
      this.addActionListener('onDialogHide', this.mask.hide, this.mask);
    }
    return this.mask;
  };

  /**
   * @function makeMasked
   * Display an underlying mask which closes the dialog when clicked.
   */

  _proto.makeMasked = function () {
    if (!this.mask) {
      this.mask = new ecma.lsn.ui.Mask(this.uiParent);
      this.addActionListener('onDialogShow', this.mask.show, this.mask);
      this.addActionListener('onDialogHide', this.mask.hide, this.mask);
      this.evtMaskClick = new ecma.dom.EventListener(this.mask.getRoot(), 
        'click', this.hide, this);
    }
    return this.mask;
  };

  /**
   * makeMoveable - Make this dialog moveable.
   * @param handle <Element|ID> Move handle
   */

  _proto.makeMoveable = function (handle) {
    this.makeModal();
    if (handle) {
      ecma.dom.setStyle(handle, 'cursor', 'move')
      new ecma.dom.EventListener(handle, 'onMouseDown',
        function (event) {
          new ecma.lsn.Move(event, this.uiRoot);
        }, this
      );
    }
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var _imgReady       = '/res/icons/16x16/status/blank.gif';
  var _imgActive      = '/res/icons/16x16/status/saving.gif';
  var _imgComplete    = '/res/icons/16x16/status/checkmark.gif';
  var _imgError       = '/res/icons/16x16/actions/document-close.png';

  var _css = {
    'margin':         '0 2px',
    'vertical-align': 'middle',
    'border':         'none'
  };

  /**
   * @class StatusIcon
   */

  this.StatusIcon = function () {
    this.elem = ecma.dom.createElement('img', {
      'src': _imgReady,
      'width': 16,
      'height': 16,
      'border': 0,
      'style': _css
    });
    this.fade = new ecma.fx.effects.Opacify(this.elem, 1, .25, 1000);
  };

  var _proto = this.StatusIcon.prototype = ecma.lang.createPrototype();

  _proto.getRootElement = function () {
    return this.elem;
  };

  _proto.showActive = function () {
    ecma.dom.setOpacity(this.elem, 1);
    ecma.dom.setAttribute(this.elem, 'src', _imgActive);
  };

  _proto.showComplete = function () {
    ecma.dom.setOpacity(this.elem, 1);
    ecma.dom.setAttribute(this.elem, 'src', _imgComplete);
    ecma.dom.setTimeout(this.fade.start, 1000, this.fade);
  };

  _proto.showReady = function () {
    ecma.dom.setOpacity(this.elem, 1);
    ecma.dom.setAttribute(this.elem, 'src', _imgReady);
  };

  _proto.showError = function () {
    ecma.dom.setOpacity(this.elem, 1);
    ecma.dom.setAttribute(this.elem, 'src', _imgError);
    ecma.dom.setTimeout(this.fade.start, 1000, this.fade);
  };

});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var _colors = ecma.lsn.ui.colors;

  /**
   * @class Status
   */

  this.Status = function () {
    this.statusTimeout = 3000;
    this.modalMask = null;
    this.loadingPopup = null;
  };

  var Status = this.Status.prototype = ecma.lang.createPrototype();

  Status.initStyles = function () {
    /*
    if (this.css) return;
    this.css = new ecma.dom.StyleSheet();
    this.css.updateRule('.statusPopup', {
      'text-align':'center',
      'border':'1px outset ' + _colors.gray1,
      'background-color':_colors.gray3,
      'color':_colors.black
    });
    this.css.updateRule('.statusNotify', {
      'border':'1px outset ' + _colors.gray1,
      'background-color':_colors.gray3,
      'color':_colors.black
    });
    this.css.updateRule('.statusAlert', {
      'border':'1px outset ' + _colors.gray1,
      'background-color':_colors.gray3,
      'color':_colors.black
    });
    this.css.updateRule('.statusPopup .footerButtons', {
      'text-align':'right'
    });
    return this.css;
    */
  };

  Status.constructPopup = function (cssClass) {
    var vp = ecma.dom.getViewportPosition();
    var pad = 12;
    var width = (vp.width/4) + (2*pad);
    var left = (vp.width/2) - (width/2);
    var popup = ecma.dom.createElement('div', {
      'style': {
        'position': 'absolute',
        'top': '5px',
        'width': width + 'px',
        'left': left + 'px',
        'padding': pad + 'px'
      }
    });
    ecma.dom.addClassNames(popup, 'statusPopup', cssClass);
    return popup;
  };

  Status.attachPopup = function (popup) {
    ecma.dom.setStyle(popup, 'z-index', ecma.lsn.zIndexAlloc());
    ecma.dom.getBody().appendChild(popup);
    return popup;
  };

  Status.createModalPopup = function (cssClass) {
    this.initStyles();
    var popup = this.constructPopup(cssClass);
    this.modalMask = new ecma.lsn.ui.Mask();
    this.modalMask.addActionListener(
      'onMaskAttach', function (action, popup) {
        this.attachPopup(popup);
      }, this, [popup]
    );
    this.modalMask.show();
    return popup;
  };

  Status.createPopup = function (cssClass) {
    this.initStyles();
    return this.attachPopup(this.constructPopup(cssClass));
  };

  Status.removePopup = function (event, popup) {
    if (this.modalMask) {
      this.modalMask.hide();
      this.modalMask = null;
    }
    ecma.lsn.zIndexFree();
    ecma.dom.stopEvent(event);
    ecma.dom.removeElement(popup);
  };

  Status.notify = function (text) {
    var contents = ecma.dom.createElements(
      'span', {
        'innerHTML': text,
        'style': {'font-size':'12px'}
      }
    );
    var popup = this.createPopup('statusNotify');
    ecma.dom.appendChildren(popup, contents);
    ecma.dom.setTimeout(this.removePopup, this.statusTimeout, this, [null, popup]);
  };

  Status.alert = function (text) {
    var popup = this.createModalPopup('statusAlert');
    var contents = ecma.dom.createElements(
      'span', {
        'innerHTML': text,
        'style': {'font-size':'12px'}
      },
      'div.footerButtons', [
        'button=OK', {
          'onClick': [this.removePopup, this, [popup]]
        }
      ]
    );
    ecma.dom.appendChildren(popup, contents);
  };

  Status.showLoading = function (text) {
    if (this.loadingPopup) return;
    var innerHTML = text ? text : 'Loading';
    var popup = this.createModalPopup('statusLoading');
    var contents = ecma.dom.createElements(
      'IMG.indicator', {
        'src': '/res/icons/16x16/status/loading.gif',
        'width': '16',
        'height': '16',
        'alt': 'Loading'
      },
      'SPAN', {
        'innerHTML': innerHTML,
        'style': {'font-size':'12px'}
      }
    );
    ecma.dom.appendChildren(popup, contents);
    this.loadingPopup = popup;
  };

  Status.hideLoading = function () {
    if (!this.loadingPopup) return;
    this.removePopup(null, this.loadingPopup);
  };


});

/** @namespace lsn.ui */
ECMAScript.Extend('lsn.ui', function (ecma) {

  var CStatus = ecma.lsn.ui.Status;

  /**
   * @class Prompt
   */

  this.Prompt = function () {
    CStatus.apply(this);
  };

  var Prompt = this.Prompt.prototype = ecma.lang.createPrototype(
    CStatus
  );

  Prompt.confirm = function (text, cb) {
    var popup = this.createModalPopup('statusConfirm');
    var uiButtonNo = js.dom.createElement('button=No', {
      'onClick': [this.onConfirm, this, [popup, false, cb]]
    });
    var uiButtonYes = js.dom.createElement('button=Yes', {
      'onClick': [this.onConfirm, this, [popup, true, cb]]
    });
    var contents = ecma.dom.createElements(
      'span', {
        'innerHTML': text,
        'style': {'font-size':'12px'}
      },
      'div.footerButtons', [uiButtonNo, uiButtonYes]
    );
    ecma.dom.appendChildren(popup, contents);
    uiButtonNo.focus();
  };

  Prompt.onConfirm = function (event, popup, result, cb) {
    this.removePopup(event, popup);
    if (cb) ecma.lang.callback(cb, null, [result]);
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  /**
   * @class Form
   * Create an HTML form according to the provided definition.
   *
   *  var form = new ecma.lsn.forms.Form(def, vals);
   *  var formElem = form.getRootElement();
   *  // Append formElem to where the form should appear
   *
   * @param def <ecma.data.HashList> Form defintion L<1>
   * @param vals <ecma.data.HashList> Optional form values (name:value pairs)
   *
   * N<1> Form defintion format
   *
   *  action => /where/to/post              Optional, L<2>
   *  submit => Submit                      Optional, L<3>
   *  fieldsets => @{
   *    %{
   *      heading => Heading                Optional
   *      fields => %{
   *        name => %{                      L<4>
   *          label => Label                Optional
   *          type => type                  L<5>
   *          value => default-value
   *          max-length => number          for type=text
   *        }
   *      }
   *    }
   *  }
   *
   * N<2> Form action
   *
   * If no form action is provided, this class will dispatch a C<doSubmit>
   * action.
   *
   * N<3> Submit-button text
   *
   * If no submit-button text is provided, no submit button will be created.
   *
   * N<4> Field C<name>s
   *
   * The field C<name> is the datum key used when creating a hash list of form
   * values.  Meaning that if you have several fields, with these ids:
   *
   *  billingAddress/line1
   *  billingAddress/line2
   *  shippingAddress/line1
   *  shippingAddress/line2
   *  some/other/thing
   *  other/stuff
   *  other/stuff
   *  other/stuff
   *
   * Then the paramaters are submitted as the structured object:
   *
   *  billingAddress => %{
   *    line1 => its-value
   *    line2 => its-value
   *  }
   *  shippingAddress => %{
   *    line1 => its-value
   *    line2 => its-value
   *  }
   *  some => %{
   *    other => %{
   *      thing => its-value
   *    }
   *  }
   *  other => %{
   *    stuff => @{
   *      first-value
   *      second-value
   *      third-value
   *    }
   *  }
   *    
   *
   * N<5> Field types
   *
   *  hidden        INPUT TYPE="hidden"
   *  text          INPUT TYPE="text"
   *  textarea      TEXTAREA
   *  date          INPUT TYPE="text"
   *  password      INPUT TYPE="password"
   *  
   */

  var CDispatcher = ecma.action.ActionDispatcher;

  this.Form = function (def, vals) {
    CDispatcher.call(this);
    this.model = this.mapFormDefinition(def, vals);
  };

  var _proto = this.Form.prototype = ecma.lang.createPrototype(CDispatcher);

  _proto.mapFormDefinition = function (def, vals) {
    var model = {
      'action': def.getValue('action'),
      'submit': def.getValue('submit'),
      'fieldsets': []
    };
    def.getValue('fieldsets').iterate(function (i, fs) {
      model.fieldsets.push(new ecma.lsn.forms.Fieldset(fs, vals));
    }, this);
    return model;
  };

  _proto.getRootElement = function () {
    return this.uiRoot || this.createUI();
  };

  _proto.focus = function () {
    if (!this.uiFirstVisibleControl) return;
    this.uiFirstVisibleControl.focus();
  };

  _proto.disableForm = function () {
  };

  _proto.enableForm = function () {
  };

  _proto.resetForm = function () {
  };

  _proto.submitForm = function () {
    var values = this.getValues();
    this.doSubmitValues(values);
  };

  _proto.submitFormChanges = function () {
    if (!this.hasChanged()) return false;
    var values = this.getChangedValues();
    this.doSubmitValues(values);
    return true;
  };

  _proto.createUI = function () {
    var tbody = ecma.dom.createElement('tbody');
    var form = ecma.dom.createElement('form', {
      'method': 'POST',
      'autocomplete': 'off',
      'onSubmit': [this.onFormSubmitEvent, this]
    }, [
      'table', [tbody]
    ]);
    if (this.model.submit) {
      form.appendChild(ecma.dom.createElement('div',
        {'class': 'buttons'}, [
        'input', {
          'type': 'submit',
          'name': 'submit',
          'value': this.model.submit
        }
      ]));
    }
    delete this.uiFirstVisibleControl;
    for (var i = 0, fs; fs = this.model.fieldsets[i]; i++) {
      if (fs.heading) {
        tbody.appendChild(ecma.dom.createElement(
          'tr', ['th', {'colspan':2}, ['h4', ['#text', {'nodeValue': fs.heading}]]]
        ));
      }
      for (var j = 0, field; field = fs.fields[j]; j++) {
        if (field.isHidden()) {
          form.appendChild(field.getControlElement());
        } else {
          tbody.appendChild(field.getRootElement());
          if (!this.uiFirstVisibleControl) {
            this.uiFirstVisibleControl = field.getControlElement();
          }
        }
      }
    }
    return this.uiRoot = form;
  };

  _proto.onFormSubmitEvent = function (event) {
    ecma.dom.stopEvent(event);
    this.submitForm();
  };

  _proto.getFields = function () {
    var fields = [];
    var fieldsets = this.model.fieldsets;
    for (var i = 0, fs; fs = fieldsets[i]; i++) {
      for (var j = 0, field; field = fs.fields[j]; j++) {
        fields.push(field);
      }
    }
    return fields;
  };

  _proto.getValues = function () {
    var values = {};
    var fields = this.getFields();
    for (var j = 0, field; field = fields[j]; j++) {
      values[field.getName()] = field.getValue();
    }
    return values;
  };

  _proto.getChangedValues = function () {
    var values = {};
    var fields = this.getFields();
    for (var j = 0, field; field = fields[j]; j++) {
      if (field.hasChanged()) values[field.getName()] = field.getValue();
    }
    return values;
  };

  _proto.hasChanged = function () {
    var values = this.getChangedValues();
    for (var k in values) { return true; }
    return false;
  };

  _proto.doSubmitValues = function (values) {
    var params = new ecma.data.HashList();
    for (var k in values) {
      params.set(k, values[k]);
    }
    if (this.model.action) {
      var req = new ecma.lsn.Request(this.model.action);
      req.addEventListener('onComplete', this.doSubmitComplete, this);
      req.submit(params);
      this.dispatchClassAction('onSubmit', req);
    } else {
      this.dispatchClassAction('doSubmit', params);
    }
  };

  _proto.doSubmitComplete = function (req) {
    var rc = req.xhr.status;
    if (rc == 200) {
      var data = req && req.responseHash
        ? req.responseHash.get('body')
        : undefined;
      this.dispatchClassAction('onSubmitOk', data);
    } else {
      var ex = new Error(rc + ': ' + req.xhr.responseText);
      this.dispatchClassAction('onSubmitNotOk', ex, req);
    }
    this.dispatchClassAction('onSubmitComplete', req);
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  /**
   * @class Fieldset
   */

  this.Fieldset = function (def, vals) {
    this.fields = [];
    this.heading = def.getValue('heading');
    def.getValue('fields').iterate(function (k, v) {
      var name = v.getValue('name') ? v.getValue('name') : k;
      var value = vals ? vals.get(name) : undefined;
      this.fields.push(new ecma.lsn.forms.Field(name, v, value));
    }, this);
  };

  var _proto = this.Fieldset.prototype = ecma.lang.createPrototype();

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  /**
   * @class Field
   */

  this.Field = function (name, data, value) {
    this.name = name;
    this.original = ecma.util.defined(value) && value != '' ? value : undefined;
    this.model = this.loadFieldData(data);
    this.id = this.createId();
    this.adaptor = undefined;
  };

  var _proto = this.Field.prototype = ecma.lang.createPrototype();

  _proto.createId = function () {
    return ecma.util.randomId(this.model.type + '_');
  };

  _proto.loadFieldData = function (data) {
    var model = {'type': 'text', 'value': '', 'label':'', 'name': this.name};
    ecma.util.overlay(model, data.toObject());
    if (model.val && !model.value) {
      // upgrade depricated format: 'val' is now 'value'
      model.value = model.val;
      delete model.val;
    }
    if (ecma.util.defined(this.original)) {
      model.value = this.original; // overrides default value
    }
    return model;
  };

  _proto.isHidden = function () {
    return this.model.type == 'hidden';
  };

  _proto.getName = function () {
    return this.name;
  };

  _proto.getValue = function () {
    return this.adaptor
      ? this.adaptor.serialize()
      : this.uiControl
        ? ecma.dom.getValue(this.uiControl)
        : undefined;
  };

  _proto.hasChanged = function () {
    var value = this.getValue();
    return this.model.type == 'password' && value == '*****' ? false :
      value == '' && !ecma.util.defined(this.original) ? false :
      value != this.original;
  };

  _proto.getRootElement = function () {
    return this.uiRoot || this.createUI();
  };

  _proto.getLabelElement = function () {
    return this.uiLabel || this.createLabel();
  };

  _proto.getControlElement = function () {
    return this.uiControl || this.createControl();
  };

  _proto.createUI = function () {
    var tr = ecma.dom.createElement('tr', [
      'th', [this.getLabelElement()],
      'td', [this.getControlElement()]
    ]);
    return this.uiRoot = tr;
  };

  _proto.createLabel = function () {
    var label = ecma.dom.createElement('label', {'for': this.id}, [
      '#text', {'nodeValue':this.model.label}
    ]);
    return this.uiLabel = label;
  };

  _proto.createControl = function () {
    var model = this.model;
    var tag = '';
    var adaptor = undefined;
    var attrs = {'id': this.id, 'class': model.type, 'name': this.name};
    var cnodes = [];
    var initialValue = model.value;
    switch (model.type) {
      case 'text':
        adaptor = ecma.lsn.forms.InputText;
        var maxLength = ecma.util.defined(model.maxlength)
          ? model.maxlength
          : 64;
        tag = 'input';
        attrs.type = 'text';
        attrs.maxlength = maxLength;
        break;
      case 'textarea':
        adaptor = ecma.lsn.forms.InputTextarea;
        tag = 'textarea';
        break;
      case 'password':
        adaptor = ecma.lsn.forms.InputText;
        tag = 'input';
        initialValue = model.value ? '*****' : '';
        attrs.type = 'password';
        break;
      case 'date':
        adaptor = ecma.lsn.forms.InputDate;
        tag = 'input';
        attrs.type = 'text';
        break;
      case 'hidden':
        tag = 'input';
        attrs.type = 'hidden';
        break;
      case 'select':
        tag = 'select';
        if (model.options) {
          for (var i = 0, opt; opt = model.options[i]; i++) {
            var opt_attrs = typeof(opt) === 'string'
              ? {'value': opt, 'innerHTML': opt}
              : {'value': opt.value, 'innerHTML': opt.text};
            if (opt.value == model.value) opt_attrs.selected = 'selected';
            cnodes.push('option', opt_attrs);
          }
        }
        break;
      case 'decimal':
        adaptor = ecma.lsn.forms.InputDecimal;
        tag = 'input';
        attrs.type = 'text';
        break;
      case 'checkbox':
      case 'radio':
      case 'file':
      case 'time':
      case 'datetime':
      case 'integer':
      case 'currency':
      default:
        throw new Error('Not a known form input control type: ' + model.type);
    }
    this.uiControl = ecma.dom.createElement(tag, attrs, cnodes);
    if (adaptor) {
      this.adaptor = new adaptor(this.uiControl);
      this.adaptor.sync();
    }
    if (initialValue) {
      if (this.adaptor) {
        this.adaptor.deserialize(initialValue);
      } else {
        ecma.dom.setValue(this.uiControl, initialValue);
      }
    }
    return this.uiControl;
  }

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  /**
   *
   *        .------------------------------------------------------------------ serialized notation
   *        |
   *        |                .------------------------------------------------- javascript object
   *        |                |
   *        |                |                   .----------------------------- ui string notation
   *        |                |                   |
   *        |                |                   |                    .-------- user input
   *        |                |                   |                    |
   *  [data string] <---> [object] <---> [control string] <---> [input element]
   *                  |              |                      |
   *                  |              |                      '------------------ read/write
   *                  |              |
   *                  |              '----------------------------------------- unmarshal/marshal
   *                  |
   *                  '-------------------------------------------------------- serialize/deserialize
   *
   * For example:
   *
   *  [3.14E0] <---> [Number] <---> [3.14] <---> [input element]
   *
   *    * When the user enters "abc", which is not a number, the control string
   *      should become "0.00" and the input element updated.  The internal
   *      value (which is a Number) is set to zero.
   *
   * The input control interracts with JavaScript using:
   *
   *    * getValue, which returns the internal value object
   *
   *    * setValue, which takes an object of the same type as the internal
   *      value object
   *
   *    * serialize, which returns a storable data string
   *
   *    * deserialize, which takes a String as would be returned by serialize.
   *
   * The input control interracts with the user using:
   *
   *    * read, which reads the value from the element and sets the internal 
   *      value object accordingly.
   *
   *    * write, which sets the value of the element from the internal value
   *      object.
   *
   *    * sync, which responds to an onChange event, reading the new value and
   *      then writing it back out.
   *
   */

  var CAction = ecma.action.ActionDispatcher;

  this.InputBase = function (elem) {
    CAction.apply(this);
    this.elem = null;
    this.value = this.emptyValue = null;
    this.evtChange = null;
    if (elem) this.attach(elem);
  };

  var InputBase = this.InputBase.prototype = ecma.lang.createPrototype(CAction);
  
  InputBase.attach = function (elem) {
    elem = ecma.dom.getElement(elem);
    if (!elem) throw new Error('Missing input element');
    this.elem = elem;
    this.evtChange = new ecma.dom.EventListener(
      this.elem, 'change', function(event){
        this.sync();
        this.dispatchAction('change', this);
      }, this
    );
  };

  InputBase.detach = function () {
    if (this.evtChange) this.evtChange.remove();
  };

  InputBase.reset = function () {
    return this.setValue(this.emptyValue);
  };

  InputBase.getValue = function () {
    this.read();
    return this.value;
  };

  InputBase.setValue = function (value) {
    this.value = value;
    this.write();
    return this;
  };

  InputBase.sync = function () {
    this.read();
    this.write();
    return this;
  };

  InputBase.read = function () {
    this.value = this.unmarshal(ecma.dom.getValue(this.elem));
    return this;
  };

  InputBase.write = function () {
    ecma.dom.setValue(this.elem, this.marshal(this.value));
    return this;
  };

  InputBase.marshal = function (dataValue) {
    var ctrlValue = dataValue;
    return ctrlValue;
  };

  InputBase.unmarshal = function (ctrlValue) {
    var dataValue = ctrlValue;
    return dataValue;
  };

  InputBase.deserialize = function (storedValue) {
    this.setValue(storedValue);
    return this;
  };

  InputBase.serialize = function () {
    return this.getValue();
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  var CInputBase = this.InputBase;

  var _proto = ecma.lang.createPrototype(CInputBase);

  /**
   * @class InputBoolean
   */

  this.InputBoolean = function (elem) {
    CInputBase.apply(this, [elem]);
    this.value = this.emptyValue = new Boolean();
  };

  this.InputBoolean.prototype = _proto;

  _proto.marshal = function (dataValue) {
    try {
      return dataValue.valueOf() ? 1 : 0;
    } catch (ex) {
      js.console.log(ex);
      return 0;
    }
  };

  _proto.unmarshal = function (ctrlValue) {
    return new Boolean(ecma.util.asInt(ctrlValue));
  };

  _proto.deserialize = function (storedValue) {
    this.setValue(new Boolean(ecma.util.asInt(storedValue)));
    return this;
  };

  _proto.serialize = function () {
    return this.getValue().valueOf() ? '1' : '0';
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  var CInputBase = this.InputBase;

  var _proto = ecma.lang.createPrototype(CInputBase);

  /**
   * @class InputDate
   */

  this.InputDate = function (elem, format) {
    CInputBase.apply(this, [elem]);
    this.format = format || 'm/d/yyyy';
    this.invalidValue = new Date(0);
    this.value = this.emptyValue = new Date();
  };

  this.InputDate.prototype = _proto;

  _proto.marshal = function (dataValue) {
    try {
      return ecma.date.format(dataValue, this.format);
    } catch (ex) {
      js.console.log(ex);
      return ecma.date.format(this.invalidValue, this.format);
    }
  };

  _proto.unmarshal = function (ctrlValue) {
    var now = new Date();
    var parts = ctrlValue.match(/(\d+)/g);
    var date;
    if (parts) {
      var m = parts[0] || now.getMonth();
      var d = parts[1] || now.getDate();
      var y = parts[2] || now.getFullYear();
      var yyyy;
      y = ecma.util.pad(new String(y), 2);
      var len = 4 - y.length;
      if (len < 0) yyyy = y.substr(0, 4);
      if (len == 0) yyyy = y;
      if (len > 0) {
        var prefix = new String(now.getFullYear()).substr(0, len);
        yyyy = prefix + y;
      }
      m = m - 1;
      return new Date(yyyy, m, d);
    } else {
      return now;
    }
  };

  _proto.deserialize = function (storedValue) {
    this.setValue(new Date(storedValue));
    return this;
  };

  _proto.serialize = function () {
    return this.getValue().toUTCString();
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  var CInputBase = this.InputBase;

  var _proto = ecma.lang.createPrototype(CInputBase);

  /**
   * @class InputDecimal
   */

  this.InputDecimal = function (elem, digits) {
    CInputBase.apply(this, [elem]);
    this.digits = ecma.util.defined(digits) ? digits : 2;
    this.value = this.emptyValue = new Number();
  };

  this.InputDecimal.prototype = _proto;

  _proto.marshal = function (dataValue) {
    return dataValue.toFixed(this.digits);
  };

  _proto.unmarshal = function (ctrlValue) {
    return new Number(ctrlValue);
  };

  _proto.deserialize = function (storedValue) {
    this.setValue(new Number(storedValue));
    return this;
  };

  _proto.serialize = function () {
    return this.getValue().valueOf();
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  var CInputBase = this.InputBase;

  var _proto = ecma.lang.createPrototype(CInputBase);

  /**
   * @class InputText
   */

  this.InputText = function (elem) {
    CInputBase.apply(this, [elem]);
    this.value = this.emptyValue = new String();
  };

  this.InputText.prototype = _proto;

  _proto.deserialize = function (storedValue) {
    this.setValue(ecma.data.entities.encode(storedValue));
    return this;
  };

  _proto.serialize = function () {
    return ecma.data.entities.decode(this.getValue(), true);
  };

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  /**
   * @class InputTextarea
   */

  this.InputTextarea = this.InputText;

});

/** @namespace lsn.forms */
ECMAScript.Extend('lsn.forms', function (ecma) {

  var CInputBase = this.InputBase;

  var _proto = ecma.lang.createPrototype(CInputBase);

  this.InputCheckbox = function (elem) {
    CInputBase.apply(this, [elem]);
    this.value = this.emptyValue = new Boolean(false);
  };

  this.InputCheckbox.prototype = _proto;

  _proto.marshal = function (dataValue) {
    return dataValue.valueOf();
  };

  _proto.unmarshal = function (ctrlValue) {
    var bPrimitive = ctrlValue == 'off'
      ? false
      : ctrlValue
        ? true
        : false;
    return new Boolean(bPrimitive);
  };

  _proto.deserialize = function (storedValue) {
    this.setValue(new Boolean(storedValue));
    return this;
  };

  _proto.serialize = function () {
    return this.getValue().valueOf() ? 1 : 0;
  };

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  /**
   * @instance css <ecma.dom.StyleSheet>
   * Local StyleSheet which holds the dynamic styles
   */
  this.css = new ecma.dom.StyleSheet();

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  /**
   * @class ResizeRule
   */

  this.ResizeRule = function (ruleName, values) {
    this.ruleName = ruleName;
    this.values = values;
    this.update(0, 0);
  };

  var ResizeRule = this.ResizeRule.prototype = ecma.lang.createPrototype();

  ResizeRule.adjust = function (prop, px) {
    this.values[prop] = (ecma.util.asInt(this.values[prop]) + px) + 'px';
  };

  ResizeRule.update = function (x, y) {
    this.values.width += x;
    this.values.height += y;
    ecma.lsn.layout.css.updateRule(this.ruleName, this.toCSS());
  };

  ResizeRule.toCSS = function () {
    var result = '';
    for (name in this.values) {
      result += name + ':' + this.values[name] + 'px;';
    }
    return result;
  };

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  var BOX = 0;
  var ROW = 1;
  var COLUMN = 2;

  var CDispatcher = ecma.action.ActionDispatcher;

  /**
   * @class Area
   * @param type ROW|BOX|COLUMN
   * @param name <String>
   * @param size [Number]
   * @param options [Object]
   *
   * Options
   *
   *  style_by:     'class'; (Default) Style-sheet rules are specified as .name
   *                'id'; Style-sheet rules are specified as #name
   *
   *  structure:    'flat'; (Default) Origin is viewport
   *                'nested'; Origin is the containing area
   *                'wrap';   No origin, layout is for width or height only
   *
   *  gap:          [top,right,bottom,left]
   *                [top,right+left,bottom]
   *                [top+bottom,right+left]
   *                [top+right+bottom+left]
   */

  /*
   * Note, I tried to improve peformance by setting the last split to use 
   * right/bottom values instead of top/left. It made no difference and 
   * ultimately added many more calculations not to mention code to read.
   */

  this.Area = function (type, name, size, options) {
    CDispatcher.apply(this);
    this.options = ecma.util.overlay({}, options);
    this.type = type;
    this.name = name || this.options.name || ecma.util.randomId('area');
    this.size = size; // Original size definition
    this.ruleName = this.options.style_by == 'id' ? '#' : '.';
    this.ruleName += this.name;
    this.structure = this.options.structure || 'flat';
    this.gap = this.parseGap(this.options.gap);
    this.ratio = null; // Used for proportional dimensions
    this.fixed = null; // Used for fixed dimensions
    this.sumFixed = 0;
    this.sumRatio = 0;
    this.sumGap = {width:0,height:0};
    this.splitType = null;
    this.splits = [];
    this.layouts = [];
    this.hasInitialized = false;
    this.region = {};
  };

  var Area = this.Area.prototype = ecma.lang.createPrototype(CDispatcher);

  Area.getArea = function (name) {
    var result = null;
    if (this.name === name) {
      result = this;
    }
    for (var i = 0; !result && i < this.splits.length; i++) {
      result = this.splits[i].getArea(name);
    }
    for (var i = 0; !result && i < this.layouts.length; i++) {
      result = this.layouts[i].getArea(name);
    }
    return result;
  };

  Area.addArea = function (type, name, size, opts) {
    if (this.splitType && this.splitType !== type) {
      throw new Error('Cannot mix rows and columns');
    }
    if (this.hasInitialized) {
      throw new Error('Cannot create areas after initialization');
    }
    this.splitType = type;
    var options = this.getCascadingOptions();
    if (ecma.util.isArray(opts)) {
      options.gap = opts
    } else {
      ecma.util.overlay(options, opts);
    }
    var area = new ecma.lsn.layout.Area(type, name, size, options);
    this.splits.push(area);
    return area;
  };

  Area.addRow = function (name, size, opts) {
    return this.addArea(ROW, name, size, opts);
  };

  Area.addColumn = function (name, size, opts) {
    return this.addArea(COLUMN, name, size, opts);
  };

  Area.addLayout = function (opts) {
    var options = this.getCascadingOptions();
    if (ecma.util.isArray(opts)) {
      options.gap = opts
    } else {
      ecma.util.overlay(options, opts);
    }
    var layout = new ecma.lsn.layout.Layout(options);
    this.layouts.push(layout);
    return layout;
  };

  /**
   * @function getCascadingOptions
   */

  Area.getCascadingOptions = function () {
    return {
      'style_by': this.options.style_by,
      'structure': this.options.structure
    };
  };

  /**
   * @function parseGap
   * @param spec <Array>
   */

  Area.parseGap = function (spec) {
    var p = {
      'top': 0,
      'right': 0,
      'bottom': 0,
      'left': 0,
      'width': 0,
      'height': 0
    };
    if (!spec || spec.length == 0) {
      return p;
    } else if (spec && !ecma.util.isArray(spec)) {
      throw new Error('Not an array: gap');
    } else if (spec.length == 1) {
      p.top = spec[0];
      p.right = spec[0];
      p.bottom = spec[0];
      p.left = spec[0];
    } else if (spec.length == 2) {
      p.top = spec[0];
      p.right = spec[1];
      p.bottom = spec[0];
      p.left = spec[1];
    } else if (spec.length == 3) {
      p.top = spec[0];
      p.right = spec[1];
      p.bottom = spec[2];
      p.left = spec[1];
    } else if (spec.length == 4) {
      p.top = spec[0];
      p.right = spec[1];
      p.bottom = spec[2];
      p.left = spec[3];
    } else {
      throw new Error('Too many values: gap');
    }
    p.width = p.left + p.right;
    p.height = p.top + p.bottom;
    return p;
  };

  Area.allocate = function () {
    var spread = [];
    this.sumGap = {width:0,height:0};
    for (var i = 0, area; area = this.splits[i]; i++) {
      if (!ecma.util.defined(area.size)) {
        spread.push(area);
      } else {
        if (area.size > 0 && area.size < 1) {
          this.sumRatio += area.size;
          area.ratio = area.size;
        } else {
          this.sumFixed += area.size;
          area.fixed = area.size;
        }
      }
      this.sumGap.width += area.gap.width;
      this.sumGap.height += area.gap.height;
    }
    if (spread.length > 0) {
      var free = Math.floor(100 * (1 - this.sumRatio));
      var a = Math.round(free / spread.length);
      var r = free - (spread.length * a);
      for (var i = 0, area; area = spread[i]; i++) {
        var ratio = i == 0 ? (a + r) / 100 : a / 100;
        area.ratio = ratio;
        this.sumRatio += ratio;
      }
    }
  };

  Area.getStyleSheet = function () {
    return ecma.lsn.layout.css;
  };

  Area.updateRule = function () {
    var ruleText = '';
    var ruleRegion = this.getRuleRegion();
    for (name in ruleRegion) {
      var propRuleValue = name + ':' + ruleRegion[name] + 'px;';
      var propRuleName = this.ruleName + '-' + name;
      //js.console.log(propRuleName, propRuleValue);
      this.getStyleSheet().updateRule(propRuleName, propRuleValue);
      ruleText += propRuleValue;
    }
    //js.console.log(this.ruleName, ruleText);
    this.getStyleSheet().updateRule(this.ruleName, ruleText);
    for (var i = 0; i < this.layouts.length; i++) {
      this.layouts[i].update(this.getRegion());
    }
    this.dispatchAction('onUpdate', this);
  };

  Area.initialize = function () {
    this.allocate();
    this.createStyles();
    for (var i = 0, area; area = this.splits[i]; i++) {
      area.initialize();
    }
    for (var i = 0, layout; layout = this.layouts[i]; i++) {
      layout.initialize();
    }
    this.hasInitialized = true;

    this.dispatchAction('onInitialize', this);
  };

  Area.update = function (region) {
    this.setRegion(region, this.getVariableLength());
    this.propagate();
  };

  // Do not add 'overflow: auto;' here
  Area.createStyles = function () {
    if (this.structure == 'wrap') return;
    this.getStyleSheet().createRule(this.ruleName, {
      'position': 'absolute'
    });
  };

  Area.getBoundingBox = function () {
    var region = this.cloneRegion(this.region);
    region.width += this.gap.width;
    region.height += this.gap.height;
    if (this.structure == 'nested' || this.structure == 'wrap') {
      region.left = 0;
      region.top = 0;
    } else {
      region.top -= this.gap.top;
      region.left -= this.gap.left;
    }
    //this.log('{', this.ruleName, region, this.structure);
    return region;
  };

  Area.getRegion = function () {
    var region = this.cloneRegion(this.region);
    if (this.structure == 'nested' || this.structure == 'wrap') {
      region.top = 0;
      region.left = 0;
    }
    return region;
  };

  Area.getRuleRegion = function () {
    return this.structure == 'wrap'
      ? this.splitType == ROW
        ? {'height': this.region.height}
        : {'width': this.region.width}
      : this.cloneRegion(this.region);
  };

  Area.getVariableLength = function () {
    var dim = this.splitType == ROW ? 'height' : 'width';
    return this.region[dim] - this.sumFixed - this.sumGap[dim];
  };

  Area.setRegion = function (region, length) {
    //this.log('>', this.ruleName, region);
    this.region.top = region.top + this.gap.top;
    this.region.left = region.left + this.gap.left;
    this.region.width = this.type === ROW
      ? region.width - this.gap.width
      : this.ratio
        ? Math.floor(length * this.ratio)
        : this.fixed;
    this.region.height = this.type === COLUMN
      ? region.height - this.gap.height
      : this.ratio
        ? Math.floor(length * this.ratio)
        : this.fixed;
    this.updateRule();
    //this.log('<', this.ruleName, this.region, 'r='+this.ratio, 'f='+this.fixed);
    return this.getRegion();
  };

  Area.propagate = function () {
    function _propagate (dim, side) {
      var region = this.getRegion();
      var length = this.getVariableLength();
      var used = 0;
      var fill = null;
      for (var i = 0, area; area = this.splits[i]; i++) {
        var inner = area.setRegion(region, length);
        var outer = area.getBoundingBox();
        if (area.ratio) {
          fill = area;
          used += inner[dim];
        }
        region[side] += outer[dim];
      }
      if (this.sumRatio && fill) {
        var actual = Math.round(length * this.sumRatio);
        var delta = actual - used;
        if (delta > 0 && used > 0) {
          fill.region[dim] += delta;
          fill.updateRule();
        }
      }
      for (var i = 0, area; area = this.splits[i]; i++) {
        area.propagate();
      }
    }
    if (this.splitType === COLUMN) _propagate.apply(this, ['width', 'left']);
    if (this.splitType === ROW) _propagate.apply(this, ['height', 'top']);
  };

  /**
   * @function log
   * @param symbol
   * @param ruleName
   * @param region
   * @params ...
   */

  Area.log = function (/*...*/) {
    var args = ecma.util.args(arguments);
    var r = args[2];
    args[1] = ecma.util.pad(args[1], 10, ' ');
    args[2] = 
      ecma.util.pad(r.top, 4, ' ') + ' ' +
      ecma.util.pad(r.left, 4, ' ') + ' ' +
      ecma.util.pad(r.width, 4, ' ') + ' ' +
      ecma.util.pad(r.height, 4, ' ');
    js.console.log.apply(null, args);
  };

  Area.cloneRegion = function (region) {
    var result = {};
    if ('width' in region) result.width = region.width;
    if ('height' in region) result.height = region.height;
    if ('top' in region) result.top = region.top;
    if ('left' in region) result.left = region.left;
    return result;
  };

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  var CArea = ecma.lsn.layout.Area;

  /**
   * @class Layout
   */

  this.Layout = function (opts) {
    CArea.apply(this, [0, null, 1, opts]);
  };

  var Layout =
  this.Layout.prototype = ecma.lang.createPrototype(
    CArea
  );

  Layout.getRuleRegion = function () {
    return this.getBoundingBox();
  };

  Layout.setRegion = function (region) {
    this.region = this.cloneRegion(region);
    this.region.top += this.gap.top;
    this.region.left += this.gap.left;
    this.region.width -= this.gap.width;
    this.region.height -= this.gap.height;
    this.updateRule();
    return this.getRegion();
  };

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  var CPage = ecma.lsn.ui.Page;
  var CArea = ecma.lsn.layout.Area;

  /**
   * @class ViewportLayout
   */

  this.ViewportLayout = function (opts) {
    CPage.apply(this);
    CArea.apply(this, [0, 'canvas', 1, opts]);
    this.ruleName = 'html body'; // Overrides CArea
    this.pgRefreshRate = 64; // Overrides CPage
    this.resizeRules = []; // Self-adjusting rules
  };

  var ViewportLayout =
  this.ViewportLayout.prototype = ecma.lang.createPrototype(
    CPage,
    CArea
  );

  ViewportLayout.onPageLoad = function (event) {
    this.initialize();
    var vp = this.getViewport();
    this.addResizeRule('html', {
      'width': vp.width,
      'height': vp.height
    });
    this.update(vp);
  };

  ViewportLayout.onPageResize = function (event) {
    var vp = this.getViewport();
    var w = vp.delta.width;
    var h = vp.delta.height;
    for (var i = 0, rule; rule = this.resizeRules[i]; i++) {
      rule.update(w, h);
    }
    this.region.width += w;
    this.region.height += h;
    this.updateRule();
    this.propagate();
  };

  ViewportLayout.getRuleRegion = function () {
    return this.getBoundingBox();
  };

  ViewportLayout.setRegion = function (region) {
    this.region = this.cloneRegion(region);
    this.region.top += this.gap.top;
    this.region.left += this.gap.left;
    this.region.width -= this.gap.width;
    this.region.height -= this.gap.height;
    this.updateRule();
    return this.getRegion();
  };

  ViewportLayout.createStyles = function () {
    ecma.lsn.layout.css.createRule('html', {
      'margin': '0',
      'padding': '0',
      'position': 'absolute',
      'overflow': 'hidden',
      'top': '0',
      'left': '0'
    })
    ecma.lsn.layout.css.createRule('html body', {
      'margin': '0',
      'padding': '0',
      'position': 'absolute'
    });
    for (var i = 0, area; area = this.splits[i]; i++) {
      area.createStyles();
    }
  };

  ViewportLayout.addResizeRule = function (name, values) {
    var rule = new ecma.lsn.layout.ResizeRule(name, values);
    this.resizeRules.push(rule);
    return rule;
  };

});

/** @namespace lsn.layout */
ECMAScript.Extend('lsn.layout', function (ecma) {

  var CPage = ecma.lsn.ui.Page;
  var CArea = ecma.lsn.layout.Area;

  /**
   * @class WrapperLayout
   *
   * Required 'wrapper' option which specifies wrapper
   */

  this.WrapperLayout = function (opts) {
    var options = ecma.util.overlay({'structure':'wrap'}, opts);
    this.pgRefreshRate = 64; // Overrides CPage
    CArea.apply(this, [0, null, 1, options]);
    CPage.apply(this);
  };

  var WrapperLayout =
  this.WrapperLayout.prototype = ecma.lang.createPrototype(
    CPage,
    CArea
  );

  WrapperLayout.onPageLoad = function (event) {
    this.initialize();
    var region = js.dom.getElementPosition(this.wrapperElement);
    this.update(region);
  };

  WrapperLayout.onPageResize = function (event) {
    var vp = this.getViewport();
    var w = vp.delta.width;
    var h = vp.delta.height;
    this.region.width += w;
    this.region.height += h;
    this.updateRule();
    this.propagate();
  };

  WrapperLayout.initialize = function () {
    CArea.prototype.initialize.call(this);
    this.wrapperElement = js.dom.getElement(this.options.wrapper);
  };

  WrapperLayout.getRuleRegion = function () {
    return this.getBoundingBox();
  };

  WrapperLayout.setRegion = function (region) {
    this.region = this.cloneRegion(region);
    this.region.top += this.gap.top;
    this.region.left += this.gap.left;
    this.region.width -= this.gap.width;
    this.region.height -= this.gap.height;
    this.updateRule();
    return this.getRegion();
  };

  WrapperLayout.createStyles = function () {
    for (var i = 0, area; area = this.splits[i]; i++) {
      area.createStyles();
    }
  };

});

/**
 * @global js
 * @function extend
 * @member window
 * @member document
 *
 * A global instance of the library running under the context of the current 
 * window and document:
 *
 *  var js = new L<ECMAScript.Class>(window, document);
 *
 * From the perspective of the code which B<uses> the library we refer to the
 * running instance as C<js>.  The name C<js> is not set in stone, it is simply
 * the default name with which the library is built.
 *
 *  js.console.log("Hello World");    // Normal usage
 *
 * From the perspective of the packages which make up the library, we refer
 * to the running instance as C<ecma>.  The name C<ecma> is not set in stone,
 * it is simply the default parameter name which we have standardized upon.
 *
 =  ecma.console.log("Hello World");  // Calling from inside a library package
 *
 */
js = new ECMAScript.Class(window, document);

