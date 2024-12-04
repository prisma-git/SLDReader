import { Style } from 'ol/style';
import { Point, Polygon } from 'ol/geom';
import {
  IMAGE_LOADING,
  IMAGE_LOADED,
  IMAGE_ERROR,
  DEFAULT_MARK_SIZE,
} from '../constants';
import { memoizeStyleFunction } from './styleUtils';
import {
  imageLoadingPointStyle,
  imageErrorPointStyle,
  emptyStyle,
} from './static';
import { createCachedImageStyle, getImageLoadingState } from '../imageCache';
import getWellKnownSymbol from './wellknown';
import evaluate, { isDynamicExpression } from '../olEvaluator';
import { getSimpleFill, getSimpleStroke } from './simpleStyles';
import {
  applyDynamicFillStyling,
  applyDynamicStrokeStyling,
} from './dynamicStyles';

const defaultMarkFill = getSimpleFill({ styling: { fill: '#888888' } });
const defaultMarkStroke = getSimpleStroke({ styling: { stroke: {} } });

/**
 * @private
 * @param  {PointSymbolizer} pointsymbolizer [description]
 * @return {object} openlayers style
 */
function pointStyle(pointsymbolizer) {
  const { graphic: style } = pointsymbolizer;

  // If the point size is a dynamic expression, use the default point size and update in-place later.
  let pointSizeValue = evaluate(style.size, null, null, DEFAULT_MARK_SIZE);

  // If the point rotation is a dynamic expression, use 0 as default rotation and update in-place later.
  const rotationDegrees = evaluate(style.rotation, null, null, 0.0);

  if (style.externalgraphic && style.externalgraphic.onlineresource) {
    // For external graphics: the default size is the native image size.
    // In that case, set pointSizeValue to null, so no scaling is calculated for the image.
    if (!style.size) {
      pointSizeValue = null;
    }

    const imageUrl = style.externalgraphic.onlineresource;

    // Use fallback point styles when image hasn't been loaded yet.
    switch (getImageLoadingState(imageUrl)) {
      case IMAGE_LOADED:
        return createCachedImageStyle(
          imageUrl,
          pointSizeValue,
          rotationDegrees
        );
      case IMAGE_LOADING:
        return imageLoadingPointStyle;
      case IMAGE_ERROR:
        return imageErrorPointStyle;
      default:
        // A symbolizer should have loading state metadata, but return IMAGE_LOADING just in case.
        return imageLoadingPointStyle;
    }
  }

  if (style.mark) {
    const { wellknownname } = style.mark;
    const olFill = getSimpleFill(style.mark.fill);
    const olStroke = getSimpleStroke(style.mark.stroke);

    return new Style({
      // Note: size will be set dynamically later.
      image: getWellKnownSymbol(
        wellknownname,
        pointSizeValue,
        olStroke,
        olFill,
        rotationDegrees
      ),
    });
  }

  // SLD spec: when no ExternalGraphic or Mark is specified,
  // use a square of 6 pixels with 50% gray fill and a black outline.
  return new Style({
    image: getWellKnownSymbol(
      'square',
      pointSizeValue,
      defaultMarkStroke,
      defaultMarkFill,
      rotationDegrees
    ),
  });
}

const cachedPointStyle = memoizeStyleFunction(pointStyle);
const originalOnlineResources = new Map();
/**
 * @private
 * Get an OL point style instance for a feature according to a symbolizer.
 * @param {object} symbolizer SLD symbolizer object.
 * @param {ol/Feature} feature OpenLayers Feature.
 * @param {Function} getProperty A property getter: (feature, propertyName) => property value.
 * @returns {ol/Style} OpenLayers style instance.
 */
function getPointStyle(symbolizer, feature, getProperty) {
  // According to SLD spec, when a point symbolizer has no Graphic, nothing will be rendered.
  if (!(symbolizer && symbolizer.graphic)) {
    return emptyStyle;
  }

  let olStyle;
  if (
    symbolizer.graphic.externalgraphic &&
    symbolizer.graphic.externalgraphic.onlineresource
  ) {
    if (originalOnlineResources.has(feature.getId())) {
      symbolizer.graphic.externalgraphic.onlineresource =
        originalOnlineResources.get(feature.getId());
    }
    const imageUrl = symbolizer.graphic.externalgraphic.onlineresource;
    if (imageUrl.search(/\${(.*?)}/) >= 0) {
      originalOnlineResources.set(feature.getId(), imageUrl);
      const matches = Array.from(imageUrl.matchAll(/\${(.*?)}/g));
      matches.forEach(match => {
        const property = feature.get(match[1]);
        if (property) {
          symbolizer.graphic.externalgraphic.onlineresource = imageUrl.replace(
            match[0],
            property
          );
        }
      });
      olStyle = pointStyle(symbolizer);
    }
  }
  if (!olStyle) {
    olStyle = cachedPointStyle(symbolizer);
  }

  // Reset previous calculated point geometry left by evaluating point style for a line or polygon feature.
  olStyle.setGeometry(null);

  let olImage = olStyle.getImage();

  // Apply dynamic values to the cached OL style instance before returning it.

  // --- Update dynamic size ---
  const { graphic } = symbolizer;
  const { size } = graphic;
  if (isDynamicExpression(size)) {
    const sizeValue =
      Number(evaluate(size, feature, getProperty)) || DEFAULT_MARK_SIZE;

    if (graphic.externalgraphic && graphic.externalgraphic.onlineresource) {
      const height = olImage.getSize()[1];
      const scale = sizeValue / height || 1;
      olImage.setScale(scale);
    } else if (graphic.mark && graphic.mark.wellknownname === 'circle') {
      // Note: only ol/style/Circle has a setter for radius. RegularShape does not.
      olImage.setRadius(sizeValue * 0.5);
    } else {
      // For a non-Circle RegularShape, create a new olImage in order to update the size.
      olImage = getWellKnownSymbol(
        (graphic.mark && graphic.mark.wellknownname) || 'square',
        sizeValue,
        // Note: re-use stroke and fill instances for a (small?) performance gain.
        olImage.getStroke(),
        olImage.getFill()
      );
      olStyle.setImage(olImage);
    }
  }

  // --- Update dynamic rotation ---
  const { rotation } = graphic;
  if (isDynamicExpression(rotation)) {
    const rotationDegrees =
      Number(evaluate(rotation, feature, getProperty)) || 0.0;
    // Note: OL angles are in radians.
    const rotationRadians = (Math.PI * rotationDegrees) / 180.0;
    olImage.setRotation(rotationRadians);
  }

  // --- geometry ---
  const geometry = symbolizer.geometry;
  if (geometry && geometry.function) {
    const featureGeometry = feature.getGeometry();
    if (!featureGeometry) {
      return olStyle;
    }
    if (geometry.function.endpoint) {
      olStyle.setGeometry(new Point(featureGeometry.getLastCoordinate()));
    } else if (
      geometry.function.interiorpoint &&
      featureGeometry instanceof Polygon
    ) {
      olStyle.setGeometry(new Point(featureGeometry.getInteriorPoint()));
    }
  }

  // --- Update stroke and fill ---
  if (graphic.mark) {
    const strokeChanged = applyDynamicStrokeStyling(
      olImage,
      graphic.mark,
      feature,
      getProperty
    );

    const fillChanged = applyDynamicFillStyling(
      olImage,
      graphic.mark,
      feature,
      getProperty
    );

    if (strokeChanged || fillChanged) {
      // Create a new olImage in order to force a re-render to see the style changes.
      const sizeValue =
        Number(evaluate(size, feature, getProperty)) || DEFAULT_MARK_SIZE;
      olImage = getWellKnownSymbol(
        (graphic.mark && graphic.mark.wellknownname) || 'square',
        sizeValue,
        olImage.getStroke(),
        olImage.getFill()
      );
      olStyle.setImage(olImage);
    }
  }

  return olStyle;
}

export default getPointStyle;
