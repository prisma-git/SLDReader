import { MultiPoint, Point } from 'ol/geom';

import getPointStyle from './pointStyle';
import { splitLineString } from './geometryCalcs';

/**
 * @private
 * Get the point located at the middle along a line string.
 * @param {ol/geom/LineString} geometry An OpenLayers LineString geometry.
 * @returns {Array<number>} An [x, y] coordinate array.
 */
function getLineMidpoint(geometry) {
  // Use the splitpoints routine to distribute points over the line with
  // a point-to-point distance along the line equal to half line length.
  // This results in three points. Take the middle point.
  const splitPoints = splitLineString(geometry, geometry.getLength() / 2);
  const [x, y] = splitPoints[1];
  return [x, y];
}

/**
 * @private
 * Get an OL point style instance for a line feature according to a symbolizer.
 * The style will render a point on the middle of the line.
 * @param {object} symbolizer SLD symbolizer object.
 * For a MultiLineString with an endPoint geometry function, one style per line string is
 * returned, each placed at the end of its line string with its own rotation (e.g. endAngle).
 * @param {object} symbolizer SLD symbolizer object.
 * @param {ol/Feature} feature OpenLayers Feature.
 * @param {Function} getProperty A property getter: (feature, propertyName) => property value.
 * @returns {ol/Style|Array<ol/Style>} OpenLayers style instance(s).
 */
function getLinePointStyle(symbolizer, feature, getProperty) {
  if (typeof feature.getGeometry !== 'function') {
    return null;
  }

  const geom = feature.getGeometry();
  if (!geom) {
    return null;
  }

  let pointStyle = null;
  const geomType = geom.getType();
  if (geomType === 'LineString') {
    pointStyle = getPointStyle(symbolizer, feature, getProperty);
    if (!symbolizer.geometry) {
      pointStyle.setGeometry(new Point(getLineMidpoint(geom)));
    }
  } else if (geomType === 'MultiLineString') {
    const lineStrings = geom.getLineStrings();
    const geometryFunction =
      symbolizer.geometry && symbolizer.geometry.function;
    if (geometryFunction && geometryFunction.endpoint) {
      return lineStrings
        .filter(lineString => lineString.getCoordinates().length > 0)
        .map(lineString => {
          // Evaluate the symbolizer against each line string separately, so that
          // geometry dependent expressions (endPoint, endAngle) apply per line string.
          const partFeature = Object.create(feature);
          partFeature.getGeometry = () => lineString;
          // getPointStyle returns a shared cached style instance, so clone it per part.
          return getPointStyle(symbolizer, partFeature, getProperty).clone();
        });
    }
    const multiPointCoords = lineStrings.map(getLineMidpoint);
    pointStyle = getPointStyle(symbolizer, feature, getProperty);
    pointStyle.setGeometry(new MultiPoint(multiPointCoords));
  }

  return pointStyle;
}

export default getLinePointStyle;
