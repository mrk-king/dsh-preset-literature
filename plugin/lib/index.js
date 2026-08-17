import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary) {
	Binary.is = isArrayBufferLike;
	Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time) {
	Time.millisecond = 1;
	Time.second = 1e3;
	Time.minute = Time.second * 60;
	Time.hour = Time.minute * 60;
	Time.day = Time.hour * 24;
	Time.week = Time.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
	}
	Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time.minute);
	}
	Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
	}
	Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
		else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
		else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
		else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
		return ms + "ms";
	}
	Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema$1 = Symbol.for("schemastery");
const kValidationError$1 = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError$1 = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError$1];
	}
};
Object.defineProperty(ValidationError$1.prototype, kValidationError$1, { value: true });
const Schema$1 = function(options) {
	const schema = function(data, options = {}) {
		return Schema$1.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema$1(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema$1.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema$1.prototype = Object.create(Function.prototype);
Schema$1.prototype[kSchema$1] = true;
Object.defineProperty(Schema$1.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema$1.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError$1.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema$1.ValidationError = ValidationError$1;
Schema$1.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema$1.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema$1.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc$1(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner$1(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys$1(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema$1.prototype.i18n = function i18n(messages) {
	const schema = Schema$1(this);
	const desc = mergeDesc$1(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner$1(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner$1(data))) return getInner$1(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys$1(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner$1(data)) return getInner$1(data);
		return extractKeys$1(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema$1.prototype.extra = function extra(key, value) {
	const schema = Schema$1(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema$1.prototype, { [key](value = true) {
	const schema = Schema$1(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema$1.prototype.deprecated = function deprecated() {
	const schema = Schema$1(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema$1.prototype.experimental = function experimental() {
	const schema = Schema$1(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema$1.prototype.pattern = function pattern(regexp) {
	const schema = Schema$1(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema$1.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema$1.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema$1.prototype.toString = function toString(inline) {
	return formatters$1[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema$1.prototype.role = function role(role, extra) {
	const schema = Schema$1(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema$1.prototype, { [key](value) {
	const schema = Schema$1(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers$1 = {};
Schema$1.extend = function extend(type, resolve) {
	resolvers$1[type] = resolve;
};
Schema$1.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError$1(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers$1[schema.type];
	if (!callback) throw new ValidationError$1(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema$1.from = function from(source) {
	if (isNullable(source)) return Schema$1.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema$1.const(source).required();
	else if (source[kSchema$1]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema$1.string().required();
		case Number: return Schema$1.number().required();
		case Boolean: return Schema$1.boolean().required();
		case Function: return Schema$1.function().required();
		default: return Schema$1.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema$1.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema$1]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema$1({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema$1.natural = function natural() {
	return Schema$1.number().step(1).min(0);
};
Schema$1.percent = function percent() {
	return Schema$1.number().step(.01).min(0).max(1).role("slider");
};
Schema$1.date = function date() {
	return Schema$1.union([Schema$1.is(Date), Schema$1.transform(Schema$1.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError$1(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema$1.regExp = function regExp(flag = "") {
	return Schema$1.union([Schema$1.is(RegExp), Schema$1.transform(Schema$1.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError$1(e.message, options);
		}
	}, true)]);
};
Schema$1.arrayBuffer = function arrayBuffer(encoding) {
	return Schema$1.union([
		Schema$1.is(ArrayBuffer),
		Schema$1.is(SharedArrayBuffer),
		Schema$1.transform(Schema$1.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError$1(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema$1.transform(Schema$1.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError$1(e.message, options);
			}
		}, true)] : []
	]);
};
Schema$1.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema$1]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema$1.resolve(data, schema.inner, options, strict);
});
Schema$1.extend("any", (data) => {
	return [data];
});
Schema$1.extend("never", (data, _, options) => {
	throw new ValidationError$1(`expected nullable but got ${data}`, options);
});
Schema$1.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError$1(`expected ${value} but got ${data}`, options);
});
function checkWithinRange$1(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError$1(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError$1(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema$1.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError$1(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError$1(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange$1(data.length, meta, "string length", options);
	return [data];
});
function decimalShift$1(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf$1(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift$1(data, digits) - decimalShift$1(min, digits)) % decimalShift$1(step, digits) === 0;
}
Schema$1.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError$1(`expected number but got ${data}`, options);
	checkWithinRange$1(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf$1(data, meta.min ?? 0, step)) throw new ValidationError$1(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema$1.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError$1(`expected boolean but got ${data}`, options);
});
Schema$1.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError$1(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError$1(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema$1.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError$1(`expected function but got ${data}`, options);
});
Schema$1.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError$1(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError$1(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError$1(`expected ${constructor} but got ${data}`, options);
	}
});
function property$1(data, key, schema, options) {
	try {
		const [value, adapted] = Schema$1.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema$1.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError$1(`expected array but got ${data}`, options);
	checkWithinRange$1(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property$1(data, index, inner, options))];
});
Schema$1.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError$1(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema$1.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property$1(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema$1.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError$1(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property$1(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge$1(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema$1.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError$1(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property$1(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge$1(result, data);
	return [result];
});
Schema$1.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema$1.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError$1(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema$1.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema$1.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError$1(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge$1(result ??= {}, value);
		else if (result !== value) throw new ValidationError$1(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge$1(result, data);
	return [result];
});
Schema$1.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema$1.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters$1 = {};
function defineMethod$1(name, keys, format) {
	formatters$1[name] = format;
	Object.assign(Schema$1, { [name](...args) {
		const schema = new Schema$1({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema$1.string();
					break;
				case "inner":
					schema.inner = Schema$1.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema$1.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema$1.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod$1("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod$1("any", [], () => "any");
defineMethod$1("never", [], () => "never");
defineMethod$1("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod$1("string", [], () => "string");
defineMethod$1("number", [], () => "number");
defineMethod$1("boolean", [], () => "boolean");
defineMethod$1("bitset", ["bits"], () => "bitset");
defineMethod$1("function", [], () => "function");
defineMethod$1("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod$1("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod$1("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod$1("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod$1("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod$1("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod$1("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/node_modules/@deepseek-ai/dsh-timeout/lib/index.js
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;
//#endregion
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/packages/llm/llm/lib/index.js
/**
* dsh-llm's owned branded ids: tool-call correlation and provider request
* diagnostics.
*
* The `Branded<B>` primitive itself lives in `@deepseek-ai/dsh-brand` (a
* zero-dependency type-only package) so every owner of a cross-boundary id can
* brand it without depending on dsh-llm; see that package's README for the
* nominal-typing policy.
*
* @module @deepseek-ai/dsh-llm/brand
*/
/**
* Brand a message identifier.
* @param id - the opaque message identifier.
* @returns the same string, branded; no validation is performed.
*/
function MessageId(id) {
	return id;
}
/**
* Deep-freeze a value in place with an iterative traversal, guarding cycles,
* so later mutation throws without imposing a JavaScript call-stack depth cap.
* {@link AbortSignal} objects are deliberately skipped because they are the
* request's live cancellation channel and freezing them breaks abort.
* @param value - the value to freeze in place.
* @returns the same value, frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: MessageId(crypto.randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = Schema$1.object({
	initialDelayMs: Schema$1.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: Schema$1.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: Schema$1.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = Schema$1.object({
	mode: Schema$1.const("normal").required(),
	maxRetries: Schema$1.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: Schema$1.array(Schema$1.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = Schema$1.object({
	mode: Schema$1.const("always").required(),
	backoff: backoffSchema
});
Schema$1.union([normalPolicySchema, alwaysPolicySchema]);
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
//#endregion
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/packages/attachment/attachment/lib/index.js
/** Attachment identifier brand. @module @deepseek-ai/dsh-attachment/brand */
/**
* Brand a validated storage identifier.
* @param value - backend-produced opaque identifier.
* @returns the branded identifier.
*/
function AttachmentId(value) {
	return value;
}
//#endregion
//#region ../../../../../../usr/lib/deepseek-harness/resources/harness/vendor/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region src/library.ts
/**
* Paper library store: per-paper markdown notes on disk.
*
* Layout:
*   <libraryRoot>/
*     index.json          # { current, papers: [{id,title,createdAt,updatedAt}] }
*     papers/<id>/
*       meta.json         # { id, title, createdAt, updatedAt, captures: [{hash,ts,label}] }
*       notes.md          # captured snippets + Q&A, chronological
*       figures.md        # figure transcripts
*       glossary.md       # - **term** — explanation
*       figures/          # saved image files
*       paper.pdf         # attached original PDF (served to the browser)
*       paper.txt         # pdftotext extraction of paper.pdf
*/
/** 拖入对话自动归档论文的默认归属文件夹。 */
const DEFAULT_FOLDER = {
	id: "default",
	name: "默认",
	createdAt: ""
};
function slugify(title) {
	return `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "paper"}-${createHash("sha1").update(title).digest("hex").slice(0, 6)}`;
}
function paperId(title) {
	return slugify(title.trim());
}
function readIndex(root) {
	const file = join(root, "index.json");
	if (!existsSync(file)) return {
		current: null,
		papers: [],
		folders: []
	};
	try {
		const raw = JSON.parse(readFileSync(file, "utf8"));
		const papers = Array.isArray(raw?.papers) ? raw.papers.map((p) => ({
			...p,
			folders: Array.isArray(p.folders) ? p.folders : typeof p.folder === "string" && p.folder ? [p.folder] : []
		})) : [];
		const folders = Array.isArray(raw?.folders) ? [...raw.folders] : [];
		return {
			current: typeof raw?.current === "string" ? raw.current : null,
			papers,
			folders
		};
	} catch {
		return {
			current: null,
			papers: [],
			folders: []
		};
	}
}
function writeIndex(root, index) {
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "index.json"), JSON.stringify(index, null, 2), "utf8");
}
function readMeta(root, id) {
	const file = join(root, "papers", id, "meta.json");
	if (!existsSync(file)) return void 0;
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return;
	}
}
function writeMeta(root, meta) {
	mkdirSync(join(root, "papers", meta.id), { recursive: true });
	writeFileSync(join(root, "papers", meta.id, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
}
function ensureLibrary(root) {
	mkdirSync(join(root, "papers"), { recursive: true });
	const index = readIndex(root);
	const alive = index.papers.filter((p) => existsSync(join(root, "papers", p.id)));
	if (alive.length !== index.papers.length) {
		writeIndex(root, {
			...index,
			papers: alive
		});
		return {
			...index,
			papers: alive
		};
	}
	return index;
}
function listPapers(root) {
	const index = ensureLibrary(root);
	return {
		index,
		papers: index.papers
	};
}
/** Switch to an existing paper by exact id or title match; create when missing. */
function switchPaper(root, title) {
	const index = ensureLibrary(root);
	const wanted = title.trim();
	const existing = index.papers.find((p) => p.id === wanted || p.title.toLowerCase() === wanted.toLowerCase());
	let paper;
	let created = false;
	if (existing) paper = existing;
	else {
		const id = paperId(wanted);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		paper = {
			id,
			title: wanted,
			createdAt: now,
			updatedAt: now,
			folders: []
		};
		writeMeta(root, {
			...paper,
			captures: []
		});
		index.papers.unshift(paper);
		created = true;
	}
	writeIndex(root, {
		...index,
		current: paper.id
	});
	return {
		paper,
		created
	};
}
function listFolders(root) {
	return ensureLibrary(root).folders;
}
/** 创建文件夹(同名已存在则直接返回);id 由名称生成。 */
function createFolder(root, name) {
	const index = ensureLibrary(root);
	const wanted = name.trim();
	if (!wanted) throw new Error("folder name required");
	const existing = index.folders.find((f) => f.name === wanted);
	if (existing) return existing;
	const folder = {
		id: paperId(wanted),
		name: wanted,
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	index.folders.push(folder);
	writeIndex(root, index);
	return folder;
}
/** 删除文件夹(拥有它的论文从该文件夹移出,其余文件夹保留)。 */
function removeFolder(root, id) {
	const index = ensureLibrary(root);
	index.folders = index.folders.filter((f) => f.id !== id);
	for (const p of index.papers) if (Array.isArray(p.folders) && p.folders.includes(id)) p.folders = p.folders.filter((f) => f !== id);
	writeIndex(root, index);
}
/** 重命名文件夹:只改名称,id 不变(论文归属稳定)。 */
function renameFolder(root, id, newName) {
	const index = ensureLibrary(root);
	const folder = index.folders.find((f) => f.id === id);
	if (!folder) return null;
	const wanted = newName.trim();
	if (!wanted) throw new Error("folder name required");
	if (index.folders.some((f) => f.id !== id && f.name === wanted)) throw new Error(`已存在同名文件夹:《${wanted}》`);
	folder.name = wanted;
	writeIndex(root, index);
	return folder;
}
/** 设置论文的完整文件夹归属列表(空数组 = 未分类)。 */
function setPaperFolders(root, id, folderIds) {
	const index = ensureLibrary(root);
	const paper = index.papers.find((p) => p.id === id);
	if (!paper) return;
	paper.folders = [...new Set(folderIds.filter(Boolean))];
	writeIndex(root, index);
}
/** 重命名论文:只改标题与 meta,保持 id 不变(笔记/PDF/引用稳定)。 */
function renamePaper(root, id, newTitle) {
	const index = ensureLibrary(root);
	const paper = index.papers.find((p) => p.id === id);
	if (!paper) return null;
	const wanted = newTitle.trim();
	if (!wanted) throw new Error("title required");
	if (index.papers.some((p) => p.id !== id && p.title.toLowerCase() === wanted.toLowerCase())) throw new Error(`已存在同名论文:《${wanted}》`);
	paper.title = wanted;
	const meta = readMeta(root, id);
	if (meta) {
		meta.title = wanted;
		writeMeta(root, meta);
	}
	writeIndex(root, index);
	return paper;
}
/** 删除论文:移入回收站(<root>/trash/<id>-<ts>),30 天后自动清除,防误删/意外丢失。 */
function removePaper(root, id) {
	const index = ensureLibrary(root);
	const target = index.papers.find((p) => p.id === id);
	if (!target) return null;
	const trashDir = join(root, "trash");
	mkdirSync(trashDir, { recursive: true });
	const dest = join(trashDir, `${id}-${Date.now()}`);
	renameSync(paperDir(root, id), dest);
	const alive = index.papers.filter((p) => p.id !== id);
	let current = index.current;
	if (current === id) current = alive[0]?.id ?? null;
	writeIndex(root, {
		...index,
		current,
		papers: alive
	});
	return target;
}
/** 清理超过 maxAgeMs 的回收站内容,返回清理条数。 */
function purgeTrash(root, maxAgeMs = 2592e6) {
	const trashDir = join(root, "trash");
	if (!existsSync(trashDir)) return 0;
	let removed = 0;
	const now = Date.now();
	for (const entry of readdirSync(trashDir)) {
		const m = /-(\d+)$/.exec(entry);
		const ts = m ? Number(m[1]) : 0;
		if (ts > 0 && now - ts > maxAgeMs) {
			rmSync(join(trashDir, entry), {
				recursive: true,
				force: true
			});
			removed += 1;
		}
	}
	return removed;
}
/** 回收站内待清理的论文数量。 */
function trashCount(root) {
	const trashDir = join(root, "trash");
	if (!existsSync(trashDir)) return 0;
	return readdirSync(trashDir).filter((e) => /-\d+$/.test(e)).length;
}
function currentPaper(root) {
	const index = ensureLibrary(root);
	if (!index.current) return null;
	return index.papers.find((p) => p.id === index.current) ?? null;
}
function touchPaper(root, id) {
	const index = ensureLibrary(root);
	const found = index.papers.find((p) => p.id === id);
	if (!found) return;
	found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	const meta = readMeta(root, id);
	if (meta) {
		meta.updatedAt = found.updatedAt;
		writeMeta(root, meta);
	}
	writeIndex(root, {
		...index,
		current: id
	});
}
function paperDir(root, id) {
	return join(root, "papers", id);
}
/** Append a raw block to notes.md (caller pre-formats). */
function appendNote(root, id, block) {
	const dir = paperDir(root, id);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "notes.md");
	appendFileSync(file, `\n${block.trim()}\n`, "utf8");
	touchPaper(root, id);
	return file;
}
function appendFigure(root, id, block) {
	const dir = paperDir(root, id);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "figures.md");
	appendFileSync(file, `\n${block.trim()}\n`, "utf8");
	touchPaper(root, id);
	return file;
}
function appendGlossary(root, id, term, explanation) {
	const dir = paperDir(root, id);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "glossary.md");
	const line = `- **${term.trim()}** — ${explanation.trim()}`;
	if (existsSync(file) && readFileSync(file, "utf8").includes(`**${term.trim()}**`)) return file;
	appendFileSync(file, `${line}\n`, "utf8");
	touchPaper(root, id);
	return file;
}
function readTail(file, maxChars) {
	if (!existsSync(file)) return "";
	const text = readFileSync(file, "utf8");
	return text.length <= maxChars ? text : `…（前略）\n${text.slice(-maxChars)}`;
}
function readGlossary(root, id) {
	const file = join(paperDir(root, id), "glossary.md");
	return existsSync(file) ? readFileSync(file, "utf8") : "";
}
function listGlossary(root, id) {
	const raw = readGlossary(root, id);
	const out = [];
	for (const line of raw.split("\n")) {
		const m = line.match(/^\s*-\s*\*\*(.+?)\*\*\s*[—-]\s*(.+)$/);
		if (m) out.push({
			term: m[1].trim(),
			explanation: m[2].trim()
		});
	}
	return out;
}
function captureHash(text) {
	return createHash("sha1").update(text).digest("hex");
}
function rememberCapture(root, id, hash, label) {
	const meta = readMeta(root, id) ?? {
		id,
		title: id,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		captures: []
	};
	if (meta.captures.some((c) => c.hash === hash)) return false;
	meta.captures.push({
		hash,
		ts: (/* @__PURE__ */ new Date()).toISOString(),
		label
	});
	if (meta.captures.length > 1e3) meta.captures = meta.captures.slice(-1e3);
	writeMeta(root, meta);
	return true;
}
function isDuplicate(root, id, hash) {
	return readMeta(root, id)?.captures.some((c) => c.hash === hash) ?? false;
}
function readPaperNotes(root, id) {
	const dir = paperDir(root, id);
	return {
		notes: readTail(join(dir, "notes.md"), 2e4),
		figures: readTail(join(dir, "figures.md"), 12e3)
	};
}
/** Count figures saved under the paper's figures/ dir. */
function figureCount(root, id) {
	const dir = join(paperDir(root, id), "figures");
	if (!existsSync(dir)) return 0;
	let n = 0;
	try {
		for (const entry of readdirSafe(dir)) if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(entry)) n += 1;
	} catch {}
	return n;
}
function readdirSafe(dir) {
	return readdirSync(dir, { withFileTypes: true }).map((d) => d.name);
}
/** Collect snippets for the current day (from `## 📌 片段 [YYYY-MM-DD` headers). */
function todaysEntries(root, today) {
	const index = ensureLibrary(root);
	const out = [];
	for (const p of index.papers) {
		const file = join(paperDir(root, p.id), "notes.md");
		if (!existsSync(file)) continue;
		const parts = readFileSync(file, "utf8").split(/\n## /);
		for (const part of parts) if (part.startsWith(`📌 片段 [${today}`) || part.startsWith(`💬 Q&A [${today}`)) out.push({
			title: p.title,
			entry: `## ${part.slice(0, 4e3)}`
		});
	}
	return out;
}
/** Search every paper's notes for a query; returns capped matches. */
function findInLibrary(root, query, maxResults = 12) {
	const index = ensureLibrary(root);
	const q = query.toLowerCase();
	const out = [];
	for (const p of index.papers) {
		const file = join(paperDir(root, p.id), "notes.md");
		if (!existsSync(file)) continue;
		const lines = readFileSync(file, "utf8").split("\n");
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			if (line.toLowerCase().includes(q)) {
				out.push({
					paper: p.title,
					match: line.trim().slice(0, 300)
				});
				if (out.length >= maxResults) return out;
			}
		}
	}
	return out;
}
function nowStamp() {
	const d = /* @__PURE__ */ new Date();
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function runPdfTool(bin, args, timeoutMs = 6e4) {
	try {
		return execFileSync(bin, args, {
			encoding: "utf8",
			timeout: timeoutMs,
			maxBuffer: 67108864
		});
	} catch (e) {
		const stderr = e?.stderr ? String(e.stderr).slice(0, 300) : String(e?.message ?? e).slice(0, 300);
		throw new Error(`PDF tool "${bin}" failed: ${stderr}`);
	}
}
/** Extract PDF metadata via `pdfinfo` (best-effort; missing fields → defaults). */
/** 从 PDF 元信息/文件名推导默认论文标题。 */
function titleFromPdf(srcPath) {
	return (parsePdfInfo(srcPath).title?.trim() || basename(srcPath).replace(/\.pdf$/i, "")).trim() || "未命名论文";
}
function parsePdfInfo(srcPath) {
	try {
		const out = runPdfTool("pdfinfo", [srcPath]);
		const title = /^Title:\s*(.+)$/m.exec(out)?.[1]?.trim();
		const pages = /^Pages:\s*(\d+)/m.exec(out)?.[1];
		const bytes = /^File size:\s*(\d+)/m.exec(out)?.[1];
		return {
			title: title && title.length > 0 && title.toLowerCase() !== "untitled" ? title : void 0,
			pages: pages ? Number(pages) : void 0,
			bytes: bytes ? Number(bytes) : void 0
		};
	} catch {
		return {};
	}
}
/**
* Attach a PDF to a paper: copy it to papers/<id>/paper.pdf and extract the
* full text to paper.txt via pdftotext. Returns the metadata. The title
* resolution order: caller-provided title > pdfinfo Title > file name.
*/
function attachPdf(root, id, srcPath, callerTitle) {
	const dir = paperDir(root, id);
	mkdirSync(dir, { recursive: true });
	const pdfPath = join(dir, "paper.pdf");
	const textPath = join(dir, "paper.txt");
	copyFileSync(srcPath, pdfPath);
	const info = parsePdfInfo(srcPath);
	const title = (callerTitle?.trim() || info.title || basename(srcPath).replace(/\.pdf$/i, "")).trim();
	try {
		runPdfTool("pdftotext", [srcPath, textPath]);
	} catch {}
	const meta = readMeta(root, id) ?? {
		id,
		title,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		captures: []
	};
	const pdf = {
		title,
		pages: info.pages ?? 0,
		bytes: info.bytes ?? (existsSync(pdfPath) ? readFileSync(pdfPath).length : 0),
		extractedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	meta.pdf = pdf;
	if (meta.title === id || meta.title === "") meta.title = title;
	writeMeta(root, meta);
	const summary = ensureLibrary(root).papers.find((p) => p.id === id);
	if (summary && (!Array.isArray(summary.folders) || summary.folders.length === 0)) {
		const idx = ensureLibrary(root);
		const def = idx.folders.find((f) => f.id === DEFAULT_FOLDER.id) ?? idx.folders.find((f) => f.name === "默认");
		if (def) setPaperFolders(root, id, [def.id]);
	}
	touchPaper(root, id);
	return {
		pdfPath,
		textPath: existsSync(textPath) ? textPath : "",
		...pdf
	};
}
/** PDF metadata persisted in meta.json, or null. */
function pdfMetaOf(root, id) {
	return readMeta(root, id)?.pdf ?? null;
}
/** Absolute path of the attached PDF for a paper, or null. */
function pdfPathOf(root, id) {
	const p = join(paperDir(root, id), "paper.pdf");
	return existsSync(p) ? p : null;
}
/** Extracted PDF text (paper.txt), or '' when absent. */
function pdfTextOf(root, id, maxChars = 4e4) {
	const p = join(paperDir(root, id), "paper.txt");
	if (!existsSync(p)) return "";
	const text = readFileSync(p, "utf8");
	return text.length <= maxChars ? text : text.slice(0, maxChars);
}
//#endregion
//#region src/normalize.ts
/**
* Pasted-text normalizer: turns messy PDF/EPUB copy into readable prose.
*
* Heuristics (conservative — never reorders or rewrites content):
*  1. drop standalone page numbers / "Page X of Y" / arXiv ids / DOIs,
*  2. drop repeated header/footer lines (same trimmed line appearing ≥ 3×),
*  3. rejoin hyphenated line breaks ("word-\n" + lowercase start),
*  4. rejoin soft line breaks inside a sentence (lowercase continuation),
*  5. keep paragraph breaks (blank lines / sentence-ending punctuation),
*  6. never touch lines that look like math ($, \, \begin, \[ ... \]).
*/
const PAGE_NUMBER_RE = /^\s*[-–—]?\s*(?:page\s*)?\d{1,4}\s*(?:\/\s*\d{1,4})?\s*[-–—]?\s*$/i;
const PAGE_X_OF_Y_RE = /^\s*(?:page\s*)?\d{1,4}\s+of\s+\d{1,4}\s*$/i;
const ARXIV_RE = /^\s*arXiv:\s*\d{4}\.\d{4,5}(?:v\d+)?\s*$/i;
const DOI_RE = /^\s*doi:\s*10\.\d{4,9}\/\S+\s*$/i;
const SENTENCE_END_RE = /[.!?。！？;；:]$/;
const MATH_LINE_RE = /(\$|\\begin\{|\\end\{|\\[a-zA-Z]+|\$\$|\[(eq|align|equation)|\\label\{)/;
const LOWERCASE_START_RE = /^[a-z0-9(\[{<'"‘“]/;
function normalizePastedText(raw) {
	const lines = raw.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n");
	let droppedLines = 0;
	let joinedHyphens = 0;
	let joinedLines = 0;
	const freq = /* @__PURE__ */ new Map();
	for (const line of lines) {
		const t = line.trim();
		if (t.length >= 4) freq.set(t, (freq.get(t) ?? 0) + 1);
	}
	const clean = [];
	for (const line of lines) {
		const t = line.trim();
		if (t.length === 0) {
			clean.push("");
			continue;
		}
		if (PAGE_NUMBER_RE.test(t) && t.replace(/[^\d]/g, "").length <= 4) {
			droppedLines += 1;
			continue;
		}
		if (PAGE_X_OF_Y_RE.test(t)) {
			droppedLines += 1;
			continue;
		}
		if (ARXIV_RE.test(t) || DOI_RE.test(t)) {
			droppedLines += 1;
			continue;
		}
		if ((freq.get(t) ?? 0) >= 3 && t.length >= 6) {
			droppedLines += 1;
			continue;
		}
		clean.push(line);
	}
	const out = [];
	let skipNext = false;
	for (let i = 0; i < clean.length; i += 1) {
		if (skipNext) {
			skipNext = false;
			continue;
		}
		let line = clean[i].trimEnd();
		if (line.length === 0) {
			out.push("");
			continue;
		}
		const next = i + 1 < clean.length ? clean[i + 1].trim() : "";
		const prev = out.length > 0 ? out[out.length - 1].trimEnd() : "";
		const isMath = MATH_LINE_RE.test(line);
		const nextIsMath = next.length > 0 && MATH_LINE_RE.test(next);
		const prevIsMath = prev.length > 0 && MATH_LINE_RE.test(prev);
		if (!isMath && !nextIsMath && next.length > 0 && !prevIsMath) {
			if (/[A-Za-z]\-$/.test(line) && LOWERCASE_START_RE.test(next)) {
				out.push(line.slice(0, -1) + next);
				skipNext = true;
				joinedHyphens += 1;
				continue;
			}
		}
		if (!isMath && !prevIsMath && prev.length > 0 && LOWERCASE_START_RE.test(line) && !SENTENCE_END_RE.test(prev)) {
			if (/[A-Za-z]\-$/.test(prev)) {
				out[out.length - 1] = prev.slice(0, -1) + line;
				joinedHyphens += 1;
			} else {
				out[out.length - 1] = prev + " " + line;
				joinedLines += 1;
			}
			continue;
		}
		out.push(line);
	}
	let joined = out.join("\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
	joined = joined.replace(/ ,/g, ",").replace(/ \./g, ".").replace(/ ;/g, ";").replace(/ :/g, ":");
	return {
		text: joined,
		droppedLines,
		joinedHyphens,
		joinedLines
	};
}
const KNOWN_INSTALLS = [join(homedir(), ".dsh", "profiles", "web", "node_modules", "@liustack", "modlens", "dist", "main.js")];
function resolveModlensBin(cfg) {
	if (cfg && cfg.trim() !== "" && existsSync(cfg)) return cfg;
	const env = process.env.MODLENS_BIN;
	if (env && env.trim() !== "" && existsSync(env)) return env;
	for (const candidate of KNOWN_INSTALLS) if (existsSync(candidate)) return candidate;
	return null;
}
function runNode(script, args, timeoutMs, signal) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [script, ...args], {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill("SIGKILL");
			reject(/* @__PURE__ */ new Error(`modlens timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		const onAbort = () => {
			if (settled) return;
			settled = true;
			child.kill("SIGKILL");
			reject(/* @__PURE__ */ new Error("modlens aborted by caller"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (d) => {
			stdout += String(d);
		});
		child.stderr.on("data", (d) => {
			stderr += String(d);
		});
		child.on("error", (e) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(e);
		});
		child.on("close", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolve({
				stdout,
				stderr,
				code
			});
		});
	});
}
/**
* Read an image through modlens. `pathOrUrl` is a local absolute path or an
* http(s) URL. `prompt` is optional extra focus. Returns the evidence object
* (`parsed.result` of the CLI JSON), the same shape the built-in
* `modlens_read_image` tool returns.
*/
async function readImage(bin, pathOrUrl, opts = {}) {
	const args = [
		bin,
		"-i",
		pathOrUrl,
		"--timeout",
		String(opts.timeoutMs ?? 18e4)
	];
	if (opts.prompt) args.push("--prompt", opts.prompt);
	const { stdout, stderr, code } = await runNode(args[0], args.slice(1), (opts.timeoutMs ?? 18e4) + 2e4, opts.signal);
	if (code !== 0) throw new Error(`modlens failed (exit ${code}): ${(stderr || stdout).trim().slice(0, 500)}`);
	let parsed;
	try {
		parsed = JSON.parse(stdout);
	} catch {
		throw new Error(`modlens produced no JSON: ${stdout.trim().slice(0, 300)}`);
	}
	const result = parsed.result;
	if (result == null || typeof result !== "object") throw new Error("modlens returned no result object");
	return result;
}
/** Compact human-readable rendering of evidence for notes / chat messages. */
function renderEvidence(ev, maxChars = 8e3) {
	const parts = [];
	if (ev.summary) parts.push(`摘要: ${ev.summary}`);
	const ocr = ev.ocr?.full_text?.trim();
	if (ocr) parts.push(`OCR 全文:\n${ocr.slice(0, maxChars)}`);
	else parts.push("OCR 全文: (空)");
	if (ev.semantics?.scene) parts.push(`场景: ${ev.semantics.scene}`);
	const entities = ev.semantics?.entities ?? [];
	if (entities.length > 0) parts.push(`实体: ${entities.slice(0, 12).map((e) => `${e.name}(${e.type})`).join(", ")}`);
	if (ev.uncertainty && ev.uncertainty.length > 0) parts.push(`不确定: ${ev.uncertainty.slice(0, 5).join("; ")}`);
	return parts.join("\n\n");
}
//#endregion
//#region src/index.ts
const name = "@dsh-external/dsh-paper-reading";
const inject = ["tools", "agents"];
const Config = Schema.object({
	libraryRoot: Schema.string().default(join(homedir(), "Documents", "papers-library")),
	modlensBin: Schema.string().default(""),
	maxCaptureChars: Schema.number().min(1e3).max(2e5).default(3e4),
	chatPush: Schema.boolean().default(true),
	promptSection: Schema.boolean().default(true),
	allowedPresets: Schema.array(Schema.string()).default(["channel-router"]),
	visionMode: Schema.union([
		"auto",
		"modlens",
		"model"
	]).default("auto")
});
function apply(ctx, config) {
	const root = config.libraryRoot;
	mkdirSync(join(root, "papers"), { recursive: true });
	try {
		purgeTrash(root);
	} catch {}
	ctx.logger?.info?.(`[paper-reading] library=${root}`);
	let modlensBin = resolveModlensBin(config.modlensBin);
	ctx.logger?.info?.(`[paper-reading] library=${root} visionMode=${config.visionMode} modlens=${modlensBin ? "yes" : "no"}`);
	let lastActiveSession = null;
	ctx.on("session/event", (session, event) => {
		if (event?.type === "user/message" && event.data?.source?.kind === "user") lastActiveSession = session.id;
		if (event?.type === "agent-preset/selected") {
			lastActiveSession = session.id;
			const p = event.data?.agentPreset;
			if (typeof p === "string") sessionPresets.set(session.id, p);
		}
	});
	function pushToChat(text) {
		if (!config.chatPush) return false;
		if (!lastActiveSession) return false;
		const agent = ctx.agents.get(lastActiveSession);
		if (!agent) return false;
		try {
			agent.followup(createUserMessage({
				source: { kind: "user" },
				content: [{
					type: "text",
					text: text.slice(0, config.maxCaptureChars)
				}]
			}));
			return true;
		} catch {
			return false;
		}
	}
	/** 推送一条带图片附件的用户消息(模型自带识图时用)。 */
	function pushImageToChat(agent, ref, text) {
		try {
			agent.followup(createUserMessage({
				source: { kind: "user" },
				content: [{
					type: "image",
					attachment: ref
				}, {
					type: "text",
					text: text.slice(0, config.maxCaptureChars)
				}]
			}));
			return true;
		} catch {
			return false;
		}
	}
	/** 查询某 agent 当前路由模型是否声明 image 输入能力(解析失败返回 false)。 */
	async function agentModelSupportsImage(agent) {
		try {
			const llm = ctx.get("llm");
			if (!llm || !agent) return false;
			const routed = agent.session?.requestHeader?.()?.config;
			const provider = routed?.provider ?? agent.options?.provider;
			const model = routed?.model ?? agent.options?.model;
			if (!provider || !model) return false;
			const info = await llm.resolveModelInfo(provider, model);
			return Array.isArray(info?.inputModalities) && info.inputModalities.includes("image");
		} catch {
			return false;
		}
	}
	/** 按配置 + 模型能力决定识图路径:'model' | 'modlens' | 'none'。 */
	async function decideVisionMode(agent) {
		const modelVision = await agentModelSupportsImage(agent);
		if (config.visionMode === "model") return modelVision ? "model" : "none";
		if (config.visionMode === "modlens") return modlensBin ? "modlens" : "none";
		return modelVision ? "model" : modlensBin ? "modlens" : "none";
	}
	const IMAGE_MEDIA_TYPES = {
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".webp": "image/webp",
		".gif": "image/gif"
	};
	function mediaTypeOf(ext) {
		return IMAGE_MEDIA_TYPES[ext.toLowerCase()];
	}
	/** 把图片字节写入持久化附件服务,返回可被消息引用的 ref;服务缺失/格式不符返回 null。 */
	async function attachImageBytes(data, ext, name) {
		try {
			const attachments = ctx.get("attachments");
			if (!attachments) return null;
			const mediaType = mediaTypeOf(ext);
			if (!mediaType || !attachments.imageLimits?.mediaTypes?.includes(mediaType)) return null;
			return await attachments.saveImage({
				data,
				mediaType,
				name: name ?? `fig-${Date.now()}${ext}`
			});
		} catch {
			return null;
		}
	}
	/** 把本地图片复制进论文 figures/ 目录;失败返回空串。 */
	function copyImageToFigures(path, paper) {
		try {
			if (/^https?:\/\//i.test(path) || !existsSync(path)) return "";
			const ext = extOf(path);
			const dir = join(paperDir(root, paper.id), "figures");
			mkdirSync(dir, { recursive: true });
			const dest = join(dir, `fig-${Date.now()}${ext}`);
			copyFileSync(path, dest);
			return dest;
		} catch {
			return "";
		}
	}
	const sessionCurrents = /* @__PURE__ */ new Map();
	/** 解析某会话的当前论文:会话有独立指针用会话的,否则回退全局。 */
	function currentPaperFor(sid) {
		if (sid && sessionCurrents.has(sid)) {
			const pid = sessionCurrents.get(sid);
			const p = listPapers(root).papers.find((x) => x.id === pid);
			if (p) return p;
		}
		return currentPaper(root);
	}
	function requireCurrentPaperFor(exec) {
		const sid = exec?.agent?.session?.id;
		let paper = currentPaperFor(sid);
		if (!paper) {
			const now = /* @__PURE__ */ new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const title = `未命名论文 ${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
			paper = switchPaper(root, title).paper;
			if (sid) sessionCurrents.set(sid, paper.id);
		}
		return { paper };
	}
	/** 面板/路由侧:按最近活跃会话解析当前论文。 */
	function requireRoutePaper() {
		return requireCurrentPaperFor({ agent: { session: { id: lastActiveSession } } });
	}
	/** 从请求 URL 解析 sid 查询参数。 */
	function sidFrom(req) {
		try {
			const q = String(req?.url ?? "").split("?")[1] ?? "";
			return new URLSearchParams(q).get("sid");
		} catch {
			return null;
		}
	}
	/**
	* 从粘贴文本中识别其所属论文:若文本包含库中某篇(非当前)论文的完整标题,
	* 返回该论文(多个命中或标题过短返回 null 表示不自动切换)。
	*/
	function detectPaperFromText(text, sid) {
		const { papers } = listPapers(root);
		const cur = currentPaperFor(sid);
		const t = text.toLowerCase();
		let hit = null;
		for (const p of papers) {
			if (cur && p.id === cur.id) continue;
			const full = p.title.toLowerCase().trim();
			const stripped = full.replace(/\s*\([^)]*\)\s*$/, "").trim();
			if ([...new Set([full, stripped].filter((x) => x.length >= 8))].some((c) => t.includes(c))) {
				if (hit) return null;
				hit = p;
			}
		}
		return hit;
	}
	function pdfMetaOf$1(id) {
		const m = pdfMetaOf(root, id);
		return m ? {
			title: m.title,
			pages: m.pages,
			bytes: m.bytes
		} : null;
	}
	const tools = [
		{
			name: "paper_switch",
			description: "Select or create the \"current paper\" of the reading library. With no title, returns the current paper and the paper list. Call this before paper_capture/paper_read_figure when the user starts reading a new paper or switches papers.",
			parameters: {
				type: "object",
				properties: { title: {
					type: "string",
					description: "Paper title to switch to (creates it when missing)."
				} }
			},
			output: {
				schema: {
					type: "object",
					properties: {
						current: { oneOf: [{ type: "object" }, { type: "null" }] },
						papers: { type: "array" },
						created: { type: "boolean" }
					},
					required: [
						"current",
						"papers",
						"created"
					],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: formatSwitch(value)
				}]
			},
			async execute(args, exec) {
				const sid = exec?.agent?.session?.id;
				if (!args?.title || String(args.title).trim() === "") return {
					current: currentPaperFor(sid),
					papers: listPapers(root).papers,
					created: false
				};
				const { paper, created } = switchPaper(root, String(args.title).trim());
				if (sid) sessionCurrents.set(sid, paper.id);
				return {
					current: paper,
					papers: listPapers(root).papers,
					created
				};
			}
		},
		{
			name: "paper_capture",
			description: "Archive a snippet of pasted paper text into the current paper's notes. Cleans up messy PDF copy (page numbers, hyphenation, soft line breaks) unless raw=true, dedupes repeats, and returns the normalized text. Use whenever the user pastes literature text and asks you to explain, summarize or translate it.",
			parameters: {
				type: "object",
				properties: {
					text: {
						type: "string",
						description: "Raw pasted text (may contain PDF artifacts)."
					},
					label: {
						type: "string",
						description: "Optional short label for the snippet, e.g. \"Abstract\", \"Sec 3.2\", \"Eq. (7)\"."
					},
					raw: {
						type: "boolean",
						description: "Skip normalization and store verbatim."
					}
				},
				required: ["text"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						normalized: { type: "string" },
						duplicate: { type: "boolean" },
						paper: { type: "object" },
						savedPath: { type: "string" },
						droppedLines: { type: "number" },
						switchedTo: { type: "string" }
					},
					required: [
						"normalized",
						"duplicate",
						"paper",
						"savedPath",
						"droppedLines"
					],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: formatCapture(value)
				}]
			},
			async execute(args, exec) {
				const raw = String(args?.text ?? "");
				if (raw.trim() === "") throw new Error("paper_capture needs non-empty text");
				let { paper } = requireCurrentPaperFor(exec);
				const sid = exec?.agent?.session?.id;
				const detected = detectPaperFromText(raw, sid);
				let switchedTo;
				if (detected && detected.id !== paper.id) {
					paper = detected;
					if (sid) sessionCurrents.set(sid, detected.id);
					switchedTo = detected.title;
				}
				const norm = args?.raw === true ? {
					text: raw,
					droppedLines: 0,
					joinedHyphens: 0,
					joinedLines: 0
				} : normalizePastedText(raw);
				const text = norm.text.slice(0, config.maxCaptureChars);
				const hash = captureHash(text);
				const duplicate = isDuplicate(root, paper.id, hash);
				const base = {
					normalized: text,
					duplicate: false,
					paper,
					savedPath: "",
					droppedLines: norm.droppedLines
				};
				if (!duplicate) {
					const block = `## 📌 片段 [${nowStamp()}]${args?.label ? ` [${String(args.label).trim()}]` : ""}\n\n${text}`;
					base.savedPath = appendNote(root, paper.id, block);
					rememberCapture(root, paper.id, hash, args?.label);
				} else base.duplicate = true;
				return {
					...base,
					...switchedTo ? { switchedTo } : {}
				};
			}
		},
		{
			name: "paper_read_figure",
			description: "Read an image (figure, table screenshot, formula, or a page scan of the paper) and archive it into the current paper's figures log. When the current model has built-in vision the image itself is returned as an image block and the model reads it directly (no ModLens); otherwise the modlens vision bridge returns the OCR/evidence transcript. Use whenever the user gives you an image file path or URL related to the paper and asks you to explain it.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Absolute local image path or http(s) URL."
					},
					title: {
						type: "string",
						description: "Optional figure title, e.g. \"Fig. 2 (architecture)\"."
					},
					question: {
						type: "string",
						description: "Optional extra focus for the vision read."
					}
				},
				required: ["path"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						transcript: { type: "string" },
						figurePath: { type: "string" },
						paper: { type: "object" },
						mode: {
							type: "string",
							enum: ["model", "modlens"]
						},
						image: { oneOf: [{
							type: "object",
							properties: {
								attachmentId: { type: "string" },
								mediaType: { type: "string" },
								bytes: { type: "integer" },
								width: { type: "integer" },
								height: { type: "integer" }
							},
							required: [
								"attachmentId",
								"mediaType",
								"bytes",
								"width",
								"height"
							],
							additionalProperties: false
						}, { type: "null" }] }
					},
					required: [
						"transcript",
						"figurePath",
						"paper",
						"mode",
						"image"
					],
					additionalProperties: false
				},
				render: (_args, value) => value.mode === "model" && value.image ? [{
					type: "text",
					text: formatFigure(value)
				}, {
					type: "image",
					attachment: {
						attachmentId: AttachmentId(value.image.attachmentId),
						mediaType: value.image.mediaType,
						bytes: value.image.bytes,
						width: value.image.width,
						height: value.image.height
					}
				}] : [{
					type: "text",
					text: formatFigure(value)
				}]
			},
			timeoutMs: 22e4,
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				const path = String(args?.path ?? "").trim();
				if (!path) throw new Error("paper_read_figure needs a non-empty \"path\"");
				const { paper } = requireCurrentPaperFor(exec);
				const title = args?.title ? String(args.title).trim() : "未命名图";
				const mode = await decideVisionMode(exec.agent);
				if (mode === "none") throw new Error("vision unavailable: the current model does not declare image input and no modlens binary was found. Either switch to an image-capable model, install ModLens, or set visionMode=model/modlens in the plugin config.");
				const stamp = nowStamp();
				if (mode === "model") {
					const figurePath = copyImageToFigures(path, paper);
					let image = null;
					if (/^https?:\/\//i.test(path)) try {
						const res = await fetch(path, { signal: exec.signal });
						if (res.ok) {
							const ref = await attachImageBytes(new Uint8Array(await res.arrayBuffer()), extOf(new URL(path).pathname) || ".png");
							if (ref) image = {
								attachmentId: ref.attachmentId,
								mediaType: ref.mediaType,
								bytes: ref.bytes,
								width: ref.width,
								height: ref.height
							};
						}
					} catch {}
					else if (existsSync(path)) try {
						const ref = await attachImageBytes(readFileSync(path), extOf(path));
						if (ref) image = {
							attachmentId: ref.attachmentId,
							mediaType: ref.mediaType,
							bytes: ref.bytes,
							width: ref.width,
							height: ref.height
						};
					} catch {}
					if (!image) throw new Error("paper_read_figure: could not attach the image for model vision (unsupported format or attachment service unavailable)");
					const transcript = "模型识图模式:图片已作为图像块随本工具结果返回,请直接查看图片内容回答用户,不要猜测图片内容。" + (args?.question ? `\n用户关注点: ${String(args.question)}` : "");
					const block = [
						`## 🖼️ ${title} [${stamp}]`,
						figurePath ? `- 文件: ${figurePath}` : `- 源: ${path}`,
						"- 模式: 模型识图(未调用 ModLens)",
						"",
						"模型解读内容见对话回复。"
					].join("\n");
					appendFigure(root, paper.id, block);
					return {
						transcript,
						figurePath,
						paper,
						mode,
						image
					};
				}
				if (!modlensBin) throw new Error("vision engine unavailable: no modlens binary found (set config.modlensBin or $MODLENS_BIN)");
				const evidence = await readImage(modlensBin, path, {
					prompt: args?.question ? String(args.question) : void 0,
					signal: exec.signal
				});
				const transcript = renderEvidence(evidence);
				const figurePath = copyImageToFigures(path, paper);
				const block = [
					`## 🖼️ ${title} [${stamp}]`,
					figurePath ? `- 文件: ${figurePath}` : `- 源: ${path}`,
					`- 摘要: ${evidence.summary ?? "(无)"}`,
					"",
					transcript
				].join("\n");
				appendFigure(root, paper.id, block);
				return {
					transcript,
					figurePath,
					paper,
					mode,
					image: null
				};
			}
		},
		{
			name: "paper_attach_pdf",
			description: "Attach the PDF file the user dropped into the conversation to the paper with the given title: copies it into the paper's folder, extracts metadata (title/pages) and full text, and returns the extracted text preview. If a paper with that title already exists it attaches there; otherwise a new paper is created. Use it whenever the user drags a PDF into the chat or gives you a PDF file path, BEFORE explaining its content. TITLE IS REQUIRED: if the user did not supply a paper title, first ASK them for the paper name, then attach. The paper is placed in the default folder.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Absolute path of the PDF file (as received from the attachment)."
					},
					title: {
						type: "string",
						description: "Paper title (REQUIRED — ask the user if not given; overrides pdfinfo/file name)."
					}
				},
				required: ["path", "title"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						paper: { type: "object" },
						pdfPath: { type: "string" },
						title: { type: "string" },
						pages: { type: "number" },
						bytes: { type: "number" },
						textPreview: { type: "string" },
						created: { type: "boolean" }
					},
					required: [
						"paper",
						"pdfPath",
						"title",
						"pages",
						"bytes",
						"textPreview"
					],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: formatPdf(value)
				}]
			},
			timeoutMs: 9e4,
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				const src = String(args?.path ?? "").trim();
				if (!src) throw new Error("paper_attach_pdf needs a non-empty \"path\"");
				if (!/\.pdf$/i.test(src)) throw new Error("paper_attach_pdf expects a .pdf file");
				if (!existsSync(src)) throw new Error(`PDF not found: ${src}`);
				if (exec.signal.aborted) throw new Error("aborted");
				const wanted = String(args?.title ?? "").trim();
				const { paper, created } = resolveAttachTarget(root, wanted, src);
				const meta = attachPdf(root, paper.id, src, args?.title);
				const textPreview = pdfTextOf(root, paper.id, 8e3);
				return {
					paper,
					pdfPath: meta.pdfPath,
					title: meta.title,
					pages: meta.pages,
					bytes: meta.bytes,
					textPreview
				};
			}
		},
		{
			name: "paper_glossary",
			description: "List or extend the current paper's glossary. Use action=list to refresh terminology; action=add saves a term you already explained (e.g. after answering the user) so later reads reuse it.",
			parameters: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["list", "add"],
						description: "list (default) or add."
					},
					term: {
						type: "string",
						description: "Term to add (required for add)."
					},
					explanation: {
						type: "string",
						description: "One-line explanation (required for add)."
					}
				},
				required: ["action"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						entries: {
							type: "array",
							items: { type: "object" }
						},
						added: { type: "boolean" },
						paper: { type: "object" }
					},
					required: [
						"entries",
						"added",
						"paper"
					],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: formatGlossary(value)
				}]
			},
			async execute(args, exec) {
				const { paper } = requireCurrentPaperFor(exec);
				if (args?.action === "add") {
					const term = String(args.term ?? "").trim();
					const explanation = String(args.explanation ?? "").trim();
					if (!term || !explanation) throw new Error("paper_glossary add needs both \"term\" and \"explanation\"");
					appendGlossary(root, paper.id, term, explanation);
					return {
						entries: listGlossary(root, paper.id),
						added: true,
						paper
					};
				}
				return {
					entries: listGlossary(root, paper.id),
					added: false,
					paper
				};
			}
		},
		{
			name: "paper_qa",
			description: "Record a Q&A pair into the current paper's notes. Call this after you answered a substantive question about the paper, so the knowledge is archived for later reading sessions.",
			parameters: {
				type: "object",
				properties: {
					question: {
						type: "string",
						description: "The user's question (or your recap of it)."
					},
					answer: {
						type: "string",
						description: "Your answer, concise."
					},
					section: {
						type: "string",
						description: "Optional section reference, e.g. \"Sec 4.1\"."
					}
				},
				required: ["question", "answer"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						saved: { type: "boolean" },
						paper: { type: "object" }
					},
					required: ["saved", "paper"],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: value.saved ? `已记录到论文《${value.paper.title}》。` : "未记录。"
				}]
			},
			async execute(args, exec) {
				const q = String(args?.question ?? "").trim();
				const a = String(args?.answer ?? "").trim();
				if (!q || !a) throw new Error("paper_qa needs both \"question\" and \"answer\"");
				const { paper } = requireCurrentPaperFor(exec);
				const block = `## 💬 Q&A [${nowStamp()}]${args?.section ? ` [${String(args.section).trim()}]` : ""}\n\n**Q:** ${q}\n\n**A:** ${a}`;
				appendNote(root, paper.id, block);
				return {
					saved: true,
					paper
				};
			}
		},
		{
			name: "paper_summary",
			description: "Read back what is archived in the library: the current paper's notes/glossary/figures (scope=current, default), today's snippets across all papers (scope=today), or every paper's latest notes (scope=all). Use it to answer \"what have I read\", write reading reports, or refresh context at the start of a long answer.",
			parameters: {
				type: "object",
				properties: {
					scope: {
						type: "string",
						enum: [
							"current",
							"today",
							"all"
						],
						description: "Which slice to read back."
					},
					maxChars: {
						type: "number",
						description: "Cap total characters (default 12000)."
					}
				},
				required: ["scope"]
			},
			output: {
				schema: {
					type: "object",
					properties: {
						text: { type: "string" },
						paper: { oneOf: [{ type: "object" }, { type: "null" }] }
					},
					required: ["text", "paper"],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: value.text
				}]
			},
			async execute(args, exec) {
				const maxChars = Math.min(Number(args?.maxChars ?? 12e3) || 12e3, 6e4);
				const scope = args?.scope === "today" || args?.scope === "all" ? args.scope : "current";
				if (scope === "current") {
					const paper = currentPaperFor(exec?.agent?.session?.id);
					if (!paper) return {
						text: "（论文库为空——先用 paper_switch 选择或创建一篇论文。）",
						paper: null
					};
					const { notes, figures } = readPaperNotes(root, paper.id);
					const glossary = readGlossary(root, paper.id);
					const figs = figureCount(root, paper.id);
					return {
						text: [
							`# 论文: ${paper.title}`,
							`片段/问答笔记(${notes.length} 字符):`,
							notes || "（无）",
							`图表转录(${figs} 张):`,
							figures || "（无）",
							"术语表:",
							glossary || "（无）"
						].join("\n\n").slice(0, maxChars),
						paper
					};
				}
				if (scope === "today") {
					const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
					const entries = todaysEntries(root, today);
					if (entries.length === 0) return {
						text: "（今天还没有归档任何片段。）",
						paper: null
					};
					return {
						text: `# 今日阅读 (${today})\n\n${entries.map((e) => `## ${e.title}\n\n${e.entry}`).join("\n\n")}`.slice(0, maxChars),
						paper: null
					};
				}
				const { papers } = listPapers(root);
				if (papers.length === 0) return {
					text: "（论文库为空。）",
					paper: null
				};
				const parts = ["# 论文库总览"];
				for (const p of papers.slice(0, 12)) {
					const { notes } = readPaperNotes(root, p.id);
					parts.push(`## ${p.title} (更新于 ${p.updatedAt.slice(0, 10)})\n${(notes || "（无笔记）").slice(0, 3e3)}`);
				}
				return {
					text: parts.join("\n\n").slice(0, maxChars),
					paper: null
				};
			}
		},
		{
			name: "paper_find",
			description: "Search every archived note in the library for a keyword/phrase and return matching lines with the paper title. Use for literature review (\"where did I write about X?\") instead of manual grepping.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search phrase."
					},
					maxResults: {
						type: "number",
						description: "Cap matches (default 12)."
					}
				},
				required: ["query"]
			},
			output: {
				schema: {
					type: "object",
					properties: { matches: {
						type: "array",
						items: { type: "object" }
					} },
					required: ["matches"],
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: formatFind(value)
				}]
			},
			async execute(args) {
				const q = String(args?.query ?? "").trim();
				if (!q) throw new Error("paper_find needs a non-empty \"query\"");
				return { matches: findInLibrary(root, q, Math.min(Number(args?.maxResults ?? 12) || 12, 50)) };
			}
		}
	];
	for (const tool of tools) try {
		const wrapped = {
			...tool,
			execute: async (args, exec) => {
				assertPaperAllowed(exec);
				return tool.execute(args, exec);
			}
		};
		ctx.tools.register(wrapped);
	} catch (e) {
		ctx.logger?.warn?.(`[paper-reading] tool ${tool.name} registration skipped: ${String(e)}`);
	}
	const sessionPresets = /* @__PURE__ */ new Map();
	function presetOf(sid) {
		return sid ? sessionPresets.get(sid) : void 0;
	}
	function assertPaperAllowed(exec) {
		const sid = exec?.agent?.session?.id;
		const preset = presetOf(sid);
		if (preset !== void 0 && !config.allowedPresets.includes(preset)) throw new Error(`论文功能仅在「${config.allowedPresets.join(" / ")}」预设下可用。请切换到该预设,或进入该预设的历史会话。`);
	}
	if (typeof ctx.on === "function") {
		if (config.promptSection) ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
			const assembled = await next();
			const agent = context?.agent;
			const sid = agent?.session?.id;
			if (!sid) return assembled;
			lastActiveSession = sid;
			const sels = agent.session.events?.filter?.((e) => e.type === "agent-preset/selected");
			const sel = sels?.[sels.length - 1];
			if (sel?.data?.agentPreset) sessionPresets.set(sid, sel.data.agentPreset);
			const preset = presetOf(sid);
			if (preset !== void 0 && !config.allowedPresets.includes(preset)) return assembled;
			const sections = [...assembled.sections ?? []];
			sections.push({
				name: "paper-reading",
				order: 200,
				text: PAPER_SECTION_TEXT
			});
			try {
				const cur = currentPaperFor(sid);
				let folderLabel = "未分类";
				if (cur && Array.isArray(cur.folders) && cur.folders.length > 0) {
					const f = listFolders(root).find((x) => x.id === cur.folders[0]);
					if (f) folderLabel = f.name;
				}
				sections.push({
					name: "paper-current",
					order: 210,
					text: cur ? `## 当前论文\n当前论文:《${cur.title}》(文件夹:${folderLabel})。用户说"这篇论文/当前论文/它"时均指它;需要细节或归档时使用 paper_summary(scope=current)、paper_find、paper_capture、paper_qa、paper_glossary——这些工具都作用于当前论文。切换论文后本段自动更新。` : "## 当前论文\n当前未选择论文。用户给出 PDF 时,先按 paper_attach_pdf 流程询问论文名后归档。"
				});
			} catch {}
			return {
				...assembled,
				sections
			};
		});
	}
	if (typeof ctx.inject === "function") ctx.inject(["webServer"], (scope) => {
		let pdfRequestCount = 0;
		const routes = [
			{
				name: "paper-reading-gate",
				path: "/dsh-paper-reading/api/gate",
				handler: async (req, res) => {
					const q = String(req?.url ?? "").split("?")[1] ?? "";
					let sid = null;
					try {
						sid = new URLSearchParams(q).get("sid");
					} catch {}
					if (!sid) sid = lastActiveSession;
					let preset = sid ? sessionPresets.get(sid) : void 0;
					if (!preset && sid) {
						const p = presetFromDisk(sid);
						if (p) {
							preset = p;
							sessionPresets.set(sid, p);
						}
					}
					json(res, {
						ok: true,
						allowed: preset !== void 0 && config.allowedPresets.includes(preset),
						preset: preset ?? null,
						session: sid
					});
				}
			},
			{
				name: "paper-reading-status",
				path: "/dsh-paper-reading/api/status",
				handler: async (req, res) => {
					const { papers } = listPapers(root);
					const current = currentPaperFor(sidFrom(req));
					let pdf = null;
					if (current) {
						const meta = pdfMetaOf$1(current.id);
						if (meta) pdf = meta;
					}
					const sid = sidFrom(req);
					const agent = sid ? ctx.agents.get(sid) : void 0;
					const modelVision = agent ? await agentModelSupportsImage(agent) : false;
					json(res, {
						ok: true,
						current,
						papers,
						folders: listFolders(root),
						trash: trashCount(root),
						libraryRoot: root,
						vision: Boolean(modlensBin),
						visionMode: config.visionMode,
						modelVision,
						chatPush: config.chatPush && Boolean(lastActiveSession),
						pdf,
						pdfRequests: pdfRequestCount
					});
				}
			},
			{
				name: "paper-reading-switch",
				path: "/dsh-paper-reading/api/switch",
				handler: async (req, res) => {
					const body = await readBody(req);
					const title = String(body?.title ?? "").trim();
					if (!title) return json(res, {
						ok: false,
						error: "title required"
					});
					const { paper, created } = switchPaper(root, title);
					const sid = sidFrom(req);
					if (sid) sessionCurrents.set(sid, paper.id);
					json(res, {
						ok: true,
						paper,
						created,
						papers: listPapers(root).papers
					});
				}
			},
			{
				name: "paper-reading-capture",
				path: "/dsh-paper-reading/api/capture",
				handler: async (req, res) => {
					const body = await readBody(req);
					const raw = String(body?.text ?? "");
					if (raw.trim() === "") return json(res, {
						ok: false,
						error: "text required"
					});
					let { paper } = requireRoutePaper();
					const detected = detectPaperFromText(raw, lastActiveSession);
					let switchedTo = null;
					if (detected && detected.id !== paper.id) {
						paper = detected;
						if (lastActiveSession) sessionCurrents.set(lastActiveSession, detected.id);
						switchedTo = detected.title;
					}
					const norm = normalizePastedText(raw);
					const text = norm.text.slice(0, config.maxCaptureChars);
					const hash = captureHash(text);
					const duplicate = isDuplicate(root, paper.id, hash);
					if (!duplicate) {
						const label = body?.label ? ` [${String(body.label).trim()}]` : "";
						appendNote(root, paper.id, `## 📌 片段 [${nowStamp()}]${label}\n\n${text}`);
						rememberCapture(root, paper.id, hash, body?.label);
					}
					let chatPushed = false;
					if (body?.ask === true) {
						const q = body?.question ? `\n\n用户问题: ${String(body.question).trim()}` : "";
						chatPushed = pushToChat(`📄 论文《${paper.title}》片段(已归档${duplicate ? ",内容重复" : ""}):\n\n${text}${q}\n\n请解释/回答这段内容。`);
					}
					json(res, {
						ok: true,
						normalized: text,
						duplicate,
						paper,
						switchedTo,
						droppedLines: norm.droppedLines,
						chatPushed
					});
				}
			},
			{
				name: "paper-reading-read-image",
				path: "/dsh-paper-reading/api/read-image",
				handler: async (req, res) => {
					const body = await readBody(req);
					const data = String(body?.data ?? "");
					if (!data) return json(res, {
						ok: false,
						error: "data required (base64 image)"
					});
					const { paper } = requireRoutePaper();
					const sid = sidFrom(req);
					const agent = ctx.agents.get(sid ?? "");
					const mode = await decideVisionMode(agent);
					if (mode === "none") return json(res, {
						ok: false,
						error: "vision unavailable: the current model does not declare image input and no modlens binary was found. Switch to an image-capable model, install ModLens, or set visionMode=model/modlens."
					});
					const title = body?.title ? String(body.title).trim() : "面板图片";
					const question = body?.question ? String(body.question).trim() : void 0;
					if (mode === "model") try {
						const buf = Buffer.from(data.split(",")[1] ?? data, "base64");
						const ext = body?.ext ? String(body.ext) : ".png";
						const ref = await attachImageBytes(buf, ext);
						if (!ref) return json(res, {
							ok: false,
							error: "无法写入附件服务:图片格式需为 png/jpg/webp/gif 之一"
						});
						const dir = join(paperDir(root, paper.id), "figures");
						mkdirSync(dir, { recursive: true });
						const figurePath = join(dir, `fig-${Date.now()}${ext}`);
						writeFileSync(figurePath, buf);
						appendFigure(root, paper.id, [
							`## 🖼️ ${title} [${nowStamp()}]`,
							`- 文件: ${figurePath}`,
							"- 模式: 模型识图(未调用 ModLens)",
							"",
							"模型解读内容见对话回复。"
						].join("\n"));
						let chatPushed = false;
						if (body?.ask === true && agent) {
							const q = question ?? "请解读这张图。";
							chatPushed = pushImageToChat(agent, ref, `🖼️ 论文《${paper.title}》图表(已归档):\n\n${q}`);
						}
						return json(res, {
							ok: true,
							mode,
							figurePath,
							paper,
							chatPushed
						});
					} finally {}
					if (!modlensBin) return json(res, {
						ok: false,
						error: "vision engine unavailable (no modlens binary)"
					});
					let tmpFile = null;
					try {
						tmpFile = saveBase64Image(data, body?.ext);
						const evidence = await readImage(modlensBin, tmpFile, { prompt: question });
						const transcript = renderEvidence(evidence);
						const dir = join(paperDir(root, paper.id), "figures");
						mkdirSync(dir, { recursive: true });
						const figurePath = join(dir, `fig-${Date.now()}${extOf(tmpFile)}`);
						copyFileSync(tmpFile, figurePath);
						const block = [
							`## 🖼️ ${title} [${nowStamp()}]`,
							`- 文件: ${figurePath}`,
							`- 摘要: ${evidence.summary ?? "(无)"}`,
							"",
							transcript
						].join("\n");
						appendFigure(root, paper.id, block);
						let chatPushed = false;
						if (body?.ask === true) {
							const q = question ?? "请解读这张图。";
							chatPushed = pushToChat(`🖼️ 论文《${paper.title}》图表(已归档,转录如下):\n\n${transcript}\n\n${q}`);
						}
						json(res, {
							ok: true,
							mode,
							transcript,
							figurePath,
							paper,
							chatPushed
						});
					} finally {
						if (tmpFile) try {
							const { rmSync } = await import("node:fs");
							rmSync(tmpFile, { force: true });
						} catch {}
					}
				}
			},
			{
				name: "paper-reading-notes",
				path: "/dsh-paper-reading/api/notes",
				handler: async (req, res) => {
					const paper = currentPaperFor(sidFrom(req));
					if (!paper) return json(res, {
						ok: true,
						paper: null,
						notes: "",
						notesFull: "",
						figures: "",
						glossary: ""
					});
					const { notes, figures } = readPaperNotes(root, paper.id);
					let notesFull = "";
					try {
						notesFull = readFileSync(join(paperDir(root, paper.id), "notes.md"), "utf8");
					} catch {}
					json(res, {
						ok: true,
						paper,
						notes,
						notesFull,
						figures,
						glossary: readGlossary(root, paper.id),
						figureCount: figureCount(root, paper.id)
					});
				}
			},
			{
				name: "paper-reading-save-notes",
				path: "/dsh-paper-reading/api/save-notes",
				handler: async (req, res) => {
					const body = await readBody(req);
					const paper = currentPaperFor(sidFrom(req));
					if (!paper) return json(res, {
						ok: false,
						error: "no current paper"
					});
					const text = String(body?.text ?? "");
					writeFileSync(join(paperDir(root, paper.id), "notes.md"), text, "utf8");
					touchPaper(root, paper.id);
					json(res, {
						ok: true,
						paper,
						savedChars: text.length
					});
				}
			},
			{
				name: "paper-reading-delete-paper",
				path: "/dsh-paper-reading/api/delete-paper",
				handler: async (req, res) => {
					const body = await readBody(req);
					const title = String(body?.title ?? "").trim();
					if (!title) return json(res, {
						ok: false,
						error: "title required"
					});
					const { papers } = listPapers(root);
					const target = papers.find((p) => p.id === title || p.title.toLowerCase() === title.toLowerCase());
					if (!target) return json(res, {
						ok: false,
						error: "paper not found"
					});
					removePaper(root, target.id);
					const after = listPapers(root);
					json(res, {
						ok: true,
						deleted: target.title,
						papers: after.papers,
						current: after.index.current,
						folders: after.index.folders
					});
				}
			},
			{
				name: "paper-reading-rename-paper",
				path: "/dsh-paper-reading/api/rename-paper",
				handler: async (req, res) => {
					const body = await readBody(req);
					const title = String(body?.title ?? "").trim();
					const newTitle = String(body?.newTitle ?? "").trim();
					if (!title) return json(res, {
						ok: false,
						error: "title required"
					});
					if (!newTitle) return json(res, {
						ok: false,
						error: "newTitle required"
					});
					const { papers } = listPapers(root);
					const target = papers.find((p) => p.id === title || p.title.toLowerCase() === title.toLowerCase());
					if (!target) return json(res, {
						ok: false,
						error: "paper not found"
					});
					try {
						renamePaper(root, target.id, newTitle);
					} catch (e) {
						return json(res, {
							ok: false,
							error: e instanceof Error ? e.message : String(e)
						});
					}
					const after = listPapers(root);
					json(res, {
						ok: true,
						paper: after.papers.find((p) => p.id === target.id),
						papers: after.papers
					});
				}
			},
			{
				name: "paper-reading-folder-create",
				path: "/dsh-paper-reading/api/folder-create",
				handler: async (req, res) => {
					const body = await readBody(req);
					const name = String(body?.name ?? "").trim();
					if (!name) return json(res, {
						ok: false,
						error: "folder name required"
					});
					const folder = createFolder(root, name);
					const after = listPapers(root);
					json(res, {
						ok: true,
						folder,
						folders: after.index.folders,
						papers: after.papers
					});
				}
			},
			{
				name: "paper-reading-folder-assign",
				path: "/dsh-paper-reading/api/folder-assign",
				handler: async (req, res) => {
					const body = await readBody(req);
					const title = String(body?.title ?? "").trim();
					if (!title) return json(res, {
						ok: false,
						error: "title required"
					});
					const { papers } = listPapers(root);
					const target = papers.find((p) => p.id === title || p.title.toLowerCase() === title.toLowerCase());
					if (!target) return json(res, {
						ok: false,
						error: "paper not found"
					});
					if (Array.isArray(body?.folders)) {
						const ids = body.folders.map((f) => String(f)).filter((f) => f && f !== "none");
						for (const fid of ids) if (!listFolders(root).some((f) => f.id === fid)) return json(res, {
							ok: false,
							error: `unknown folder: ${fid}`
						});
						setPaperFolders(root, target.id, ids);
					} else if (body?.folder !== void 0) {
						const fid = body.folder ? String(body.folder) : null;
						if (fid && fid !== "none" && !listFolders(root).some((f) => f.id === fid)) return json(res, {
							ok: false,
							error: "unknown folder"
						});
						setPaperFolders(root, target.id, fid && fid !== "none" ? [fid] : []);
					} else return json(res, {
						ok: false,
						error: "folders or folder required"
					});
					json(res, {
						ok: true,
						papers: listPapers(root).papers
					});
				}
			},
			{
				name: "paper-reading-folder-rename",
				path: "/dsh-paper-reading/api/folder-rename",
				handler: async (req, res) => {
					const body = await readBody(req);
					const id = String(body?.id ?? "").trim();
					const newName = String(body?.newName ?? "").trim();
					if (!id) return json(res, {
						ok: false,
						error: "folder id required"
					});
					if (!newName) return json(res, {
						ok: false,
						error: "newName required"
					});
					try {
						renameFolder(root, id, newName);
					} catch (e) {
						return json(res, {
							ok: false,
							error: e instanceof Error ? e.message : String(e)
						});
					}
					const after = listPapers(root);
					json(res, {
						ok: true,
						folders: after.index.folders,
						papers: after.papers
					});
				}
			},
			{
				name: "paper-reading-folder-delete",
				path: "/dsh-paper-reading/api/folder-delete",
				handler: async (req, res) => {
					const body = await readBody(req);
					const id = String(body?.id ?? "").trim();
					if (!id) return json(res, {
						ok: false,
						error: "folder id required"
					});
					removeFolder(root, id);
					const after = listPapers(root);
					json(res, {
						ok: true,
						folders: after.index.folders,
						papers: after.papers
					});
				}
			},
			{
				name: "paper-reading-glossary",
				path: "/dsh-paper-reading/api/glossary",
				handler: async (req, res) => {
					const body = await readBody(req);
					const { paper } = requireRoutePaper();
					if (body?.action === "add") {
						const term = String(body?.term ?? "").trim();
						const explanation = String(body?.explanation ?? "").trim();
						if (!term || !explanation) return json(res, {
							ok: false,
							error: "term and explanation required"
						});
						appendGlossary(root, paper.id, term, explanation);
					}
					json(res, {
						ok: true,
						entries: listGlossary(root, paper.id),
						paper
					});
				}
			},
			{
				name: "paper-reading-ask",
				path: "/dsh-paper-reading/api/ask",
				handler: async (req, res) => {
					const body = await readBody(req);
					const text = String(body?.text ?? "").trim();
					if (!text) return json(res, {
						ok: false,
						error: "text required"
					});
					json(res, {
						ok: true,
						chatPushed: pushToChat(text)
					});
				}
			},
			{
				name: "paper-reading-attach-pdf",
				path: "/dsh-paper-reading/api/attach-pdf",
				handler: async (req, res) => {
					const body = await readBody(req);
					const data = String(body?.data ?? "");
					if (!data) return json(res, {
						ok: false,
						error: "data required (base64 pdf)"
					});
					let tmpFile = null;
					try {
						tmpFile = saveBase64File(data, ".pdf");
						if (!isPdfFile(tmpFile)) return json(res, {
							ok: false,
							error: "payload is not a PDF (magic bytes %PDF)"
						});
						const { paper, created } = resolveAttachTarget(root, String(body?.title ?? "").trim(), tmpFile);
						const meta = attachPdf(root, paper.id, tmpFile, body?.title);
						json(res, {
							ok: true,
							paper,
							created,
							pdfPath: meta.pdfPath,
							title: meta.title,
							pages: meta.pages,
							bytes: meta.bytes,
							textPreview: pdfTextOf(root, paper.id, 4e3)
						});
					} finally {
						if (tmpFile) try {
							const { rmSync } = await import("node:fs");
							rmSync(tmpFile, { force: true });
						} catch {}
					}
				}
			},
			{
				name: "paper-reading-paper-pdf",
				kind: "prefix",
				path: "/dsh-paper-reading/api/paper-pdf",
				handler: async (req, res) => {
					pdfRequestCount += 1;
					const id = pathIdOf(req);
					if (!id) return json(res, {
						ok: false,
						error: "paper id required"
					});
					const pdf = pdfPathOf(root, id);
					if (!pdf) return json(res, {
						ok: false,
						error: "no PDF attached to this paper"
					});
					const buf = readFileSync(pdf);
					res.statusCode = 200;
					res.setHeader("content-type", "application/pdf");
					res.setHeader("content-disposition", "inline; filename=\"paper.pdf\"");
					res.setHeader("cache-control", "no-cache");
					res.end(buf);
				}
			},
			{
				name: "paper-reading-paper-text",
				kind: "prefix",
				path: "/dsh-paper-reading/api/paper-text",
				handler: async (req, res) => {
					const id = pathIdOf(req);
					if (!id) return json(res, {
						ok: false,
						error: "paper id required"
					});
					json(res, {
						ok: true,
						text: pdfTextOf(root, id, 6e4)
					});
				}
			}
		];
		for (const r of routes) scope.webServer.register({
			name: r.name,
			kind: r.kind ?? "exact",
			path: r.path,
			handler: async (req, res) => {
				try {
					await r.handler(req, res);
				} catch (e) {
					json(res, {
						ok: false,
						error: String(e instanceof Error ? e.message : e)
					});
				}
			}
		});
		for (const [name, prefix, rootDir] of [[
			"paper-reading-pdfjs-static",
			"/dsh-paper-reading/pdfjs",
			PDFJS_ROOT
		], [
			"paper-reading-pdfjs-legacy-static",
			"/dsh-paper-reading/pdfjs-legacy",
			PDFJS_LEGACY_ROOT
		]]) scope.webServer.register({
			name,
			kind: "prefix",
			path: prefix,
			handler: staticFileHandler(rootDir, prefix)
		});
		ctx.logger?.info?.("[paper-reading] web API + pdf.js viewer mounted");
	});
	ctx.effect(() => () => {
		ctx.logger?.info?.("[paper-reading] disposed");
	}, "paper-reading: dispose");
}
/**
* 决定拖入 PDF 的归属论文(避免误挂到无关的"当前论文"):
*  1) 指定了标题且已存在同名论文 → 挂到它;
*  2) 当前论文存在且还没有 PDF → 填充它;
*  3) 否则 → 用标题(或 PDF 元信息/文件名)新建一篇。
*/
function resolveAttachTarget(root, wanted, srcPath) {
	const { index, papers } = listPapers(root);
	if (wanted) {
		const hit = papers.find((p) => p.title.toLowerCase() === wanted.toLowerCase() || p.id === wanted);
		if (hit) return {
			paper: hit,
			created: false
		};
	}
	if (index.current) {
		const cur = papers.find((p) => p.id === index.current);
		if (cur && !pdfPathOf(root, cur.id)) return {
			paper: cur,
			created: false
		};
	}
	return switchPaper(root, wanted || titleFromPdf(srcPath));
}
/** 自托管 pdf.js viewer 静态资源根目录(<plugin>/assets/pdfjs,来自官方 GitHub Release dist)。 */
const PDFJS_ROOT = fileURLToPath(new URL("../assets/pdfjs", import.meta.url));
const PDFJS_LEGACY_ROOT = fileURLToPath(new URL("../assets/pdfjs-legacy", import.meta.url));
/** 从磁盘会话日志解析会话的预设(取最后一次 agent-preset/selected)。 */
function presetFromDisk(sid) {
	try {
		const store = join(homedir(), ".dsh", "sessions");
		if (!existsSync(store)) return null;
		for (const slug of readdirSync(store)) {
			const file = join(store, slug, sid, "session.jsonl.zstd");
			if (!existsSync(file)) continue;
			const out = execFileSync("zstd", ["-dc", file], {
				encoding: "utf8",
				maxBuffer: 67108864,
				timeout: 15e3
			});
			let last = null;
			for (const line of out.split("\n")) {
				if (!line.includes("agent-preset/selected")) continue;
				try {
					last = JSON.parse(line);
				} catch {}
			}
			const p = last?.data?.agentPreset;
			return typeof p === "string" ? p : null;
		}
		return null;
	} catch {
		return null;
	}
}
/** 论文阅读模式提示词段(仅注入允许的预设会话)。 */
const PAPER_SECTION_TEXT = [
	"## 论文阅读模式(paper-reading plugin)",
	"用户在阅读文献时会复制文字或图片给你。请遵守:",
	"1. 用户粘贴文字后,先用 paper_capture 清洗并归档到当前论文(它会处理 PDF 断行/连字符/页码,且会自动识别内容所属论文:若粘贴文本含库中另一篇论文的完整标题,会自动切换当前论文并归档)。回答时基于该论文记忆;若内容明显不属于当前论文又无法自动识别(标题未出现),先询问用户是哪篇论文再归档。",
	"1b. 用户拖入 PDF 文件或给出 PDF 路径时,先用 paper_attach_pdf 归档(提取元信息+全文),再基于提取文本解读。注意:paper_attach_pdf 的 title 必填——用户未给论文名时,必须先询问论文题目再归档;归档自动进入「默认」文件夹;需要看图表时配合 paper_read_figure。",
	"2. 用户给出图片路径/URL 或粘贴图片时,用 paper_read_figure 读取并归档(OCR 全文 + 摘要),基于转录内容解读图表/公式/页面,不要臆测图片内容。",
	"3. 解释论文内容时:忠于原文、指出所在章节/公式编号、公式用 LaTeX、不确定处明确标注、按需维护术语表(paper_glossary add)。",
	"4. 深度阅读时用 paper_qa 把有价值的问答归档;回答前可用 paper_summary 回顾已归档内容,避免重复解释。",
	"5. 需要回顾读过什么时用 paper_summary(scope=today/current/all);跨论文检索用 paper_find。",
	"6. 回答语言跟随用户。"
].join("\n");
/** 静态文件路由工厂:把 prefix 下的请求映射到 rootDir,带 MIME 表与防穿越。 */
function staticFileHandler(rootDir, prefix) {
	return async (req, res) => {
		const url = String(req?.url ?? "");
		const rel = decodeURIComponent(url.split("?")[0]).slice(prefix.length);
		const file = resolve(rootDir, "." + rel);
		if (!file.startsWith(rootDir + sep) || !existsSync(file)) return json(res, {
			ok: false,
			error: "not found"
		});
		let body;
		try {
			body = readFileSync(file);
		} catch {
			return json(res, {
				ok: false,
				error: "not found"
			});
		}
		res.statusCode = 200;
		res.setHeader("content-type", PDFJS_MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
		res.setHeader("cache-control", "no-cache");
		res.end(body);
	};
}
const PDFJS_MIME = {
	".html": "text/html; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".gif": "image/gif",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".cur": "image/x-icon",
	".bcmap": "application/octet-stream",
	".pfb": "application/octet-stream",
	".ttf": "font/ttf",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".wasm": "application/wasm",
	".pdf": "application/pdf",
	".txt": "text/plain; charset=utf-8",
	".ftl": "text/plain; charset=utf-8",
	".properties": "text/plain; charset=utf-8",
	".map": "application/json"
};
function json(res, obj) {
	res.statusCode = 200;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify(obj));
}
function readBody(req) {
	return new Promise((resolve) => {
		let data = "";
		req.on("data", (c) => {
			data += c.toString();
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(data || "{}"));
			} catch {
				resolve({});
			}
		});
		req.on("error", () => resolve({}));
	});
}
function extOf(path) {
	const m = /\.([a-z0-9]+)$/i.exec(path);
	return m ? `.${m[1].toLowerCase()}` : ".png";
}
const MAGIC = [
	{
		ext: ".png",
		test: (b) => b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10
	},
	{
		ext: ".jpg",
		test: (b) => b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
	},
	{
		ext: ".gif",
		test: (b) => b.length >= 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a")
	},
	{
		ext: ".webp",
		test: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
	}
];
function saveBase64Image(data, hintExt) {
	const m = /^data:image\/[a-z+.-]+;base64,(.*)$/i.exec(data);
	const base64 = m ? m[1] : data;
	const buf = Buffer.from(base64, "base64");
	if (buf.length === 0) throw new Error("empty image payload");
	const ext = MAGIC.find((x) => x.test(buf))?.ext ?? (hintExt && /^\.[a-z0-9]+$/i.test(hintExt) ? String(hintExt).toLowerCase() : ".png");
	const file = join(tmpdir(), `paper-reading-${randomUUID()}${ext}`);
	writeFileSync(file, buf);
	return file;
}
/** Save a generic base64 payload (e.g. PDF) to a temp file with the given extension. */
function saveBase64File(data, ext) {
	const m = /^data:[a-z0-9+./-]+;base64,(.*)$/i.exec(data);
	const base64 = m ? m[1] : data;
	const buf = Buffer.from(base64, "base64");
	if (buf.length === 0) throw new Error("empty payload");
	const file = join(tmpdir(), `paper-reading-${randomUUID()}${ext}`);
	writeFileSync(file, buf);
	return file;
}
/** PDF magic-bytes check: %PDF- */
function isPdfFile(path) {
	try {
		return readFileSync(path).subarray(0, 5).toString("latin1") === "%PDF-";
	} catch {
		return false;
	}
}
/** Extract the paper id from a prefix route URL (/dsh-paper-reading/api/paper-pdf/<id>). */
function pathIdOf(req) {
	const url = String(req?.url ?? "");
	const idx = url.lastIndexOf("/");
	if (idx < 0) return null;
	const id = decodeURIComponent(url.slice(idx + 1).split("?")[0]).trim();
	return id.length > 0 ? id : null;
}
function formatSwitch(value) {
	const current = value.current;
	const list = (value.papers ?? []).map((p) => `- ${p.title} (${p.id})`).join("\n") || "（空）";
	return current ? `当前论文: 《${current.title}》${value.created ? " (新建)" : ""}\n论文库:\n${list}` : `论文库:\n${list}`;
}
function formatCapture(value) {
	return [
		`论文: 《${value.paper?.title}》`,
		value.switchedTo ? `⚠️ 检测到内容属于《${value.switchedTo}》,已自动切换当前论文并归档` : "",
		`重复: ${value.duplicate ? "是(未重复归档)" : "否(已归档)"}`,
		value.savedPath ? `已保存: ${value.savedPath}` : "",
		`清理: 去掉 ${value.droppedLines} 行杂项`,
		"",
		"清洗后文本:",
		value.normalized
	].filter(Boolean).join("\n");
}
function formatFigure(value) {
	return [
		`论文: 《${value.paper?.title}》`,
		value.figurePath ? `已保存: ${value.figurePath}` : "",
		"",
		value.transcript
	].filter(Boolean).join("\n");
}
function formatGlossary(value) {
	const entries = (value.entries ?? []).map((e) => `- **${e.term}** — ${e.explanation}`).join("\n") || "（暂无术语）";
	return `论文: 《${value.paper?.title}》${value.added ? " (已新增)" : ""}\n${entries}`;
}
function formatFind(value) {
	const matches = value.matches ?? [];
	if (matches.length === 0) return "（无匹配）";
	return matches.map((m) => `《${m.paper}》: ${m.match}`).join("\n");
}
function formatPdf(value) {
	return [
		`论文: 《${value.paper?.title}》`,
		`PDF 已归档: ${value.pdfPath}`,
		`标题: ${value.title}`,
		`页数: ${value.pages} · 大小: ${(value.bytes / 1024 / 1024).toFixed(1)} MB`,
		"",
		"提取文本(预览):",
		value.textPreview || "（无文本层——扫描版 PDF,请配合 paper_read_figure 逐页读图）"
	].join("\n");
}
//#endregion
export { Config, apply, inject, name };

//# sourceMappingURL=index.js.map