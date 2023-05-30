import { Style, Fill, Stroke, Text } from 'ol/style';
import { getOLColorString, memoizeStyleFunction } from './styleUtils';
import evaluate, { isDynamicExpression } from '../olEvaluator';
import { emptyStyle } from './static';

/**
 * @private
 * Get the static OL style instance for a text symbolizer.
 * The text and placement properties will be set on the style object at runtime.
 * @param {object} textsymbolizer SLD text symbolizer object.
 * @return {object} openlayers style
 */
function textStyle(textsymbolizer) {
  if (!(textsymbolizer && textsymbolizer.label)) {
    return emptyStyle;
  }

  // If the label is dynamic, set text to empty string.
  // In that case, text will be set at runtime.
  const labelText = evaluate(textsymbolizer.label, null, null, '');

  const fill = textsymbolizer.fill ? textsymbolizer.fill.styling : {};
  const {
    fontFamily = 'sans-serif',
    fontSize = 10,
    fontStyle = '',
    fontWeight = '',
  } = textsymbolizer.font && textsymbolizer.font.styling
    ? textsymbolizer.font.styling
    : {};

  const pointplacement =
    textsymbolizer &&
    textsymbolizer.labelplacement &&
    textsymbolizer.labelplacement.pointplacement
      ? textsymbolizer.labelplacement.pointplacement
      : {};

  // If rotation is dynamic, default to 0. Rotation will be set at runtime.
  const labelRotationDegrees = evaluate(
    pointplacement.rotation,
    null,
    null,
    0.0
  );

  const displacement =
    pointplacement && pointplacement.displacement
      ? pointplacement.displacement
      : {};
  const offsetX = displacement.displacementx ? displacement.displacementx : 0;
  const offsetY = displacement.displacementy ? displacement.displacementy : 0;

  // OpenLayers does not support fractional alignment, so snap the anchor to the most suitable option.
  const anchorpoint = (pointplacement && pointplacement.anchorpoint) || {};

  let textAlign = 'center';
  const anchorpointx = Number(
    anchorpoint.anchorpointx === '' ? NaN : anchorpoint.anchorpointx
  );
  if (anchorpointx < 0.25) {
    textAlign = 'left';
  } else if (anchorpointx > 0.75) {
    textAlign = 'right';
  }

  let textBaseline = 'middle';
  const anchorpointy = Number(
    anchorpoint.anchorpointy === '' ? NaN : anchorpoint.anchorpointy
  );
  if (anchorpointy < 0.25) {
    textBaseline = 'bottom';
  } else if (anchorpointy > 0.75) {
    textBaseline = 'top';
  }

  const textFillColor = evaluate(fill.fill, null, null, '#000000');
  const textFillOpacity = evaluate(fill.fillOpacity, null, null, 1.0);

  // Assemble text style options.
  const textStyleOptions = {
    text: labelText,
    font: `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`,
    offsetX: Number(offsetX),
    offsetY: Number(offsetY),
    rotation: (Math.PI * labelRotationDegrees) / 180.0,
    textAlign,
    textBaseline,
    fill: new Fill({
      color: getOLColorString(textFillColor, textFillOpacity),
    }),
  };

  // Convert SLD halo to text symbol stroke.
  if (textsymbolizer.halo) {
    const haloStyling =
      textsymbolizer.halo && textsymbolizer.halo.fill
        ? textsymbolizer.halo.fill.styling
        : {};
    const haloFillColor = evaluate(haloStyling.fill, null, null, '#FFFFFF');
    const haloFillOpacity = evaluate(haloStyling.fillOpacity, null, null, 1.0);
    const haloRadius = evaluate(textsymbolizer.halo.radius, null, null, 1.0);
    textStyleOptions.stroke = new Stroke({
      color: getOLColorString(haloFillColor, haloFillOpacity),
      // wrong position width radius equal to 2 or 4
      width:
        (haloRadius === 2 || haloRadius === 4
          ? haloRadius - 0.00001
          : haloRadius) * 2,
    });
  }

  return new Style({
    text: new Text(textStyleOptions),
  });
}

const cachedTextStyle = memoizeStyleFunction(textStyle);

/**
 * @private
 * Get an OL text style instance for a feature according to a symbolizer.
 * @param {object} symbolizer SLD symbolizer object.
 * @param {ol/Feature} feature OpenLayers Feature.
 * @param {Function} getProperty A property getter: (feature, propertyName) => property value.
 * @returns {ol/Style} OpenLayers style instance.
 */
function getTextStyle(symbolizer, feature, getProperty) {
  const olStyle = cachedTextStyle(symbolizer);
  const olText = olStyle.getText();
  if (!olText) {
    return olStyle;
  }

  // Read text from feature and set it on the text style instance.
  const { label, labelplacement } = symbolizer;

  // Set text only if the label expression is dynamic.
  if (isDynamicExpression(label)) {
    const labelText = evaluate(label, feature, getProperty);
    // Important! OpenLayers expects the text property to always be a string.
    olText.setText(labelText.toString());
  }

  // Set rotation if expression is dynamic.
  if (labelplacement) {
    const pointPlacementRotation =
      (labelplacement.pointplacement &&
        labelplacement.pointplacement.rotation) ||
      0.0;
    if (isDynamicExpression(pointPlacementRotation)) {
      const labelRotationDegrees = evaluate(
        pointPlacementRotation,
        feature,
        getProperty
      );
      olText.setRotation((Math.PI * labelRotationDegrees) / 180.0); // OL rotation is in radians.
    }
  }

  // Set line or point placement according to geometry type.
  const geometry = feature.getGeometry
    ? feature.getGeometry()
    : feature.geometry;
  const geometryType = geometry.getType ? geometry.getType() : geometry.type;
  const lineplacement =
    symbolizer &&
    symbolizer.labelplacement &&
    symbolizer.labelplacement.lineplacement
      ? symbolizer.labelplacement.lineplacement
      : null;
  const placement =
    geometryType !== 'point' && lineplacement ? 'line' : 'point';
  olText.setPlacement(placement);

  return olStyle;
}

export default getTextStyle;
