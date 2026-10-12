// This module contains an evaluate function that takes an SLD expression and a feature and outputs the value for that feature.
// Constant expressions are returned as-is.

import { LineString, MultiLineString } from 'ol/geom';
import { getFunction } from './functions';

/**
 * @private
 * Get the rotation in degrees of the last segment of a (multi)line geometry.
 * For a MultiLineString the last line string is used.
 * @param {ol/geom/Geometry} geometry OpenLayers geometry.
 * @returns {number|null} Rotation in degrees, or null if it cannot be determined.
 */
function getEndAngle(geometry) {
  let lineString = geometry;
  if (geometry instanceof MultiLineString) {
    const lineStrings = geometry.getLineStrings();
    lineString = lineStrings[lineStrings.length - 1];
  }
  if (!(lineString instanceof LineString)) {
    return null;
  }
  const coordinates = lineString.getCoordinates();
  if (coordinates.length < 2) {
    return null;
  }
  const [start, end] = coordinates.slice(coordinates.length - 2);
  const dx = end[1] - start[1];
  const dy = end[0] - start[0];
  const rotation = Math.atan2(dy, dx);
  return rotation * (180 / Math.PI) - 90;
}

/**
 * Check if an expression depends on feature properties.
 * @private
 * @param {Expression} expression SLDReader expression object.
 * @returns {bool} Returns true if the expression depends on feature properties.
 */
export function isDynamicExpression(expression) {
  switch ((expression || {}).type) {
    case 'expression':
      // Expressions with all literal child values are already concatenated into a static string,
      // so any expression that survives that process has at least one non-literal child
      // and therefore possibly dynamic component.
      return true;
    case 'literal':
      return false;
    case 'propertyname':
      return true;
    case 'function':
      // Note: assuming function expressions are dynamic is correct in most practical cases.
      // A more accurate implementation would be that a function expression is static if:
      // * The function is idempotent. You cannot tell from the implementation, unless the implementor marks it as such.
      // * All function parameter expressions are static.
      return true;
    default:
      return false;
  }
}

/**
 * @private
 * This function takes an SLD expression and an OL feature and outputs the expression value for that feature.
 * Constant expressions are returned as-is.
 * @param {Expression} expression SLD object expression.
 * @param {ol/feature} feature OpenLayers feature instance.
 * @param {function} getProperty A function to get a specific property value from a feature.
 * @param {any} defaultValue Optional default value to use when feature is null.
 * Signature (feature, propertyName) => property value.
 */
export default function evaluate(
  expression,
  feature,
  getProperty,
  defaultValue = null
) {
  // Determine the value of the expression.
  let value = null;

  const jsType = typeof expression;
  if (
    jsType === 'string' ||
    jsType === 'number' ||
    jsType === 'undefined' ||
    jsType === 'boolean' ||
    expression === null
  ) {
    // Expression value equals the expression itself if it's a native javascript type.
    value = expression;
  } else if (expression.type === 'literal') {
    // Take expression value directly from literal type expression.
    value = expression.value;
  } else if (expression.type === 'propertyname') {
    // Expression value is taken from input feature.
    // If feature is null/undefined, use default value instead.
    const propertyName = expression.value;
    if (feature) {
      // If the property name equals the geometry field name, return the feature geometry.
      if (
        typeof feature.getGeometryName === 'function' &&
        propertyName === feature.getGeometryName()
      ) {
        value = feature.getGeometry();
      } else {
        value = getProperty(feature, propertyName);
      }
    } else {
      value = defaultValue;
    }
  } else if (expression.type === 'expression') {
    // Expression value is the concatenation of all child expession values.
    if (expression.children.length === 1) {
      value = evaluate(
        expression.children[0],
        feature,
        getProperty,
        defaultValue
      );
    } else {
      // In case of multiple child expressions, concatenate the evaluated child results.
      const childValues = [];
      for (let k = 0; k < expression.children.length; k += 1) {
        childValues.push(
          // Do not use default values when evaluating children. Only apply default is
          // the concatenated result is empty.
          evaluate(expression.children[k], feature, getProperty, null)
        );
      }
      value = childValues.join('');
    }
  } else if (expression.type === 'function') {
    const func = getFunction(expression.name);
    if (feature && expression.name === 'endAngle') {
      const endAngle = getEndAngle(feature.getGeometry());
      value = endAngle === null ? expression.fallbackValue : endAngle;
    } else if (!func) {
      value = expression.fallbackValue;
    } else {
      try {
        // evaluate parameter expressions.
        const paramValues = expression.params.map(paramExpression =>
          evaluate(paramExpression, feature, getProperty)
        );
        value = func(...paramValues);
      } catch (e) {
        value = expression.fallbackValue;
      }
    }
  }

  // Do not substitute default value if the value is numeric zero.
  if (value === 0) {
    return value;
  }

  // Check if value is empty/null. If so, return default value.
  if (
    value === null ||
    typeof value === 'undefined' ||
    value === '' ||
    Number.isNaN(value)
  ) {
    return defaultValue;
  }

  // Convert value to number if expression is flagged as numeric.
  if (expression && expression.typeHint === 'number') {
    value = Number(value);
    if (Number.isNaN(value)) {
      return defaultValue;
    }
  }

  return value;
}
