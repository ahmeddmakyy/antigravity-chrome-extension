import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http2 = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http2 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// src/daemon.ts
import path7 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/token.ts
import fs2 from "fs";
import path2 from "path";
import crypto from "crypto";

// src/paths.ts
import os from "os";
import path from "path";
import fs from "fs";
function getDataDir() {
  if (process.env.MYCHROME_DATA_DIR) {
    return path.resolve(process.env.MYCHROME_DATA_DIR);
  }
  const home = process.env.MYCHROME_HOME_DIR || os.homedir();
  return path.join(home, ".gemini", "mychrome");
}
function getTokenPath(fallbackDir) {
  if (process.env.MYCHROME_TOKEN_FILE) {
    return path.resolve(process.env.MYCHROME_TOKEN_FILE);
  }
  const dataDirToken = path.join(getDataDir(), ".token");
  if (fs.existsSync(dataDirToken)) {
    return dataDirToken;
  }
  if (fallbackDir) {
    const fallbackToken = path.join(fallbackDir, ".token");
    if (fs.existsSync(fallbackToken)) {
      return fallbackToken;
    }
  }
  return dataDirToken;
}
function getLogsDir(fallbackDir) {
  if (process.env.MYCHROME_LOGS_DIR) {
    return path.resolve(process.env.MYCHROME_LOGS_DIR);
  }
  const dataDir = getDataDir();
  if (fallbackDir && !fs.existsSync(dataDir) && fs.existsSync(fallbackDir)) {
    return path.join(fallbackDir, "logs");
  }
  const logs = path.join(dataDir, "logs");
  try {
    if (!fs.existsSync(logs)) {
      fs.mkdirSync(logs, { recursive: true, mode: 448 });
    }
  } catch {
  }
  return logs;
}
function getUploadsDir(fallbackDir) {
  if (process.env.MYCHROME_UPLOADS_DIR) {
    return path.resolve(process.env.MYCHROME_UPLOADS_DIR);
  }
  const dataDir = getDataDir();
  if (fallbackDir && !fs.existsSync(dataDir) && fs.existsSync(fallbackDir)) {
    return path.join(fallbackDir, "uploads");
  }
  const uploads = path.join(dataDir, "uploads");
  try {
    if (!fs.existsSync(uploads)) {
      fs.mkdirSync(uploads, { recursive: true, mode: 448 });
    }
  } catch {
  }
  return uploads;
}

// src/token.ts
function getOrCreatePairingToken(baseDir) {
  const tokenPath = getTokenPath(baseDir);
  try {
    if (fs2.existsSync(tokenPath)) {
      const existing = fs2.readFileSync(tokenPath, "utf-8").trim();
      if (existing.length >= 16) {
        return { token: existing, isNew: false };
      }
    }
  } catch {
  }
  const dir = path2.dirname(tokenPath);
  try {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true, mode: 448 });
    }
  } catch {
  }
  const newToken = crypto.randomBytes(24).toString("hex");
  try {
    fs2.writeFileSync(tokenPath, newToken, { encoding: "utf-8", mode: 384 });
  } catch (err) {
    console.error(`[Token] Failed to write token to ${tokenPath}:`, err);
  }
  return { token: newToken, isNew: true };
}

// src/logger.ts
import fs3 from "fs";
import path3 from "path";
var Logger = class {
  logFilePath;
  listeners = [];
  constructor(logsDir) {
    if (!fs3.existsSync(logsDir)) {
      try {
        fs3.mkdirSync(logsDir, { recursive: true });
      } catch (err) {
      }
    }
    this.logFilePath = path3.join(logsDir, "bridge.log");
  }
  addListener(listener) {
    this.listeners.push(listener);
  }
  removeListener(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  log(level, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const dataStr = data ? " " + (typeof data === "string" ? data : JSON.stringify(data)) : "";
    const line = `[${timestamp}] [${level}] ${message}${dataStr}
`;
    try {
      fs3.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
    }
    if (level === "ERROR" || level === "WARN") {
      process.stderr.write(line);
    }
    for (const listener of this.listeners) {
      try {
        listener(level, message, data);
      } catch {
      }
    }
  }
  getRecentLines(maxLines = 500) {
    try {
      if (!fs3.existsSync(this.logFilePath)) return [];
      const content = fs3.readFileSync(this.logFilePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }
  info(msg, data) {
    this.log("INFO", msg, data);
  }
  warn(msg, data) {
    this.log("WARN", msg, data);
  }
  error(msg, data) {
    this.log("ERROR", msg, data);
  }
  debug(msg, data) {
    this.log("DEBUG", msg, data);
  }
};

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// src/ws-server.ts
import http from "http";
import { spawn } from "child_process";
import fs5 from "fs";
import path5 from "path";

// src/version.ts
var BRIDGE_VERSION = "5.2.0";

// src/constants.ts
var EXTENSION_ID = "aeofpcedejopeeebdjfkapcabkkflhej";
var EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

// src/upload-manager.ts
import fs4 from "fs";
import path4 from "path";
var WINDOWS_RESERVED = /* @__PURE__ */ new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9"
]);
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
function sanitizeFileName(rawName) {
  if (!rawName || typeof rawName !== "string") return "upload";
  let clean = rawName.trim().split(/[\\/]/).pop() || "";
  clean = clean.replace(/[\x00-\x1f<>:"/\\|?*]/g, "_");
  clean = clean.replace(/[. ]+$/, "");
  if (!clean) clean = "upload";
  const ext = path4.extname(clean);
  const stem = path4.basename(clean, ext);
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    clean = `_${stem}${ext}`;
  }
  if (clean.length > 120) {
    const safeExt = ext.slice(0, 15);
    const safeStem = stem.slice(0, 100);
    clean = `${safeStem}${safeExt}`;
  }
  return clean;
}
async function saveAttachment(messageId, index, attachment, customUploadsDir) {
  const uploadsRoot = customUploadsDir || getUploadsDir();
  const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const dayDir = path4.join(uploadsRoot, dateStr);
  if (!fs4.existsSync(dayDir)) {
    fs4.mkdirSync(dayDir, { recursive: true, mode: 448 });
  }
  const safeName = sanitizeFileName(attachment.name || `file_${index}`);
  const fileName = `${messageId}-${index}-${safeName}`;
  const filePath = path4.join(dayDir, fileName);
  let rawData = attachment.data;
  const commaIdx = rawData.indexOf(",");
  if (commaIdx !== -1 && rawData.slice(0, commaIdx).includes(";base64")) {
    rawData = rawData.slice(commaIdx + 1);
  }
  const buffer = Buffer.from(rawData, "base64");
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${attachment.name}" exceeds 10 MB size limit after decoding.`);
  }
  fs4.writeFileSync(filePath, buffer);
  const isImage = attachment.mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(safeName);
  let dataUrl = void 0;
  if (isImage) {
    const mime = attachment.mime || (safeName.endsWith(".png") ? "image/png" : "image/jpeg");
    dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  }
  return {
    name: attachment.name,
    mime: attachment.mime || "application/octet-stream",
    size: buffer.length,
    path: path4.resolve(filePath),
    isImage,
    dataUrl
  };
}
function cleanOldUploads(maxAgeDays = 7, customUploadsDir) {
  const uploadsRoot = customUploadsDir || getUploadsDir();
  if (!fs4.existsSync(uploadsRoot)) return 0;
  let cleaned = 0;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  try {
    const entries = fs4.readdirSync(uploadsRoot, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path4.join(uploadsRoot, entry.name);
      if (entry.isDirectory()) {
        const dateMatch = entry.name.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        let folderAgeMs;
        if (dateMatch) {
          const folderDate = (/* @__PURE__ */ new Date(`${entry.name}T00:00:00Z`)).getTime();
          folderAgeMs = now - folderDate;
        } else {
          const stat = fs4.statSync(fullPath);
          folderAgeMs = now - stat.mtimeMs;
        }
        if (folderAgeMs > maxAgeMs) {
          fs4.rmSync(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      } else if (entry.isFile()) {
        const stat = fs4.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs4.unlinkSync(fullPath);
          cleaned++;
        }
      }
    }
  } catch (err) {
    console.error("[UploadManager] Cleanup error:", err);
  }
  return cleaned;
}

// src/ws-server.ts
function getAllowedOrigins() {
  const allowed = /* @__PURE__ */ new Set([EXTENSION_ORIGIN]);
  if (process.env.MYCHROME_ALLOWED_ORIGINS) {
    for (const o of process.env.MYCHROME_ALLOWED_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }
  return allowed;
}
var RPC_METHODS = /* @__PURE__ */ new Set([
  "askUser",
  "canEndTurnSafely",
  "connectPanel",
  "executeBrowserCommand",
  "formatMessagesForAgent",
  "readPanelMessages",
  "requestConfirmation",
  "sendReply",
  "takeInterrupts",
  "updatePlan",
  "waitForUserMessage",
  "ensureExtension",
  "getAgentStatus"
]);
function toWire(value) {
  return JSON.parse(JSON.stringify(value === void 0 ? null : value, (_k, v) => v instanceof Map ? { __map: [...v.entries()] } : v));
}
function defaultChromeLauncher(url) {
  const tryOne = (cmd, args, opts = {}) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false, ...opts });
      child.on("error", () => {
      });
      child.unref();
      return true;
    } catch {
      return false;
    }
  };
  const custom = process.env.MYCHROME_CHROME_PATH;
  if (custom && fs5.existsSync(custom)) return tryOne(custom, [url]);
  if (process.platform === "win32") {
    const roots = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env["LOCALAPPDATA"]].filter(Boolean);
    for (const r of roots) {
      const exe = path5.join(r, "Google", "Chrome", "Application", "chrome.exe");
      if (fs5.existsSync(exe)) return tryOne(exe, [url]);
    }
    return tryOne("cmd.exe", ["/d", "/s", "/c", `start "" chrome "${url}"`], { windowsVerbatimArguments: true });
  }
  if (process.platform === "darwin") return tryOne("open", ["-a", "Google Chrome", url]);
  for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    for (const dir of (process.env.PATH || "").split(path5.delimiter)) {
      if (dir && fs5.existsSync(path5.join(dir, bin))) return tryOne(path5.join(dir, bin), [url]);
    }
  }
  return false;
}
function connectPageHtml(extensionId) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>MyChrome</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141311;color:#EDE7E0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
  .card{max-width:440px;padding:28px;border-radius:18px;background:#1E1C1A;border:1px solid #2E2A27;text-align:center}
  h1{font-size:18px;margin:0 0 6px} p{margin:0;color:#B7AFA7} code{font:13px ui-monospace,monospace;color:#EDE7E0}
  .dots{display:inline-flex;gap:4px;margin-bottom:14px}.dots i{width:7px;height:7px;border-radius:50%;animation:h 1.2s infinite}
  .dots i:nth-child(1){background:#FFB23E}.dots i:nth-child(2){background:#B892FF;animation-delay:.15s}.dots i:nth-child(3){background:#5EEAD4;animation-delay:.3s}
  @keyframes h{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-4px);opacity:1}}
</style></head><body><div class="card"><div class="dots"><i></i><i></i><i></i></div>
<h1 id="t">Connecting MyChrome</h1><p id="m">This tab closes by itself in a moment.</p></div>
<script>
  var ID=${JSON.stringify(extensionId)};
  function done(){document.getElementById('t').textContent='MyChrome is connected';document.getElementById('m').textContent='You can close this tab.';}
  function missing(){document.getElementById('t').textContent='MyChrome is not installed in this Chrome';
    document.getElementById('m').innerHTML='Open <code>chrome://extensions</code>, turn on Developer mode, click Load unpacked and choose <code>~/.gemini/mychrome/extension</code>.';}
  try{ if(window.chrome&&chrome.runtime&&chrome.runtime.sendMessage){ chrome.runtime.sendMessage(ID,{type:'mychrome_wake'},function(r){ if(chrome.runtime.lastError||!r){missing();} }); } else { missing(); } }catch(e){ missing(); }
  var n=0; var t=setInterval(function(){ n++; fetch('/connected',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){ if(j.connected){clearInterval(t);done();} }).catch(function(){}); if(n>40)clearInterval(t); },500);
</script></body></html>`;
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var WAKER_ONLINE_MS = 45e3;
var WAKER_POLL_MS = 25e3;
var LINK_WINDOW_MS = 18e4;
var MAX_BODY = 1024 * 1024;
var PRESUMED_IDLE_MS = 9e4;
var SAFETY_NO_HOOK_MS = 3e5;
var SAFETY_WITH_HOOK_MS = 9e5;
function summarizeResult(result, max = 1500) {
  if (result === void 0) return "";
  let text;
  try {
    text = typeof result === "string" ? result : JSON.stringify(result);
  } catch {
    text = String(result);
  }
  text = text.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, (m) => `[image ${Math.round(m.length / 1024)} KB]`);
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}
function lightResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    if (Array.isArray(result)) return { count: result.length };
    return void 0;
  }
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === "dataUrl" || k === "elements") continue;
    if (k === "text" && typeof v === "string") {
      out.textLength = v.length;
      continue;
    }
    if (typeof v === "string") out[k] = v.length > 200 ? v.slice(0, 197) + "..." : v;
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length <= 6) {
      const inner = {};
      for (const [ik, iv] of Object.entries(v)) {
        if (typeof iv === "number" || typeof iv === "boolean") inner[ik] = iv;
        else if (typeof iv === "string") inner[ik] = iv.slice(0, 120);
      }
      out[k] = inner;
    } else if (Array.isArray(v)) out[`${k}Count`] = v.length;
  }
  return out;
}
var NUDGE_TEXT = "You ended your turn without calling reply_to_user(kind='final'). The user only sees the Chrome side panel, not this chat. Send your answer now with reply_to_user(kind='final'), then end your turn.";
var BridgeWSServer = class {
  wss = null;
  httpServer = null;
  activeSocket = null;
  pairingToken;
  logger;
  port;
  // State management
  monotonicMessageId = 1;
  messageQueue = [];
  waitResolvers = [];
  pendingCommands = /* @__PURE__ */ new Map();
  pendingQuestions = /* @__PURE__ */ new Map();
  isStopped = false;
  // Task & Listening state
  activeTabId;
  userUiLanguage = "ar";
  taskStateTimer = null;
  taskWatchdogTimer = null;
  isWaitingForUser = false;
  pendingWaitCalls = 0;
  listeningTimer = null;
  isListeningCurrently = false;
  // Push-mode state (sidecar waker + Stop hook)
  stateDir;
  holdSeconds;
  linkedConversationId = null;
  linkPendingSince = 0;
  setupDone = false;
  hooksSeenAt = 0;
  wakerLastSeen = 0;
  wakerWaiters = [];
  wakerJobs = [];
  pendingWakeJobs = /* @__PURE__ */ new Map();
  wakeInFlight = false;
  heldStop = null;
  attachments = /* @__PURE__ */ new Map();
  lastDeliveredBatch = [];
  // Turn bookkeeping for the linked conversation
  turnSeq = 0;
  turnId = "";
  turnStartedAt = 0;
  turnFirstActivityAt = 0;
  lastActivityAt = 0;
  turnTools = 0;
  turnErrors = 0;
  turnPlan = null;
  hookSelfTestAt = 0;
  extensionVersion = "";
  presumedIdleMs = PRESUMED_IDLE_MS;
  chromeLauncher;
  lastChromeLaunchAt = 0;
  pendingLanguageNote = null;
  turnActive = false;
  turnHadUserMessage = false;
  turnFinalSent = false;
  turnNudged = false;
  turnStoppedByUser = false;
  turnSafetyTimer = null;
  lastStatusJson = "";
  statusTicker = null;
  constructor(port, pairingToken, logger, options = {}) {
    this.port = port;
    this.pairingToken = pairingToken;
    this.logger = logger;
    this.stateDir = options.stateDir ?? getDataDir();
    this.holdSeconds = options.holdSeconds ?? 1800;
    this.presumedIdleMs = options.presumedIdleMs ?? PRESUMED_IDLE_MS;
    this.chromeLauncher = options.chromeLauncher ?? (process.env.NODE_ENV === "test" || process.env.MYCHROME_NO_LAUNCH === "1" ? () => false : defaultChromeLauncher);
    this.loadSessionState();
    this.logger.addListener((level, message, data) => {
      this.broadcast({
        type: "bridge_log_event",
        level,
        message,
        data,
        timestamp: Date.now()
      });
    });
  }
  async start() {
    try {
      const cleaned = cleanOldUploads(7);
      if (cleaned > 0) {
        this.logger.info(`[Uploads] Cleaned ${cleaned} upload folder(s)/file(s) older than 7 days.`);
      }
    } catch (err) {
      this.logger.warn(`[Uploads] Failed to clean old uploads: ${err instanceof Error ? err.message : String(err)}`);
    }
    return new Promise((resolve, reject) => {
      const setupServer = () => {
        this.httpServer = http.createServer((req, res) => {
          const pathname = (req.url || "/").split("?")[0];
          if (req.method === "GET" && pathname === "/ping") {
            res.writeHead(200, {
              "Content-Type": "text/plain",
              "Access-Control-Allow-Origin": "*"
            });
            res.end("mychrome");
            return;
          }
          if (req.method === "GET" && pathname === "/connected") {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end(JSON.stringify({ connected: this.isExtensionConnected() }));
            return;
          }
          if (req.method === "GET" && pathname === "/connect") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            res.end(connectPageHtml(EXTENSION_ID));
            return;
          }
          if (pathname.startsWith("/hook/") || pathname.startsWith("/waker/") || pathname === "/status" || pathname === "/rpc") {
            this.handleControlRequest(pathname, req, res).catch((err) => {
              this.logger.error(`[HTTP] ${pathname} failed: ${err instanceof Error ? err.message : String(err)}`);
              if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
              }
              if (!res.writableEnded) res.end(JSON.stringify({ decision: "stop", error: "internal" }));
            });
            return;
          }
          if (req.method === "POST" && req.url === "/shutdown") {
            const tokenHeader = req.headers["x-bridge-token"];
            if (tokenHeader === this.pairingToken) {
              this.logger.info("[WS] Received takeover shutdown request with valid token. Exiting gracefully...");
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "shutting_down" }));
              setTimeout(async () => {
                await this.stop();
                if (process.env.NODE_ENV !== "test") {
                  process.exit(0);
                }
              }, 50);
              return;
            } else {
              this.logger.warn("[WS] Unauthorized shutdown request rejected.");
              res.writeHead(403);
              res.end("Forbidden");
              return;
            }
          }
          res.writeHead(404);
          res.end();
        });
        this.httpServer.requestTimeout = 0;
        this.httpServer.timeout = 0;
        this.wss = new import_websocket_server.default({
          server: this.httpServer,
          maxPayload: 60 * 1024 * 1024,
          verifyClient: (info, callback) => {
            const origin = info.origin || "";
            const allowed = getAllowedOrigins();
            if (origin && !allowed.has(origin)) {
              if (process.env.NODE_ENV === "test" && origin.startsWith("chrome-extension://")) {
                callback(true);
                return;
              }
              this.logger.warn(`[WS] Rejected connection from unauthorized origin: ${origin}`);
              callback(false, 403, "Forbidden Origin");
              return;
            }
            callback(true);
          }
        });
        this.wss.on("error", (err) => {
          this.logger.debug("[WS] WebSocketServer handled error:", err.message);
        });
        this.wss.on("connection", (ws, req) => {
          const clientOrigin = req.headers.origin || "";
          this.logger.info(`[WS] New connection from ${req.socket.remoteAddress} (origin: ${clientOrigin || "none"})`);
          let authenticated = false;
          const authTimeout = setTimeout(() => {
            if (!authenticated) {
              this.logger.warn(`[WS] Connection timed out waiting for auth message.`);
              ws.close(4001, "Auth timeout");
            }
          }, 5e3);
          ws.on("message", (raw) => {
            try {
              const data = JSON.parse(raw.toString("utf-8"));
              if (!authenticated) {
                if (data.type === "auth") {
                  const allowed = getAllowedOrigins();
                  const isAutoPaired = Boolean(clientOrigin && allowed.has(clientOrigin));
                  const isTokenMatch = Boolean(this.pairingToken && data.token === this.pairingToken);
                  if (isAutoPaired || isTokenMatch) {
                    authenticated = true;
                    clearTimeout(authTimeout);
                    if (this.activeSocket && this.activeSocket !== ws && this.activeSocket.readyState === import_websocket.default.OPEN) {
                      this.logger.info(`[WS] A newer extension connection replaced the previous one.`);
                      try {
                        this.activeSocket.close(4e3, "Replaced");
                      } catch {
                      }
                    }
                    this.activeSocket = ws;
                    this.isStopped = false;
                    this.extensionVersion = typeof data.extensionVersion === "string" ? data.extensionVersion : "";
                    if (isAutoPaired) {
                      this.logger.info(`[WS] Client automatically paired via trusted origin (${clientOrigin}, extension ${this.extensionVersion || "unknown"}, bridge ${BRIDGE_VERSION}).`);
                    } else {
                      this.logger.info(`[WS] Client paired and authenticated with token (extension ${this.extensionVersion || "unknown"}, bridge ${BRIDGE_VERSION}).`);
                    }
                    this.send(ws, { type: "auth_ok", listening: this.isListeningCurrently, bridgeVersion: BRIDGE_VERSION });
                    this.lastStatusJson = "";
                    this.broadcastStatus();
                  } else {
                    this.logger.warn(`[WS] Authentication failed: origin '${clientOrigin}' is not auto-paired and token invalid.`);
                    this.send(ws, { type: "auth_error", error: "Invalid pairing token" });
                    ws.close(4003, "Invalid token");
                  }
                } else {
                  this.logger.warn(`[WS] Expected auth message, received '${data.type}'.`);
                  this.send(ws, { type: "auth_error", error: "Expected auth message" });
                  ws.close(4002, "Expected auth");
                }
                return;
              }
              this.handleClientMessage(data).catch((err) => {
                this.logger.error(`[WS] Failed to handle message:`, err);
              });
            } catch (err) {
              this.logger.error(`[WS] Failed to parse message:`, err);
            }
          });
          ws.on("close", () => {
            this.logger.info(`[WS] Client disconnected.`);
            this.clearTaskWatchdog();
            if (this.activeSocket === ws) {
              this.activeSocket = null;
            }
          });
        });
      };
      const tryBind = (attempt) => {
        setupServer();
        const onError = async (err) => {
          this.httpServer?.removeListener("error", onError);
          this.httpServer?.removeListener("listening", onListening);
          try {
            this.wss?.close();
            this.httpServer?.close();
          } catch {
          }
          if (err.code === "EADDRINUSE") {
            this.logger.warn(`[WS] Port ${this.port} is already in use. Attempting takeover (attempt ${attempt + 1}/10)...`);
            try {
              await fetch(`http://127.0.0.1:${this.port}/shutdown`, {
                method: "POST",
                headers: { "x-bridge-token": this.pairingToken }
              });
            } catch {
            }
            if (attempt < 10) {
              setTimeout(() => tryBind(attempt + 1), 300);
            } else {
              this.logger.error(`[WS] Port ${this.port} in use and takeover failed after 10 attempts.`);
              if (process.env.NODE_ENV !== "test") {
                process.stderr.write(`[FATAL] Port ${this.port} is already in use and takeover failed.
`);
                process.exit(1);
              } else {
                reject(err);
              }
            }
          } else {
            this.logger.error(`[WS] Server error:`, err);
            reject(err);
          }
        };
        const onListening = () => {
          this.httpServer?.removeListener("error", onError);
          this.httpServer?.removeListener("listening", onListening);
          this.logger.info(`[WS] WebSocket server bound to 127.0.0.1:${this.port}`);
          if (!this.statusTicker) {
            this.statusTicker = setInterval(() => this.broadcastStatus(), 1e4);
            this.statusTicker.unref?.();
          }
          resolve();
        };
        this.httpServer.once("error", onError);
        this.httpServer.once("listening", onListening);
        this.httpServer.listen(this.port, "127.0.0.1");
      };
      tryBind(0);
    });
  }
  async handleClientMessage(msg) {
    if (msg.type === "ping") {
      if (this.activeSocket) this.send(this.activeSocket, { type: "pong" });
      return;
    }
    if (msg.type === "chat_message") {
      this.isStopped = false;
      const msgId = this.monotonicMessageId++;
      const savedAttachments = [];
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        const allowed = msg.attachments.slice(0, 5);
        for (let i = 0; i < allowed.length; i++) {
          const a = allowed[i];
          try {
            const saved = await saveAttachment(msgId, i + 1, a);
            savedAttachments.push(saved);
          } catch (err) {
            this.logger.error(`[Uploads] Failed to save attachment "${a.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
      const userMsg = {
        messageId: msgId,
        clientMsgId: msg.clientMsgId,
        text: msg.text,
        tab: msg.tab,
        screenshot: msg.screenshot,
        attachments: savedAttachments.length > 0 ? savedAttachments : void 0,
        ui_language: msg.ui_language,
        timestamp: Date.now()
      };
      this.logger.info(`[WS] Received user message #${userMsg.messageId}: "${userMsg.text.slice(0, 60)}" (attachments: ${savedAttachments.length})`);
      this.routeUserMessage(userMsg);
      return;
    }
    if (msg.type === "command_result" || msg.type === "browser_command_result") {
      const pending = this.pendingCommands.get(msg.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingCommands.delete(msg.correlationId);
        if ("success" in msg && !msg.success) {
          pending.reject(new Error(msg.error || "Command execution failed in extension"));
        } else if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }
    if (msg.type === "ui_language") {
      const lang = msg.lang === "en" ? "en" : "ar";
      if (lang !== this.userUiLanguage) {
        this.userUiLanguage = lang;
        this.logger.info(`[WS] Panel language changed to ${lang}.`);
        if (this.turnActive) {
          const name = lang === "en" ? "English" : "Arabic (Egyptian)";
          this.pendingLanguageNote = `The user switched the side panel to ${name}. From now on write every intent, progress update and plan step in ${name}.`;
        }
      }
      return;
    }
    if (msg.type === "client_event") {
      const name = String(msg.name || "event").slice(0, 60);
      let extra = "";
      try {
        extra = msg.data ? " " + JSON.stringify(msg.data).slice(0, 300) : "";
      } catch {
      }
      this.logger.info(`[Extension] ${name}${extra}`);
      return;
    }
    if (msg.type === "get_bridge_log") {
      const lines = this.logger.getRecentLines(500);
      if (this.activeSocket) {
        this.send(this.activeSocket, { type: "bridge_log", lines });
      }
      return;
    }
    if (msg.type === "user_action") {
      if (msg.action === "stop") {
        this.logger.warn(`[WS] User pressed STOP in side panel.`);
        this.isStopped = true;
        this.turnStoppedByUser = true;
        this.clearTaskWatchdog();
        for (const [, pending] of this.pendingCommands) {
          clearTimeout(pending.timer);
          pending.reject(new Error("stopped_by_user"));
        }
        this.pendingCommands.clear();
        for (const [, question] of this.pendingQuestions) {
          clearTimeout(question.timer);
          question.resolve({ approved: false, answer: "stopped_by_user" });
        }
        this.pendingQuestions.clear();
        this.isWaitingForUser = false;
        if (this.turnActive) {
          this.endTurn("stopped by user");
        } else {
          this.broadcastTaskState("idle", this.activeTabId, this.userUiLanguage === "ar" ? "\u062A\u0645 \u0627\u0644\u0625\u064A\u0642\u0627\u0641" : "Stopped");
        }
        return;
      }
      if (msg.correlationId && this.pendingQuestions.has(msg.correlationId)) {
        const question = this.pendingQuestions.get(msg.correlationId);
        clearTimeout(question.timer);
        this.pendingQuestions.delete(msg.correlationId);
        this.isWaitingForUser = false;
        this.resetInactivityTimer();
        if (msg.action === "approve") {
          question.resolve({ approved: true });
        } else if (msg.action === "deny") {
          question.resolve({ approved: false });
        } else if (msg.action === "answer") {
          question.resolve({ answer: String(msg.value ?? "") });
        }
      }
    }
  }
  send(ws, msg) {
    if (ws.readyState === import_websocket.default.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
  broadcast(msg) {
    if (this.activeSocket && this.activeSocket.readyState === import_websocket.default.OPEN) {
      this.activeSocket.send(JSON.stringify(msg));
    }
  }
  // ==========================================================
  // Session persistence (.session.json)
  // ==========================================================
  sessionFile() {
    return this.stateDir ? path5.join(this.stateDir, ".session.json") : null;
  }
  loadSessionState() {
    const file = this.sessionFile();
    if (!file || !fs5.existsSync(file)) return;
    try {
      const data = JSON.parse(fs5.readFileSync(file, "utf-8"));
      if (typeof data.linkedConversationId === "string" && UUID_RE.test(data.linkedConversationId)) {
        this.linkedConversationId = data.linkedConversationId;
      }
      this.setupDone = Boolean(data.setupDone);
      this.hooksSeenAt = typeof data.hooksSeenAt === "number" ? data.hooksSeenAt : 0;
      this.logger.info(
        `[Session] Loaded: linked=${this.linkedConversationId ? "yes" : "no"}, setupDone=${this.setupDone}, hooksSeen=${this.hooksSeenAt > 0}`
      );
    } catch (err) {
      this.logger.warn(`[Session] Could not read .session.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  saveSessionState() {
    const file = this.sessionFile();
    if (!file) return;
    try {
      let current = {};
      if (fs5.existsSync(file)) {
        try {
          current = JSON.parse(fs5.readFileSync(file, "utf-8"));
        } catch {
        }
      }
      const next = {
        ...current,
        linkedConversationId: this.linkedConversationId,
        hooksSeenAt: this.hooksSeenAt
      };
      fs5.writeFileSync(file, JSON.stringify(next, null, 2), "utf-8");
    } catch (err) {
      this.logger.warn(`[Session] Could not write .session.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // ==========================================================
  // Agent status (what the side panel shows in the status chip)
  // ==========================================================
  isWakerOnline() {
    return this.wakerWaiters.length > 0 || Date.now() - this.wakerLastSeen < WAKER_ONLINE_MS;
  }
  hooksConfirmed() {
    return this.hooksSeenAt > 0;
  }
  isLinkPending() {
    return this.linkPendingSince > 0 && Date.now() - this.linkPendingSince < LINK_WINDOW_MS;
  }
  getWakeMode() {
    if (this.waitResolvers.length > 0) return "legacy";
    if (this.heldStop) return "hold";
    if (this.linkedConversationId && this.isWakerOnline()) return "push";
    return "none";
  }
  getAgentStatus() {
    return {
      version: BRIDGE_VERSION,
      linked: Boolean(this.linkedConversationId),
      linkPending: this.isLinkPending(),
      waker: this.isWakerOnline(),
      hooks: this.hooksConfirmed(),
      setupDone: this.setupDone,
      busy: this.turnActive,
      mode: this.getWakeMode(),
      queued: this.messageQueue.length
    };
  }
  /** True when the agent can safely end its turn and still be woken up by the next panel message. */
  /**
   * v5.2: the agent always ends its turn. The legacy wait_for_user_message loop made the agent sit
   * in 20-50 s polls ("waiting for a reply"), which users hated. If no wake channel is up yet, the
   * message waits in the queue and the helper delivers it as soon as the waker connects.
   */
  canEndTurnSafely() {
    return true;
  }
  broadcastStatus() {
    const status = this.getAgentStatus();
    const json = JSON.stringify(status);
    if (json === this.lastStatusJson) return;
    this.lastStatusJson = json;
    this.broadcast({ type: "agent_status", status });
  }
  // ==========================================================
  // Message routing
  // ==========================================================
  routeUserMessage(userMsg) {
    if (userMsg.screenshot) {
      this.attachments.set(userMsg.messageId, userMsg.screenshot);
    }
    if (userMsg.attachments) {
      for (const a of userMsg.attachments) {
        if (a.isImage && a.dataUrl && !this.attachments.has(userMsg.messageId)) {
          this.attachments.set(userMsg.messageId, a.dataUrl);
        }
      }
    }
    if (this.attachments.size > 20) {
      const oldest = this.attachments.keys().next().value;
      if (oldest !== void 0) this.attachments.delete(oldest);
    }
    if (this.waitResolvers.length > 0) {
      const resolver = this.waitResolvers.shift();
      resolver(userMsg);
      return;
    }
    this.messageQueue.push(userMsg);
    if (this.heldStop) {
      this.releaseHeldStop();
      return;
    }
    if (this.turnActive) {
      const quietMs = Date.now() - (this.lastActivityAt || this.turnStartedAt);
      if (!this.hooksConfirmed() && quietMs > this.presumedIdleMs && this.linkedConversationId && this.isWakerOnline()) {
        this.logger.info(
          `[Route] No agent activity for ${Math.round(quietMs / 1e3)}s and no Stop hook: presuming the agent is idle and waking it.`
        );
        this.endTurn("presumed idle", this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser);
        void this.dispatchWake();
        return;
      }
      this.logger.info(`[Route] Agent is busy. Message #${userMsg.messageId} queued for the next tool result.`);
      this.broadcastStatus();
      return;
    }
    if (this.linkedConversationId && this.isWakerOnline()) {
      void this.dispatchWake();
      return;
    }
    const code = this.linkedConversationId || this.isLinkPending() ? "queued_asleep" : "queued_not_linked";
    this.logger.warn(`[Route] No wake channel. Message #${userMsg.messageId} queued (${code}).`);
    this.broadcast({ type: "system_note", code });
    this.broadcastStatus();
  }
  /** Format one or more panel messages as plain text for the agent. */
  formatMessagesForAgent(msgs, intro) {
    const lines = [];
    lines.push(
      intro ?? (msgs.length === 1 ? `New message from the user in the Chrome side panel (#${msgs[0].messageId}):` : `The user sent ${msgs.length} new messages in the Chrome side panel:`)
    );
    for (const m of msgs) {
      lines.push("");
      if (msgs.length > 1) lines.push(`Message #${m.messageId}:`);
      if (m.tab && typeof m.tab.id === "number") {
        lines.push(`Tab: id ${m.tab.id}, "${(m.tab.title || "").slice(0, 120)}", ${(m.tab.url || "").slice(0, 300)}`);
      }
      const panelLang = m.ui_language === "en" ? "English" : "Arabic (Egyptian)";
      lines.push(
        `Panel language: ${panelLang}. Write every intent, progress update and plan step in ${panelLang}. Write the final answer in the language of the user's message.`
      );
      if (m.screenshot || this.attachments.has(m.messageId)) {
        lines.push(`Screenshot attached: call read_panel_messages with message_id ${m.messageId} to see it.`);
      }
      if (m.attachments && m.attachments.length > 0) {
        lines.push(`Attachments (${m.attachments.length} file${m.attachments.length > 1 ? "s" : ""}):`);
        for (let i = 0; i < m.attachments.length; i++) {
          const a = m.attachments[i];
          const sizeKb = (a.size / 1024).toFixed(1);
          lines.push(`  ${i + 1}. "${a.name}" (${a.mime}, ${sizeKb} KB)`);
          lines.push(`     Path: ${a.path}`);
          if (a.isImage) {
            lines.push(`     (Image content returned in tool result below)`);
          } else {
            lines.push(`     (Open this document/file by path with your own file tools)`);
          }
        }
      }
      lines.push("");
      lines.push(m.text);
    }
    lines.push("");
    lines.push(
      "Work on that tab with the browser tools. For a task with 3 or more steps, call update_plan first. Send short reply_to_user(kind='progress') updates, finish with reply_to_user(kind='final'), then end your turn."
    );
    return lines.join("\n");
  }
  /** Mark messages as handed to the agent: ack them in the panel and start (or extend) a turn. */
  deliverMessages(msgs) {
    if (msgs.length === 0) return;
    for (const m of msgs) {
      if (m.clientMsgId) this.broadcast({ type: "message_ack", clientMsgId: m.clientMsgId });
    }
    const last = msgs[msgs.length - 1];
    if (last.tab?.id) this.activeTabId = last.tab.id;
    this.userUiLanguage = last.ui_language || this.userUiLanguage || "ar";
    this.lastDeliveredBatch = msgs;
    this.beginTurn(true);
  }
  beginTurn(fromUserMessage) {
    if (fromUserMessage && this.turnActive && this.turnFinalSent) {
      this.endTurn("next message");
    }
    const wasActive = this.turnActive;
    this.turnActive = true;
    if (!wasActive) {
      this.turnSeq += 1;
      this.turnId = `t${this.turnSeq}`;
      this.turnStartedAt = Date.now();
      this.turnFirstActivityAt = 0;
      this.lastActivityAt = 0;
      this.turnTools = 0;
      this.turnErrors = 0;
      this.turnPlan = null;
      this.logger.info(`[Turn ${this.turnId}] Started (${fromUserMessage ? "user message" : "agent activity"}).`);
      this.broadcast({ type: "turn_started", turnId: this.turnId, fromUser: fromUserMessage, startedAt: this.turnStartedAt });
    }
    if (fromUserMessage) {
      this.turnHadUserMessage = true;
      this.turnFinalSent = false;
      this.turnNudged = false;
      this.turnStoppedByUser = false;
      this.isStopped = false;
      const thinkLabel = this.userUiLanguage === "ar" ? "\u0628\u064A\u0641\u0643\u0631..." : "Thinking...";
      this.broadcastTaskState("thinking", this.activeTabId, thinkLabel);
      this.startTaskWatchdog();
    } else if (!wasActive) {
      this.turnHadUserMessage = false;
      this.turnFinalSent = false;
      this.turnNudged = false;
      this.turnStoppedByUser = false;
    }
    this.armTurnSafety();
    this.resetInactivityTimer();
    this.broadcastStatus();
  }
  /** Called on any agent tool call: the agent is clearly running. */
  markAgentActive() {
    if (!this.turnActive) {
      this.beginTurn(false);
    } else {
      this.armTurnSafety();
    }
    const now = Date.now();
    this.lastActivityAt = now;
    if (!this.turnFirstActivityAt) {
      this.turnFirstActivityAt = now;
      const waited = now - this.turnStartedAt;
      if (waited > 3e4) {
        this.logger.info(`[Turn ${this.turnId}] First agent activity came ${Math.round(waited / 1e3)}s after the turn started.`);
      }
    }
  }
  getTurnSummary(reason) {
    return {
      turnId: this.turnId,
      reason,
      finalSent: this.turnFinalSent,
      stoppedByUser: this.turnStoppedByUser,
      tools: this.turnTools,
      errors: this.turnErrors,
      durationMs: this.turnStartedAt ? Date.now() - this.turnStartedAt : 0,
      firstActivityMs: this.turnFirstActivityAt ? this.turnFirstActivityAt - this.turnStartedAt : null
    };
  }
  endTurn(reason, noReply = false) {
    if (!this.turnActive && !noReply) {
      this.broadcastStatus();
      return;
    }
    if (this.turnActive) {
      const summary = this.getTurnSummary(reason);
      this.logger.info(
        `[Turn ${summary.turnId}] Ended (${reason}) after ${Math.round(summary.durationMs / 1e3)}s: ${summary.tools} tool call(s), ${summary.errors} error(s), final reply ${summary.finalSent ? "sent" : "NOT sent"}` + (summary.firstActivityMs !== null ? `, first activity after ${Math.round(summary.firstActivityMs / 1e3)}s.` : ", no agent activity.")
      );
      this.broadcast({ type: "turn_ended", summary });
    }
    this.turnActive = false;
    this.clearTaskWatchdog();
    if (this.turnSafetyTimer) {
      clearTimeout(this.turnSafetyTimer);
      this.turnSafetyTimer = null;
    }
    if (noReply) {
      this.broadcast({ type: "system_note", code: "no_reply" });
    }
    this.broadcastTaskState("idle", this.activeTabId);
    this.broadcastStatus();
  }
  /** If the Stop hook never arrives (not installed or broken), do not stay "busy" forever. */
  armTurnSafety() {
    if (this.turnSafetyTimer) clearTimeout(this.turnSafetyTimer);
    const ms = this.hooksConfirmed() ? SAFETY_WITH_HOOK_MS : SAFETY_NO_HOOK_MS;
    this.turnSafetyTimer = setTimeout(() => {
      this.turnSafetyTimer = null;
      if (this.turnActive) {
        const noReply = this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser;
        this.endTurn("safety timeout: no agent activity", noReply);
        if (this.messageQueue.length > 0 && this.linkedConversationId && this.isWakerOnline()) {
          void this.dispatchWake();
        }
      }
    }, ms);
    this.turnSafetyTimer.unref?.();
  }
  /**
   * Messages that arrived while the agent was working. They are attached to the next
   * tool result so the agent sees them without ending its turn.
   */
  takeInterrupts(includeLanguageNote = true) {
    const langNote = includeLanguageNote ? this.pendingLanguageNote : null;
    if (includeLanguageNote) this.pendingLanguageNote = null;
    if (!this.turnActive || this.messageQueue.length === 0) return langNote;
    const msgs = this.messageQueue.splice(0);
    this.deliverMessages(msgs);
    this.logger.info(`[Route] Delivered ${msgs.length} queued message(s) inside a tool result.`);
    return (langNote ? langNote + "\n\n" : "") + this.formatMessagesForAgent(
      msgs,
      msgs.length === 1 ? `IMPORTANT: while you were working, the user sent a new message in the side panel (#${msgs[0].messageId}). Take it into account now:` : `IMPORTANT: while you were working, the user sent ${msgs.length} new messages in the side panel. Take them into account now:`
    );
  }
  /** Used by read_panel_messages: queued messages first, otherwise the last delivered batch. */
  readPanelMessages(messageId) {
    let messages;
    if (typeof messageId === "number") {
      const fromBatch = this.lastDeliveredBatch.find((m) => m.messageId === messageId);
      const fromQueue = this.messageQueue.find((m) => m.messageId === messageId);
      messages = fromBatch ? [fromBatch] : fromQueue ? [fromQueue] : [];
      if (fromQueue) {
        this.messageQueue = this.messageQueue.filter((m) => m !== fromQueue);
        this.deliverMessages([fromQueue]);
      }
    } else if (this.messageQueue.length > 0) {
      messages = this.messageQueue.splice(0);
      this.deliverMessages(messages);
    } else {
      messages = this.lastDeliveredBatch;
    }
    const screenshots = /* @__PURE__ */ new Map();
    const imageAttachments = [];
    for (const m of messages) {
      const shot = m.screenshot || this.attachments.get(m.messageId);
      if (shot) screenshots.set(m.messageId, shot);
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.isImage && a.dataUrl) {
            imageAttachments.push({ dataUrl: a.dataUrl, name: a.name });
          }
        }
      }
    }
    return { messages, screenshots, imageAttachments };
  }
  /** connect_side_panel: link this conversation and hand over anything already waiting. */
  isExtensionConnected() {
    return Boolean(this.activeSocket && this.activeSocket.readyState === import_websocket.default.OPEN);
  }
  /**
   * Make sure the Chrome extension is connected. If it is not, open Chrome at the /connect page:
   * this starts Chrome when it is closed and wakes the extension when it is asleep.
   */
  async ensureExtension(timeoutMs = 2e4) {
    if (this.isExtensionConnected()) return { connected: true, launched: false };
    let launched = false;
    if (Date.now() - this.lastChromeLaunchAt > 3e4) {
      const url = `http://127.0.0.1:${this.port}/connect`;
      try {
        launched = this.chromeLauncher(url);
      } catch (err) {
        this.logger.warn(`[Chrome] Could not open Chrome: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (launched) {
        this.lastChromeLaunchAt = Date.now();
        this.logger.info("[Chrome] Extension not connected: opened Chrome at the MyChrome connect page.");
      }
    }
    const waitMs = launched ? timeoutMs : process.env.NODE_ENV === "test" ? 0 : Math.min(timeoutMs, 4e3);
    const start = Date.now();
    while (Date.now() - start < waitMs) {
      if (this.isExtensionConnected()) return { connected: true, launched };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { connected: this.isExtensionConnected(), launched };
  }
  connectPanel(conversationId) {
    this.linkPendingSince = Date.now();
    if (conversationId && UUID_RE.test(conversationId)) {
      this.setLinkedConversation(conversationId, "connect_side_panel");
    }
    this.markAgentActive();
    const queued = this.messageQueue.splice(0);
    if (queued.length > 0) this.deliverMessages(queued);
    const canEndTurn = this.canEndTurnSafely();
    if (queued.length === 0 && canEndTurn && !this.hooksConfirmed()) {
      this.endTurn("connect_side_panel: nothing waiting");
    }
    this.broadcastStatus();
    return {
      linked: Boolean(this.linkedConversationId),
      linkPending: this.isLinkPending(),
      mode: this.getWakeMode(),
      canEndTurn,
      queued
    };
  }
  setLinkedConversation(conversationId, source) {
    if (this.linkedConversationId === conversationId) return;
    this.linkedConversationId = conversationId;
    this.logger.info(`[Session] Linked to Antigravity conversation ${conversationId} (via ${source}).`);
    this.saveSessionState();
    this.broadcast({ type: "system_note", code: "linked" });
    this.broadcastStatus();
  }
  // ==========================================================
  // Wake-up through the sidecar (agentapi send-message)
  // ==========================================================
  async dispatchWake() {
    if (this.wakeInFlight || !this.linkedConversationId) return;
    const msgs = this.messageQueue.splice(0);
    if (msgs.length === 0) return;
    this.wakeInFlight = true;
    const last = msgs[msgs.length - 1];
    if (last.tab?.id) this.activeTabId = last.tab.id;
    this.userUiLanguage = last.ui_language || this.userUiLanguage;
    const wakingLabel = this.userUiLanguage === "ar" ? "\u0628\u064A\u0635\u062D\u0651\u064A Antigravity..." : "Waking Antigravity...";
    this.broadcastTaskState("thinking", this.activeTabId, wakingLabel);
    const job = {
      jobId: `wake_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: "send-message",
      conversationId: this.linkedConversationId,
      prompt: this.formatMessagesForAgent(msgs),
      safePrompt: "New message from the user in the Chrome side panel. Call read_panel_messages to read it, then handle it with the browser tools and reply_to_user."
    };
    this.logger.info(`[Wake] Sending ${msgs.length} message(s) to conversation ${job.conversationId} through the waker.`);
    const result = await this.enqueueWakeJob(job, 25e3);
    this.wakeInFlight = false;
    if (result.ok) {
      this.logger.info(`[Wake] Delivered${result.usedSafePrompt ? " (safe prompt)" : ""}.`);
      this.deliverMessages(msgs);
    } else {
      this.logger.error(`[Wake] Failed: ${result.error || "unknown error"}`);
      this.messageQueue.unshift(...msgs);
      this.broadcast({
        type: "delivery_error",
        error: result.error || "unknown error",
        clientMsgIds: msgs.map((m) => m.clientMsgId).filter((x) => Boolean(x))
      });
      this.broadcastTaskState("idle", this.activeTabId);
      this.broadcastStatus();
      return;
    }
    this.broadcastStatus();
  }
  enqueueWakeJob(job, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingWakeJobs.delete(job.jobId);
        this.wakerJobs = this.wakerJobs.filter((j) => j.jobId !== job.jobId);
        resolve({ ok: false, error: "The waker did not answer in time. Is the sidecar enabled in Antigravity?" });
      }, timeoutMs);
      this.pendingWakeJobs.set(job.jobId, { resolve, timer });
      const waiter = this.wakerWaiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        this.sendJson(waiter.res, 200, job);
      } else {
        this.wakerJobs.push(job);
      }
    });
  }
  // ==========================================================
  // HTTP control endpoints (Stop hook, waker, status)
  // ==========================================================
  async handleControlRequest(pathname, req, res) {
    if (req.headers["x-bridge-token"] !== this.pairingToken) {
      this.logger.warn(`[HTTP] Rejected ${pathname}: bad or missing token.`);
      this.sendJson(res, 403, { decision: "stop", error: "forbidden" });
      return;
    }
    if (req.method === "GET" && pathname === "/status") {
      this.sendJson(res, 200, {
        ...this.getAgentStatus(),
        linkedConversationId: this.linkedConversationId,
        extensionConnected: Boolean(this.activeSocket && this.activeSocket.readyState === import_websocket.default.OPEN),
        extensionVersion: this.extensionVersion || null,
        hooksSeenAt: this.hooksSeenAt || null,
        hookSelfTestAt: this.hookSelfTestAt || null,
        turnId: this.turnActive ? this.turnId : null
      });
      return;
    }
    if (req.method === "POST" && pathname === "/rpc") {
      const body = await this.readJsonBody(req);
      const method = String(body.method || "");
      if (!RPC_METHODS.has(method)) {
        this.sendJson(res, 400, { ok: false, error: `Unknown method: ${method}` });
        return;
      }
      req.socket.setTimeout(0);
      try {
        const fn = this[method];
        const result = await fn.apply(this, Array.isArray(body.args) ? body.args : []);
        this.sendJson(res, 200, { ok: true, result: toWire(result) });
      } catch (err) {
        this.sendJson(res, 200, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (req.method === "POST" && pathname === "/hook/stop") {
      const body = await this.readJsonBody(req);
      const out = await this.handleStopHook(body, res);
      if (!res.writableEnded) this.sendJson(res, 200, out);
      return;
    }
    if (req.method === "GET" && pathname === "/waker/next") {
      this.handleWakerNext(res);
      return;
    }
    if (req.method === "POST" && pathname === "/waker/result") {
      const body = await this.readJsonBody(req);
      const pending = body.jobId ? this.pendingWakeJobs.get(body.jobId) : void 0;
      if (pending && body.jobId) {
        clearTimeout(pending.timer);
        this.pendingWakeJobs.delete(body.jobId);
        pending.resolve({ ok: Boolean(body.ok), error: body.error, usedSafePrompt: Boolean(body.usedSafePrompt) });
      }
      this.wakerLastSeen = Date.now();
      this.sendJson(res, 200, { ok: true });
      return;
    }
    this.sendJson(res, 404, { error: "not found" });
  }
  handleWakerNext(res) {
    const wasOnline = this.isWakerOnline();
    this.wakerLastSeen = Date.now();
    if (!wasOnline) {
      this.logger.info("[Waker] Sidecar connected.");
    }
    const job = this.wakerJobs.shift();
    if (job) {
      this.sendJson(res, 200, job);
      this.broadcastStatus();
      return;
    }
    const waiter = {
      res,
      timer: setTimeout(() => {
        this.wakerWaiters = this.wakerWaiters.filter((w) => w !== waiter);
        this.wakerLastSeen = Date.now();
        if (!res.writableEnded) {
          res.writeHead(204);
          res.end();
        }
      }, WAKER_POLL_MS)
    };
    this.wakerWaiters.push(waiter);
    res.on("close", () => {
      clearTimeout(waiter.timer);
      this.wakerWaiters = this.wakerWaiters.filter((w) => w !== waiter);
    });
    this.broadcastStatus();
    if (!wasOnline && this.messageQueue.length > 0 && this.linkedConversationId && !this.turnActive && !this.heldStop) {
      this.logger.info(`[Waker] Delivering ${this.messageQueue.length} message(s) that were waiting.`);
      void this.dispatchWake();
    }
  }
  /**
   * Stop hook: Antigravity calls this every time an agent turn ends (any conversation).
   * - Links the conversation right after connect_side_panel.
   * - Makes sure the final answer went to the panel (one nudge).
   * - Hands over messages that arrived during the turn.
   * - With no waker online, parks the finished turn until the next message (hold mode).
   */
  async handleStopHook(body, res) {
    if (body.selfTest === true) {
      this.hookSelfTestAt = Date.now();
      this.logger.info("[Hook] Self-test: the Stop hook script reached the bridge.");
      return { decision: "stop" };
    }
    const cid = typeof body.conversationId === "string" ? body.conversationId : "";
    const terminationReason = typeof body.terminationReason === "string" ? body.terminationReason : "";
    const firstHook = this.hooksSeenAt === 0;
    this.hooksSeenAt = Date.now();
    if (firstHook) {
      this.saveSessionState();
      this.logger.info("[Hook] First Stop hook received from Antigravity. Hooks are working.");
      this.broadcastStatus();
    }
    this.logger.debug(
      `[Hook] Stop received (conversation ${cid ? cid.slice(0, 8) : "none"}, reason ${terminationReason || "n/a"}, linked ${cid && cid === this.linkedConversationId ? "yes" : "no"}).`
    );
    if (cid && this.isLinkPending() && UUID_RE.test(cid)) {
      this.linkPendingSince = 0;
      if (this.linkedConversationId !== cid) {
        this.setLinkedConversation(cid, "stop hook");
      }
    }
    if (!cid || cid !== this.linkedConversationId) {
      return { decision: "stop" };
    }
    this.logger.info(`[Hook] Stop for linked conversation (reason: ${terminationReason || "n/a"}).`);
    const normalStop = !terminationReason || terminationReason === "model_stop";
    if (normalStop && this.turnActive && this.turnHadUserMessage && !this.turnFinalSent && !this.turnNudged && !this.turnStoppedByUser) {
      this.turnNudged = true;
      this.logger.warn("[Hook] Turn ended without reply_to_user(final). Nudging the agent once.");
      return { decision: "continue", reason: NUDGE_TEXT };
    }
    if (normalStop && this.messageQueue.length > 0) {
      const msgs = this.messageQueue.splice(0);
      this.deliverMessages(msgs);
      this.logger.info(`[Hook] Continuing the turn with ${msgs.length} queued message(s).`);
      return { decision: "continue", reason: this.formatMessagesForAgent(msgs) };
    }
    const noReply = this.turnActive && this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser;
    this.endTurn(`stop hook: ${terminationReason || "model_stop"}`, noReply);
    if (normalStop && res && this.holdSeconds > 0 && !this.isWakerOnline()) {
      return this.holdStop(res);
    }
    return { decision: "stop" };
  }
  /** Park the finished turn: no model calls happen while this request is open. */
  holdStop(res) {
    if (this.heldStop) {
      clearTimeout(this.heldStop.timer);
      this.heldStop.resolve({ decision: "stop" });
      this.heldStop = null;
    }
    this.logger.info(`[Hook] No waker online. Holding the finished turn for up to ${this.holdSeconds}s.`);
    return new Promise((resolve) => {
      const held = {
        resolve: (out) => {
          if (this.heldStop === held) this.heldStop = null;
          clearTimeout(held.timer);
          resolve(out);
          this.broadcastStatus();
        },
        timer: setTimeout(() => {
          this.logger.info("[Hook] Hold expired. The agent goes to sleep.");
          held.resolve({ decision: "stop" });
        }, this.holdSeconds * 1e3)
      };
      this.heldStop = held;
      res.on("close", () => {
        if (this.heldStop === held && !res.writableEnded) {
          this.logger.warn("[Hook] The held Stop hook was closed by Antigravity.");
          clearTimeout(held.timer);
          this.heldStop = null;
          this.broadcastStatus();
        }
      });
      this.broadcastStatus();
    });
  }
  releaseHeldStop() {
    const held = this.heldStop;
    if (!held) return;
    const msgs = this.messageQueue.splice(0);
    if (msgs.length === 0) return;
    this.deliverMessages(msgs);
    this.logger.info(`[Hook] Releasing the held turn with ${msgs.length} message(s).`);
    held.resolve({ decision: "continue", reason: this.formatMessagesForAgent(msgs) });
  }
  readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new Error("Body too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }
  sendJson(res, status, data) {
    if (res.writableEnded) return;
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  }
  // Task state and Glow handling
  broadcastTaskState(state, tabId, label) {
    const tid = tabId ?? this.activeTabId;
    this.broadcast({
      type: "task_state",
      state,
      tabId: tid,
      label
    });
  }
  /**
   * v4: the panel and the page overlay stay in "working" for the whole turn. Between tool calls the
   * agent is thinking, so we say that instead of flipping to idle (which made the glow blink and
   * produced false "task incomplete" notes). Idle only comes from the end of the turn.
   */
  resetInactivityTimer() {
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    this.taskStateTimer = null;
  }
  thinkingLabel() {
    return this.userUiLanguage === "ar" ? "\u0628\u064A\u0641\u0643\u0631..." : "Thinking...";
  }
  /** Kept for the watchdog API used by older code paths. It no longer ends turns on its own. */
  startTaskWatchdog() {
    this.clearTaskWatchdog();
  }
  resetTaskWatchdog() {
  }
  clearTaskWatchdog() {
    if (this.taskWatchdogTimer) {
      clearTimeout(this.taskWatchdogTimer);
      this.taskWatchdogTimer = null;
    }
  }
  getActionLabel(tool, params, lang = this.userUiLanguage) {
    const isAr = lang === "ar";
    switch (tool) {
      case "click":
        return isAr ? `\u0646\u0642\u0631: ${params.ref || ""}` : `Clicking: ${params.ref || ""}`;
      case "type":
        return isAr ? `\u0643\u062A\u0627\u0628\u0629: ${String(params.text || "").slice(0, 20)}` : `Typing: ${String(params.text || "").slice(0, 20)}`;
      case "press_key":
        return isAr ? `\u0636\u063A\u0637: ${params.keys}` : `Pressing: ${params.keys}`;
      case "scroll":
        return isAr ? `\u062A\u0645\u0631\u064A\u0631 ${params.direction || "\u0623\u0633\u0641\u0644"}` : `Scrolling ${params.direction || "down"}`;
      case "scroll_to":
        return isAr ? `\u062A\u0645\u0631\u064A\u0631 \u0625\u0644\u0649: ${params.ref || ""}` : `Scrolling to: ${params.ref || ""}`;
      case "navigate":
        return isAr ? `\u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649: ${String(params.url || "").slice(0, 25)}` : `Navigating: ${String(params.url || "").slice(0, 25)}`;
      case "read_page":
        return isAr ? `\u0642\u0631\u0627\u0621\u0629 \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0641\u062D\u0629` : `Reading page`;
      case "screenshot":
        return isAr ? `\u0627\u0644\u062A\u0642\u0627\u0637 \u0635\u0648\u0631\u0629` : `Screenshot`;
      case "hover":
        return isAr ? `\u062A\u0623\u0634\u064A\u0631 \u0639\u0644\u0649: ${params.ref || ""}` : `Hovering: ${params.ref || ""}`;
      case "drag":
        return isAr ? `\u0633\u062D\u0628 \u0648\u0625\u0641\u0644\u0627\u062A` : `Dragging`;
      case "upload_file":
        return isAr ? `\u0631\u0641\u0639 \u0645\u0644\u0641` : `Uploading file`;
      case "wait":
        return isAr ? `\u0627\u0646\u062A\u0638\u0627\u0631...` : `Waiting...`;
      case "handle_dialog":
        return isAr ? `\u0646\u0627\u0641\u0630\u0629 \u062D\u0648\u0627\u0631` : `Handling dialog`;
      default:
        return tool;
    }
  }
  // Listening State
  isListening() {
    return this.isListeningCurrently;
  }
  isUserStopped() {
    return this.isStopped;
  }
  // Chat Tool Handlers
  async waitForUserMessage(timeoutSeconds) {
    this.pendingWaitCalls++;
    if (this.listeningTimer) {
      clearTimeout(this.listeningTimer);
      this.listeningTimer = null;
    }
    if (!this.isListeningCurrently) {
      this.isListeningCurrently = true;
      this.broadcast({ type: "listening_state", listening: true });
    }
    const deliver = (userMsg) => {
      this.pendingWaitCalls = Math.max(0, this.pendingWaitCalls - 1);
      if (this.pendingWaitCalls === 0) {
        if (this.listeningTimer) clearTimeout(this.listeningTimer);
        this.listeningTimer = setTimeout(() => {
          if (this.pendingWaitCalls === 0) {
            this.isListeningCurrently = false;
            this.broadcast({ type: "listening_state", listening: false });
          }
        }, 1e4);
      }
      if (userMsg) {
        this.deliverMessages([userMsg]);
      }
      this.broadcastStatus();
      return userMsg;
    };
    if (this.messageQueue.length > 0) {
      return deliver(this.messageQueue.shift());
    }
    if (this.turnActive && this.turnFinalSent) {
      this.endTurn("legacy wait after final reply");
    }
    return new Promise((resolve) => {
      let timer = null;
      const resolver = (msg) => {
        if (timer) clearTimeout(timer);
        resolve(deliver(msg));
      };
      this.waitResolvers.push(resolver);
      this.broadcastStatus();
      timer = setTimeout(() => {
        const idx = this.waitResolvers.indexOf(resolver);
        if (idx !== -1) {
          this.waitResolvers.splice(idx, 1);
        }
        resolve(deliver(null));
      }, timeoutSeconds * 1e3);
    });
  }
  sendReply(text, kind) {
    this.markAgentActive();
    this.broadcast({
      type: "agent_reply",
      text,
      kind,
      replyId: `reply_${Date.now()}`,
      turnId: this.turnId
    });
    if (kind === "progress") {
      this.resetTaskWatchdog();
    } else if (kind === "final") {
      this.turnFinalSent = true;
      this.clearTaskWatchdog();
      const doneLabel = this.userUiLanguage === "ar" ? "\u062E\u0644\u0635" : "Done";
      this.broadcastTaskState("done", this.activeTabId, doneLabel);
      const t = setTimeout(() => {
        if (!this.hooksConfirmed() && this.turnActive && this.messageQueue.length === 0) {
          this.endTurn("final reply");
        } else {
          this.broadcastTaskState("idle", this.activeTabId);
        }
      }, 800);
      t.unref?.();
    }
  }
  broadcastActivity(event) {
    this.broadcast({
      type: "activity_event",
      event: { ...event, turnId: this.turnId }
    });
  }
  /** update_plan: a short checklist the panel pins above the composer while the agent works. */
  updatePlan(steps) {
    this.markAgentActive();
    this.turnPlan = steps.map((s) => ({ title: String(s.title).slice(0, 160), status: s.status }));
    const done = this.turnPlan.filter((s) => s.status === "done").length;
    this.logger.info(`[Plan ${this.turnId}] ${done}/${this.turnPlan.length} done.`);
    this.broadcast({ type: "plan_update", turnId: this.turnId, steps: this.turnPlan });
  }
  async askUser(question, options, timeoutSeconds = 120) {
    this.markAgentActive();
    const correlationId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isWaitingForUser = true;
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    const waitLabel = this.userUiLanguage === "ar" ? "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0625\u062C\u0627\u0628\u062A\u0643..." : "Waiting for input...";
    this.broadcastTaskState("waiting", this.activeTabId, waitLabel);
    this.broadcast({
      type: "ask_user",
      correlationId,
      question,
      options
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.isWaitingForUser = false;
        this.pendingQuestions.delete(correlationId);
        this.resetInactivityTimer();
        reject(new Error("User did not answer within timeout"));
      }, timeoutSeconds * 1e3);
      this.pendingQuestions.set(correlationId, {
        resolve: (res) => {
          this.isWaitingForUser = false;
          this.resetInactivityTimer();
          if (this.turnActive) this.broadcastTaskState("thinking", this.activeTabId, this.thinkingLabel());
          resolve(res.answer || "");
        },
        timer
      });
    });
  }
  async requestConfirmation(summary, timeoutSeconds = 120) {
    this.markAgentActive();
    const correlationId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isWaitingForUser = true;
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    const waitLabel = this.userUiLanguage === "ar" ? "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u062C\u0631\u0627\u0621..." : "Waiting for confirmation...";
    this.broadcastTaskState("waiting", this.activeTabId, waitLabel);
    this.broadcast({
      type: "request_confirmation",
      correlationId,
      summary
    });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.isWaitingForUser = false;
        this.pendingQuestions.delete(correlationId);
        this.resetInactivityTimer();
        resolve(false);
      }, timeoutSeconds * 1e3);
      this.pendingQuestions.set(correlationId, {
        resolve: (res) => {
          this.isWaitingForUser = false;
          this.resetInactivityTimer();
          if (this.turnActive) this.broadcastTaskState("thinking", this.activeTabId, this.thinkingLabel());
          resolve(Boolean(res.approved));
        },
        timer
      });
    });
  }
  // Browser Remote Command Dispatcher
  async executeBrowserCommand(tool, params, timeoutMs = 35e3, intent) {
    if (this.isStopped) {
      throw new Error(
        "stopped_by_user: the user pressed Stop in the side panel. Do not call more browser tools. Send one short reply_to_user(kind='final') and end your turn."
      );
    }
    if (!this.isExtensionConnected()) {
      const r = await this.ensureExtension(15e3);
      if (!r.connected) {
        throw new Error(
          "Chrome extension is not connected. MyChrome tried to open Chrome but the extension did not connect. Ask the user to open Chrome and check that the MyChrome extension is enabled in chrome://extensions."
        );
      }
    }
    this.markAgentActive();
    this.resetTaskWatchdog();
    if (tool === "wait" || tool === "navigate") {
      const requestedSec = params.timeout_seconds || params.timeout || 0;
      timeoutMs = Math.max(35e3, requestedSec * 1e3 + 5e3);
    }
    const effectiveIntent = intent || (typeof params.intent === "string" ? params.intent : void 0);
    const targetTabId = params.tabId || this.activeTabId;
    const actionLabel = effectiveIntent || this.getActionLabel(tool, params, this.userUiLanguage);
    this.broadcastTaskState("acting", targetTabId, actionLabel);
    this.resetInactivityTimer();
    const correlationId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const eventId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    this.turnTools += 1;
    this.broadcastActivity({
      id: eventId,
      correlationId,
      tool,
      args: params,
      status: "running",
      intent: effectiveIntent,
      timestamp: startedAt
    });
    const afterCommand = () => {
      this.lastActivityAt = Date.now();
      if (this.turnActive && !this.isStopped && !this.isWaitingForUser) {
        this.broadcastTaskState("thinking", targetTabId, this.thinkingLabel());
      }
    };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(correlationId);
        this.turnErrors += 1;
        this.broadcastActivity({
          id: eventId,
          correlationId,
          tool,
          args: params,
          status: "error",
          intent: effectiveIntent,
          error: "Command timed out",
          durationMs: Date.now() - startedAt,
          timestamp: Date.now()
        });
        afterCommand();
        reject(new Error(`Command ${tool} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pendingCommands.set(correlationId, {
        resolve: (result) => {
          this.broadcastActivity({
            id: eventId,
            correlationId,
            tool,
            args: params,
            status: "success",
            intent: effectiveIntent,
            resultSummary: summarizeResult(result),
            result: lightResult(result),
            durationMs: Date.now() - startedAt,
            timestamp: Date.now()
          });
          afterCommand();
          resolve(result);
        },
        reject: (err) => {
          this.turnErrors += 1;
          this.broadcastActivity({
            id: eventId,
            correlationId,
            tool,
            args: params,
            status: "error",
            intent: effectiveIntent,
            error: err.message,
            durationMs: Date.now() - startedAt,
            timestamp: Date.now()
          });
          afterCommand();
          reject(err);
        },
        timer
      });
      this.send(this.activeSocket, {
        type: "browser_command",
        correlationId,
        tool,
        params
      });
    });
  }
  async stop() {
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    if (this.statusTicker) clearInterval(this.statusTicker);
    this.statusTicker = null;
    if (this.turnSafetyTimer) clearTimeout(this.turnSafetyTimer);
    this.clearTaskWatchdog();
    if (this.heldStop) {
      clearTimeout(this.heldStop.timer);
      this.heldStop.resolve({ decision: "stop" });
      this.heldStop = null;
    }
    for (const w of this.wakerWaiters) {
      clearTimeout(w.timer);
      if (!w.res.writableEnded) {
        w.res.writeHead(204);
        w.res.end();
      }
    }
    this.wakerWaiters = [];
    for (const [, p] of this.pendingWakeJobs) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: "Server stopped" });
    }
    this.pendingWakeJobs.clear();
    for (const [, cmd] of this.pendingCommands) {
      clearTimeout(cmd.timer);
      cmd.reject(new Error("Server stopped"));
    }
    this.pendingCommands.clear();
    for (const [, q] of this.pendingQuestions) {
      clearTimeout(q.timer);
    }
    this.pendingQuestions.clear();
    if (this.activeSocket) {
      try {
        this.activeSocket.close();
      } catch {
      }
      this.activeSocket = null;
    }
    if (this.wss) {
      await new Promise((res) => this.wss.close(() => res()));
      this.wss = null;
    }
    if (this.httpServer) {
      await new Promise((res) => this.httpServer.close(() => res()));
      this.httpServer = null;
    }
    this.logger.info("[WS] Server gracefully stopped.");
  }
};

// src/waker.ts
import fs6 from "fs";
import os2 from "os";
import path6 from "path";
import { spawn as spawn2 } from "child_process";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path6.dirname(__filename);
var BRIDGE_ROOT = path6.resolve(__dirname, "..");
var PORT = parseInt(process.env.BRIDGE_PORT || "8765", 10);
var BASE = `http://127.0.0.1:${PORT}`;
var JOB_TIMEOUT_MS = 2e4;
var logSink = null;
function setWakerLogger(fn) {
  logSink = fn;
}
function log(message) {
  if (logSink) logSink(`[Waker] ${message}`);
  else process.stdout.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`);
}
function readToken() {
  if (process.env.MYCHROME_TOKEN) return process.env.MYCHROME_TOKEN;
  try {
    return fs6.readFileSync(getTokenPath(BRIDGE_ROOT), "utf-8").trim();
  } catch {
    return "";
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function resolveAgentApi() {
  const override = process.env.AGENTAPI_BIN;
  if (override && fs6.existsSync(override)) {
    return { bin: override, needsShell: /\.(cmd|bat)$/i.test(override) };
  }
  const isWin = process.platform === "win32";
  const exts = isWin ? ["", ".exe", ".cmd", ".bat"] : [""];
  const home = os2.homedir();
  const knownDirs = ["antigravity", "antigravity-cli", "antigravity-ide"].map((d) => path6.join(home, ".gemini", d, "bin"));
  const dirs = [...(process.env.PATH || process.env.Path || "").split(path6.delimiter).filter(Boolean), ...knownDirs];
  for (const preferShim of [false, true]) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const isShim = /\.(cmd|bat)$/i.test(ext);
        if (isShim !== preferShim) continue;
        if (isWin && ext === "") continue;
        const candidate = path6.join(dir, `agentapi${ext}`);
        try {
          if (fs6.statSync(candidate).isFile()) {
            return { bin: candidate, needsShell: isShim };
          }
        } catch {
        }
      }
    }
  }
  return null;
}
function runAgentApi(api, job) {
  return new Promise((resolve) => {
    const useSafe = api.needsShell;
    const prompt = useSafe ? job.safePrompt.replace(/[^A-Za-z0-9 .,_']/g, " ") : job.prompt;
    const args = ["send-message", job.conversationId, prompt];
    const child = useSafe ? spawn2(`"${api.bin}"`, args.map((a) => `"${a}"`), { shell: true, windowsHide: true }) : spawn2(api.bin, args, { shell: false, windowsHide: true });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (d) => stdout += d.toString());
    child.stderr?.on("data", (d) => stderr += d.toString());
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "agentapi timed out", usedSafePrompt: useSafe });
    }, JOB_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `agentapi could not start: ${err.message}`, usedSafePrompt: useSafe });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, usedSafePrompt: useSafe });
      } else {
        const detail = (stderr || stdout).trim().slice(0, 400);
        resolve({ ok: false, error: `agentapi exited with code ${code}${detail ? `: ${detail}` : ""}`, usedSafePrompt: useSafe });
      }
    });
  });
}
async function postResult(token, body) {
  try {
    await fetch(`${BASE}/waker/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5e3)
    });
  } catch (err) {
    log(`Could not report a job result: ${err instanceof Error ? err.message : String(err)}`);
  }
}
async function runWaker() {
  log(`MyChrome waker started. Bridge: ${BASE}`);
  let api = resolveAgentApi();
  while (!api) {
    log("agentapi was not found (PATH and ~/.gemini/antigravity*/bin). Retrying in 30s.");
    await sleep(3e4);
    api = resolveAgentApi();
  }
  log(`Using agentapi at ${api.bin}${api.needsShell ? " (shell shim, safe prompts only)" : ""}`);
  let bridgeWasDown = false;
  for (; ; ) {
    const token = readToken();
    if (!token) {
      log("bridge/.token is missing. Waiting for the bridge to create it.");
      await sleep(5e3);
      continue;
    }
    let res;
    try {
      res = await fetch(`${BASE}/waker/next`, {
        headers: { "x-bridge-token": token },
        signal: AbortSignal.timeout(35e3)
      });
    } catch {
      if (!bridgeWasDown) log("Helper is not reachable yet.");
      bridgeWasDown = true;
      await sleep(3e3);
      continue;
    }
    if (bridgeWasDown) {
      log("Bridge is reachable.");
      bridgeWasDown = false;
    }
    if (res.status === 204) continue;
    if (res.status === 403) {
      log("The bridge rejected our token. Re-reading bridge/.token in 5s.");
      await sleep(5e3);
      continue;
    }
    if (res.status !== 200) {
      log(`Unexpected status ${res.status} from the bridge.`);
      await sleep(3e3);
      continue;
    }
    let job;
    try {
      job = await res.json();
    } catch {
      continue;
    }
    if (!job || job.action !== "send-message" || !job.conversationId) continue;
    log(`Delivering ${job.jobId} to conversation ${job.conversationId}`);
    const result = await runAgentApi(api, job);
    log(result.ok ? `Delivered ${job.jobId}` : `Failed ${job.jobId}: ${result.error}`);
    await postResult(token, { jobId: job.jobId, ...result });
  }
}
var startedDirectly = Boolean(process.argv[1]) && path6.resolve(process.argv[1]) === path6.resolve(__filename);
if (startedDirectly && path6.basename(__filename).startsWith("waker.")) {
  runWaker().catch((err) => {
    log(`Fatal: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    process.exit(1);
  });
}

// src/daemon.ts
var __filename2 = fileURLToPath2(import.meta.url);
var BRIDGE_ROOT2 = path7.resolve(path7.dirname(__filename2), "..");
async function main() {
  const stateDir = process.env.MYCHROME_DATA_DIR || getDataDir();
  const logsDir = process.env.MYCHROME_LOGS_DIR || getLogsDir(BRIDGE_ROOT2);
  const logger = new Logger(logsDir);
  const startedBy = process.env.MYCHROME_STARTED_BY || "sidecar";
  logger.info(`Starting MyChrome helper v${BRIDGE_VERSION} (started by ${startedBy}, node ${process.version}, ${process.platform}).`);
  const { token } = getOrCreatePairingToken(stateDir);
  const port = parseInt(process.env.BRIDGE_PORT || "8765", 10);
  const holdSeconds = parseInt(process.env.BRIDGE_HOLD_SECONDS || "1800", 10);
  const server = new BridgeWSServer(port, token, logger, {
    stateDir,
    holdSeconds: Number.isFinite(holdSeconds) ? holdSeconds : 1800
  });
  await server.start();
  logger.info(`MyChrome helper is listening on 127.0.0.1:${port}.`);
  if (process.env.MYCHROME_NO_WAKER !== "1") {
    setWakerLogger((m) => logger.info(m));
    runWaker().catch((err) => logger.error(`[Waker] stopped: ${err instanceof Error ? err.message : String(err)}`));
  }
  const shutdown = (signal) => {
    logger.info(`MyChrome helper stopping (${signal}).`);
    server.stop().finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
main().catch((err) => {
  console.error("Fatal error starting the MyChrome helper:", err);
  process.exit(1);
});
