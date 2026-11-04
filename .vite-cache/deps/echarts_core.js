import { n as __exportAll } from "./rolldown-runtime-SbdDWaPq.js";
import { $n as merge, An as each, C as Group, Cn as bind, D as Rect, Dn as curry, Gn as isObject, In as indexOf, Ln as inherits, Lt as BoundingRect, Mn as extend, Mt as truncateText, Nn as filter, On as defaults, Qn as map, Rn as isArray, S as CompoundPath, Vn as isFunction, cn as vector_exports, dr as util_exports$1, f as zrender_exports, hr as setPlatformAPI, ir as reduce, j as ZRImage, lt as color_exports, mn as matrix_exports, qn as isString, r as brushSingle, tr as mixin, w as ZRText, wn as clone, xn as env, y as encodeHTML } from "./graphic-QJVZ0fjz.js";
import { $a as remRadian, $r as updateProps, A as registerPreprocessor, Aa as getPrecision, Ar as getTransform, Br as resizePath, Bt as createSymbol, C as registerCoordinateSystem, Ca as MAX_SAFE_INTEGER, Cn as getTooltipMarker, D as registerMap, Dn as format, Dr as extendShape, E as registerLoading, Er as extendPath, F as registerVisual, Fa as isRadianAroundZero, Fn as enableDataStack, Fr as makeImage, Ga as numericToNumber, Gn as SeriesData, I as setCanvasCreator, Ia as linearMap, In as getStackedDimension, Ir as makePath, Ka as parseDate, L as version, Li as getECData, Ln as isDimensionStacked, Lr as mergePath, M as registerTheme, Mn as registerLocale, N as registerTransform, Na as isNumeric, O as registerPostInit, Oa as getPercentWithPrecision, On as roundTime, P as registerUpdateLifecycle, Qa as reformIntervals, Rt as ChartView, S as registerAction, T as registerLayout, Ta as asc, Tn as toCamelCase, Un as createDimensions, W as ComponentView, Wa as nice, Wt as SeriesModel, Xa as quantity, Y as throttle, Ya as quantile, Yr as initProps, Za as quantityExponent, _ as getCoordinateSystemDimensions, _i as enableHoverEmphasis, _n as addCommas, ai as BezierCurve, ar as Model, b as getMap, bn as formatTime, br as clipRectByRect, c as AxisModelCommonMixin, ci as Polygon, d as connect, di as Ellipse, ei as IncrementalDisplayable, et as Axis, f as dataTool, fi as Circle, ft as createScaleByModel, g as dispose, h as disconnect, ii as Arc, j as registerProcessor, ja as getPrecisionSafe, k as registerPostUpdate, ka as getPixelPrecision, kr as getShapeClass, l as use, li as Ring, lr as createTextStyle$1, m as disConnect, ni as RadialGradient, o as scaleCalcNice2, oi as Line, p as dependencies, pn as getLayoutRect, pt as determineAxisType, qa as parsePercent, ri as LinearGradient, rn as ComponentModel, si as Polyline, t as parseGeoJSON, to as roundLegacy, u as PRIORITY, ui as Sector, v as getInstanceByDom, vn as capitalFirst, w as registerCustomSeries, wn as normalizeCssArray, x as init, xn as formatTpl, xr as createIcon, y as getInstanceById, yr as clipPointsByRect, zr as registerShape } from "./parseGeoJson-B0KSurX2.js";
import { t as createSeriesData } from "./createSeriesData-PaqsCCjk.js";
// node_modules/echarts/lib/legacy/getTextRect.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function getTextRect(text, font, align, verticalAlign, padding, rich, truncate, lineHeight) {
	return new ZRText({ style: {
		text,
		font,
		align,
		verticalAlign,
		padding,
		rich,
		overflow: truncate ? "truncate" : null,
		lineHeight
	} }).getBoundingRect();
}
// node_modules/echarts/lib/export/api/helper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* This module exposes helper functions for developing extensions.
*/
var helper_exports = /* @__PURE__ */ __exportAll({
	createDimensions: () => createDimensions,
	createList: () => createList,
	createScale: () => createScale,
	createSymbol: () => createSymbol,
	createTextStyle: () => createTextStyle,
	dataStack: () => dataStack,
	enableHoverEmphasis: () => enableHoverEmphasis,
	getECData: () => getECData,
	getLayoutRect: () => getLayoutRect,
	mixinAxisModelCommonMethods: () => mixinAxisModelCommonMethods
});
/**
* Create a multi dimension List structure from seriesModel.
*/
function createList(seriesModel) {
	return createSeriesData(null, seriesModel);
}
var dataStack = {
	isDimensionStacked,
	enableDataStack,
	getStackedDimension
};
/**
* Externally used by echarts-gl.
* Create scale
* @param dataExtent
* @param option If `option.type`
*        is specified, it can only be `'value'` currently.
*/
function createScale(dataExtent, option) {
	var axisModel = option;
	if (!(option instanceof Model)) axisModel = new Model(option);
	var axisType = determineAxisType(axisModel);
	var scale = createScaleByModel(axisModel, axisType, false);
	if (dataExtent[1] < dataExtent[0]) dataExtent = dataExtent.slice().reverse();
	scaleCalcNice2(scale, axisModel, null, null, dataExtent);
	return scale;
}
/**
* Mixin common methods to axis model
*/
function mixinAxisModelCommonMethods(Model) {
	mixin(Model, AxisModelCommonMixin);
}
function createTextStyle(textStyleModel, opts) {
	opts = opts || {};
	return createTextStyle$1(textStyleModel, null, null, opts.state !== "normal");
}
// node_modules/echarts/lib/export/api/number.js
var number_exports = /* @__PURE__ */ __exportAll({
	MAX_SAFE_INTEGER: () => MAX_SAFE_INTEGER,
	asc: () => asc,
	getPercentWithPrecision: () => getPercentWithPrecision,
	getPixelPrecision: () => getPixelPrecision,
	getPrecision: () => getPrecision,
	getPrecisionSafe: () => getPrecisionSafe,
	isNumeric: () => isNumeric,
	isRadianAroundZero: () => isRadianAroundZero,
	linearMap: () => linearMap,
	nice: () => nice,
	numericToNumber: () => numericToNumber,
	parseDate: () => parseDate,
	parsePercent: () => parsePercent,
	quantile: () => quantile,
	quantity: () => quantity,
	quantityExponent: () => quantityExponent,
	reformIntervals: () => reformIntervals,
	remRadian: () => remRadian,
	round: () => roundLegacy
});
// node_modules/echarts/lib/export/api/time.js
var time_exports = /* @__PURE__ */ __exportAll({
	format: () => format,
	parse: () => parseDate,
	roundTime: () => roundTime
});
// node_modules/echarts/lib/export/api/graphic.js
var graphic_exports = /* @__PURE__ */ __exportAll({
	Arc: () => Arc,
	BezierCurve: () => BezierCurve,
	BoundingRect: () => BoundingRect,
	Circle: () => Circle,
	CompoundPath: () => CompoundPath,
	Ellipse: () => Ellipse,
	Group: () => Group,
	Image: () => ZRImage,
	IncrementalDisplayable: () => IncrementalDisplayable,
	Line: () => Line,
	LinearGradient: () => LinearGradient,
	Polygon: () => Polygon,
	Polyline: () => Polyline,
	RadialGradient: () => RadialGradient,
	Rect: () => Rect,
	Ring: () => Ring,
	Sector: () => Sector,
	Text: () => ZRText,
	clipPointsByRect: () => clipPointsByRect,
	clipRectByRect: () => clipRectByRect,
	createIcon: () => createIcon,
	extendPath: () => extendPath,
	extendShape: () => extendShape,
	getShapeClass: () => getShapeClass,
	getTransform: () => getTransform,
	initProps: () => initProps,
	makeImage: () => makeImage,
	makePath: () => makePath,
	mergePath: () => mergePath,
	registerShape: () => registerShape,
	resizePath: () => resizePath,
	updateProps: () => updateProps
});
// node_modules/echarts/lib/export/api/format.js
var format_exports = /* @__PURE__ */ __exportAll({
	addCommas: () => addCommas,
	capitalFirst: () => capitalFirst,
	encodeHTML: () => encodeHTML,
	formatTime: () => formatTime,
	formatTpl: () => formatTpl,
	getTextRect: () => getTextRect,
	getTooltipMarker: () => getTooltipMarker,
	normalizeCssArray: () => normalizeCssArray,
	toCamelCase: () => toCamelCase,
	truncateText: () => truncateText
});
// node_modules/echarts/lib/export/api/util.js
var util_exports = /* @__PURE__ */ __exportAll({
	bind: () => bind,
	clone: () => clone,
	curry: () => curry,
	defaults: () => defaults,
	each: () => each,
	extend: () => extend,
	filter: () => filter,
	indexOf: () => indexOf,
	inherits: () => inherits,
	isArray: () => isArray,
	isFunction: () => isFunction,
	isObject: () => isObject,
	isString: () => isString,
	map: () => map,
	merge: () => merge,
	reduce: () => reduce
});
// node_modules/echarts/lib/export/api.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function extendComponentModel(proto) {
	var Model = ComponentModel.extend(proto);
	ComponentModel.registerClass(Model);
	return Model;
}
function extendComponentView(proto) {
	var View = ComponentView.extend(proto);
	ComponentView.registerClass(View);
	return View;
}
function extendSeriesModel(proto) {
	var Model = SeriesModel.extend(proto);
	SeriesModel.registerClass(Model);
	return Model;
}
function extendChartView(proto) {
	var View = ChartView.extend(proto);
	ChartView.registerClass(View);
	return View;
}
export { Axis, ChartView, ComponentModel, ComponentView, SeriesData as List, Model, PRIORITY, SeriesModel, color_exports as color, connect, dataTool, dependencies, disConnect, disconnect, dispose, env, extendChartView, extendComponentModel, extendComponentView, extendSeriesModel, format_exports as format, getCoordinateSystemDimensions, getInstanceByDom, getInstanceById, getMap, graphic_exports as graphic, helper_exports as helper, init, brushSingle as innerDrawElementOnCanvas, matrix_exports as matrix, number_exports as number, parseGeoJSON, parseGeoJSON as parseGeoJson, registerAction, registerCoordinateSystem, registerCustomSeries, registerLayout, registerLoading, registerLocale, registerMap, registerPostInit, registerPostUpdate, registerPreprocessor, registerProcessor, registerTheme, registerTransform, registerUpdateLifecycle, registerVisual, setCanvasCreator, setPlatformAPI, throttle, time_exports as time, use, util_exports as util, vector_exports as vector, version, util_exports$1 as zrUtil, zrender_exports as zrender };
