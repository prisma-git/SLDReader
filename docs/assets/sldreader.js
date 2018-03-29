(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ol/style/style'), require('ol/style/fill'), require('ol/style/stroke'), require('ol/style/circle')) :
  typeof define === 'function' && define.amd ? define(['exports', 'ol/style/style', 'ol/style/fill', 'ol/style/stroke', 'ol/style/circle'], factory) :
  (factory((global.SLDReader = {}),global.ol.style.Style,global.ol.style.Fill,global.ol.style.Stroke,global.ol.style.Circle));
}(this, (function (exports,Style,Fill,Stroke,Circle) { 'use strict';

  Style = Style && Style.hasOwnProperty('default') ? Style['default'] : Style;
  Fill = Fill && Fill.hasOwnProperty('default') ? Fill['default'] : Fill;
  Stroke = Stroke && Stroke.hasOwnProperty('default') ? Stroke['default'] : Stroke;
  Circle = Circle && Circle.hasOwnProperty('default') ? Circle['default'] : Circle;

  /**
   * Generic parser for elements with maxOccurs > 1
   * it pushes result of readNode(node) to array on obj[prop]
   * @private
   * @param {Element} node the xml element to parse
   * @param {object} obj  the object to modify
   * @param {string} prop key on obj to hold array
   */
  function addPropArray(node, obj, prop) {
    var property = prop.toLowerCase();
    obj[property] = obj[property] || [];
    var item = {};
    readNode(node, item);
    obj[property].push(item);
  }

  /**
   * Generic parser for maxOccurs = 1
   * it sets result of readNode(node) to array on obj[prop]
   * @private
   * @param {Element} node the xml element to parse
   * @param {object} obj  the object to modify
   * @param {string} prop key on obj to hold empty object
   */
  function addProp(node, obj, prop) {
    var property = prop.toLowerCase();
    obj[property] = {};
    readNode(node, obj[property]);
  }

  /**
   * recieves textcontent of element with tagName
   * @private
   * @param  {Element} element [description]
   * @param  {string} tagName [description]
   * @return {string}
   */
  function getText(element, tagName) {
    var collection = element.getElementsByTagNameNS('http://www.opengis.net/sld', tagName);
    return collection.length ? collection.item(0).textContent : '';
  }

  /**
   * recieves boolean of element with tagName
   * @private
   * @param  {Element} element [description]
   * @param  {string} tagName [description]
   * @return {boolean}
   */
  function getBool(element, tagName) {
    var collection = element.getElementsByTagNameNS('http://www.opengis.net/sld', tagName);
    if (collection.length) {
      return Boolean(collection.item(0).textContent);
    }
    return false;
  }

  /**
   * Each propname is a tag in the sld that should be converted to plain object
   * @private
   * @type {Object}
   */
  var parsers = {
    NamedLayer: function (element, obj) {
      addPropArray(element, obj, 'layers');
    },
    UserStyle: function (element, obj) {
      obj.styles = obj.styles || [];
      var style = {
        default: getBool(element, 'IsDefault'),
        featuretypestyles: [],
      };
      readNode(element, style);
      obj.styles.push(style);
    },
    FeatureTypeStyle: function (element, obj) {
      var featuretypestyle = {
        rules: [],
      };
      readNode(element, featuretypestyle);
      obj.featuretypestyles.push(featuretypestyle);
    },
    Rule: function (element, obj) {
      var rule = {};
      readNode(element, rule);
      obj.rules.push(rule);
    },
    Filter: function (element, obj) {
      obj.filter = {};
      readNode(element, obj.filter);
    },
    ElseFilter: function (element, obj) {
      obj.elsefilter = true;
    },
    Or: addProp,
    And: addProp,
    Not: addProp,
    PropertyIsEqualTo: addPropArray,
    PropertyIsNotEqualTo: addPropArray,
    PropertyIsLessThan: addPropArray,
    PropertyIsLessThanOrEqualTo: addPropArray,
    PropertyIsGreaterThan: addPropArray,
    PropertyIsGreaterThanOrEqualTo: addPropArray,
    PropertyName: function (element, obj) {
      obj.propertyname = element.textContent;
    },
    Literal: function (element, obj) {
      obj.literal = element.textContent;
    },
    FeatureId: function (element, obj) {
      obj.featureid = obj.featureid || [];
      obj.featureid.push(element.getAttribute('fid'));
    },
    Name: function (element, obj) {
      obj.name = element.textContent;
    },
    MaxScaleDenominator: function (element, obj) {
      obj.maxscaledenominator = element.textContent;
    },
    PolygonSymbolizer: addProp,
    LineSymbolizer: addProp,
    PointSymbolizer: addProp,
    Fill: addProp,
    Stroke: addProp,
    ExternalGraphic: addProp,
    OnlineResource: function (element) { return getText(element, 'sld:OnlineResource'); },
    CssParameter: function (element, obj) {
      obj.css = obj.css || [];
      obj.css.push({
        name: element.getAttribute('name'),
        value: element.textContent.trim(),
      });
    },
  };

  /**
   * walks over xml nodes
   * @private
   * @param  {Element} node derived from xml
   * @param  {object} obj recieves results
   * @return {void}
   */
  function readNode(node, obj) {
    for (var n = node.firstElementChild; n; n = n.nextElementSibling) {
      if (parsers[n.localName]) {
        parsers[n.localName](n, obj, n.localName);
      }
    }
  }

  /**
   * Creates a object from an sld xml string, for internal usage
   * @param  {string} sld xml string
   * @return {StyledLayerDescriptor}  object representing sld style
   */
  function Reader(sld) {
    var result = {};
    var parser = new DOMParser();
    var doc = parser.parseFromString(sld, 'application/xml');

    for (var n = doc.firstChild; n; n = n.nextSibling) {
      result.version = n.getAttribute('version');
      readNode(n, result);
    }
    return result;
  }

  /**
   * @typedef StyledLayerDescriptor
   * @name StyledLayerDescriptor
   * @description a typedef for StyledLayerDescriptor {@link http://schemas.opengis.net/sld/1.1/StyledLayerDescriptor.xsd xsd}
   * @property {string} version sld version
   * @property {Layer[]} layers info extracted from NamedLayer element
   */

  /**
   * @typedef Layer
   * @name Layer
   * @description a typedef for Layer, the actual style object for a single layer
   * @property {string} name layer name
   * @property {Object[]} styles See explanation at [Geoserver docs](http://docs.geoserver.org/stable/en/user/styling/sld/reference/styles.html)
   * @property {Boolean} styles[].default
   * @property {String} [styles[].name]
   * @property {FeatureTypeStyle[]} styles[].featuretypestyles Geoserver will draw multiple,
   * libraries as openlayers can only use one definition!
   */

  /**
   * @typedef FeatureTypeStyle
   * @name FeatureTypeStyle
   * @description a typedef for FeatureTypeStyle: {@link http://schemas.opengis.net/se/1.1.0/FeatureStyle.xsd xsd}
   * @property {Rule[]} rules
   */

  /**
   * @typedef Rule
   * @name Rule
   * @description a typedef for Rule to match a feature: {@link http://schemas.opengis.net/se/1.1.0/FeatureStyle.xsd xsd}
   * @property {string} name rule name
   * @property {Filter} [filter]
   * @property {boolean} [elsefilter]
   * @property {integer} [minscaledenominator]
   * @property {integer} [maxscaledenominator]
   * @property {PolygonSymbolizer} [polygonsymbolizer]
   * @property {LineSymbolizer}  [linesymbolizer]
   * @property {PointSymbolizer} [pointsymbolizer]
   * */

  /**
   * @typedef Filter
   * @name Filter
   * @description [ogc filters]( http://schemas.opengis.net/filter/1.1.0/filter.xsd) should have only one prop
   * @property {string[]} [featureid]
   * @property {object} [or]  filter
   * @property {object} [and]  filter
   * @property {object} [not]  filter
   * @property {object[]} [propertyisequalto]  propertyname & literal
   * @property {object[]} [propertyislessthan]  propertyname & literal
   * */

  /**
   * @typedef PolygonSymbolizer
   * @name PolygonSymbolizer
   * @description a typedef for [PolygonSymbolizer](http://schemas.opengis.net/se/1.1.0/Symbolizer.xsd)
   * @property {Object} fill
   * @property {array} fill.css
   * @property {Object} stroke
   * @property {Object[]} stroke.css with name & value
   * */

  /**
   * @typedef LineSymbolizer
   * @name LineSymbolizer
   * @description a typedef for [LineSymbolizer](http://schemas.opengis.net/se/1.1.0/Symbolizer.xsd)
   * @property {Object} stroke
   * @property {Object[]} stroke.css with name & value Names are camelcased CssParameter names
   * */

  /**
   * @typedef PointSymbolizer
   * @name PointSymbolizer
   * @description a typedef for [PointSymbolizer](http://schemas.opengis.net/se/1.1.0/Symbolizer.xsd)
   * @property {Object} graphic
   * @property {Object} graphic.externalgraphic
   * @property {string} graphic.externalgraphic.onlineresource
   * */

  /**
   * @private
   * @param  {string} hex   eg #AA00FF
   * @param  {Number} alpha eg 0.5
   * @return {string}       rgba(0,0,0,0)
   */
  function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    if (alpha) {
      return ("rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")");
    }
    return ("rgb(" + r + ", " + g + ", " + b + ")");
  }

  /**
   * Create openlayers style from object returned by rulesConverter
   * @param {StyleDescription} styleDescription rulesconverter
   * @param {string} type geometry type, @see {@link http://geojson.org|geojson}
   * @return ol.style.Style or array of it
   */
  function OlStyler(styleDescription, type) {
    if ( type === void 0 ) type = 'Polygon';

    var polygon = styleDescription.polygon;
    var line = styleDescription.line;
    switch (type) {
      case 'Polygon':
      case 'MultiPolygon':
        return [
          new Style({
            fill: new Fill({
              color:
                polygon.fillOpacity && polygon.fill && polygon.fill.slice(0, 1) === '#'
                  ? hexToRGB(polygon.fill, polygon.fillOpacity)
                  : polygon.fill,
            }),
            stroke: new Stroke({
              color: polygon.stroke || '#3399CC',
              width: polygon.strokeWidth || 1.25,
              lineCap: polygon.strokeLinecap && polygon.strokeLinecap,
              lineDash: polygon.strokeDasharray && polygon.strokeDasharray.split(' '),
              lineDashOffset: polygon.strokeDashoffset && polygon.strokeDashoffset,
              lineJoin: polygon.strokeLinejoin && polygon.strokeLinejoin,
            }),
          }) ];
      case 'LineString':
      case 'MultiLineString':
        return [
          new Style({
            stroke: new Stroke({
              color: line.stroke || '#3399CC',
              width: line.strokeWidth || 1.25,
              lineCap: line.strokeLinecap && line.strokeLinecap,
              lineDash: line.strokeDasharray && line.strokeDasharray.split(' '),
              lineDashOffset: line.strokeDashoffset && line.strokeDashoffset,
              lineJoin: line.strokeLinejoin && line.strokeLinejoin,
            }),
          }) ];
      default:
        return [
          new Style({
            image: new Circle({
              radius: 2,
              fill: new Fill({
                color: 'blue',
              }),
            }),
          }) ];
    }
  }

  /**
   * Merges style props of rules, last defined rule props win
   * @param  {Rule[]} rules [description]
   * @return {StyleDescription}
   */
  function getStyleDescription(rules) {
    var result = {
      polygon: {},
      line: {},
      point: {},
    };
    for (var i = 0; i < rules.length; i += 1) {
      if (rules[i].polygonsymbolizer && rules[i].polygonsymbolizer.fill) {
        setCssParams(result.polygon, rules[i].polygonsymbolizer.fill.css);
      }
      if (rules[i].polygonsymbolizer && rules[i].polygonsymbolizer.stroke) {
        setCssParams(result.polygon, rules[i].polygonsymbolizer.stroke.css);
      }
      if (rules[i].linesymbolizer && rules[i].linesymbolizer.stroke) {
        setCssParams(result.line, rules[i].linesymbolizer.stroke.css);
      }
    }
    return result;
  }

  /**
   * @param {object} result    [description]
   * @param {object[]} cssparams [description]
   */
  function setCssParams(result, cssparams) {
    for (var j = 0; j < cssparams.length; j += 1) {
      var key = cssparams[j].name
        .toLowerCase()
        .replace(/-(.)/g, function (match, group1) { return group1.toUpperCase(); });
      result[key] = cssparams[j].value;
    }
  }

  /**
   * @typedef StyleDescription
   * @name StyleDescription
   * @description a flat object per symbolizer type, with values assigned to camelcased props.
   * @property {object} polygon merged polygonsymbolizers
   * @property {object} line merged linesymbolizers
   * @property {object} point merged pointsymbolizers, props are camelcased.
   */

  var Filters = {
    featureid: function (value, feature) {
      for (var i = 0; i < value.length; i += 1) {
        if (value[i] === feature.id) {
          return true;
        }
      }
      return false;
    },
    not: function (value, feature) { return !filterSelector(value, feature); },
    or: function (value, feature) {
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i += 1) {
        if (value[keys[i]].length === 1 && filterSelector(value, feature, i)) {
          return true;
        } else if (value[keys[i]].length !== 1) {
          throw new Error('multiple ops of same type not implemented yet');
        }
      }
      return false;
    },
    propertyisequalto: function (value, feature) { return feature.properties[value['0'].propertyname] &&
      feature.properties[value['0'].propertyname] === value['0'].literal; },
    propertyislessthan: function (value, feature) { return feature.properties[value['0'].propertyname] &&
      Number(feature.properties[value['0'].propertyname]) < Number(value['0'].literal); },
  };

  /**
   * [filterSelector description]
   * @private
   * @param  {Filter} filter
   * @param  {object} feature feature
   * @param {number} key index of property to use
   * @return {boolean}
   */
  function filterSelector(filter, feature, key) {
    if ( key === void 0 ) key = 0;

    var type = Object.keys(filter)[key];
    if (Filters[type]) {
      if (Filters[type](filter[type], feature)) {
        return true;
      }
    } else {
      throw new Error(("Unkown filter " + type));
    }
    return false;
  }

  /**
   * [scaleSelector description]
   * The "standardized rendering pixel size" is defined to be 0.28mm × 0.28mm
   * @param  {Rule} rule
   * @param  {number} resolution  m/px
   * @return {boolean}
   */
  function scaleSelector(rule, resolution) {
    if (rule.maxscaledenominator !== undefined && rule.minscaledenominator !== undefined) {
      if (
        resolution / 0.00028 < rule.maxscaledenominator &&
        resolution / 0.00028 > rule.minscaledenominator
      ) {
        return true;
      }
      return false;
    }
    if (rule.maxscaledenominator !== undefined) {
      return resolution / 0.00028 < rule.maxscaledenominator;
    }
    if (rule.minscaledenominator !== undefined) {
      return resolution / 0.00028 > rule.minscaledenominator;
    }
    return true;
  }

  /**
   * get all layer names in sld
   * @param {StyledLayerDescriptor} sld
   * @return {string[]} registered layernames
   */
  function getLayerNames(sld) {
    return sld.layers.map(function (l) { return l.name; });
  }

  /**
   * getlayer with name
   * @param  {StyledLayerDescriptor} sld       [description]
   * @param  {string} layername [description]
   * @return {Layer}           [description]
   */
  function getLayer(sld, layername) {
    return sld.layers.find(function (l) { return l.name === layername; });
  }

  /**
   * getStyleNames, notice name is not required for userstyle, you might get undefined
   * @param  {Layer} layer [description]
   * @return {string[]}       [description]
   */
  function getStyleNames(layer) {
    return layer.styles.map(function (s) { return s.name; });
  }
  /**
   * get style, if name is undefined it returns default style.
   * null is no style found
   * @param  {Layer} layer [description]
   * @param {string} name of style
   * @return {object} the style with matching name
   */
  function getStyle(layer, name) {
    if (name) {
      return layer.styles.find(function (s) { return s.name === name; });
    }
    return layer.styles.find(function (s) { return s.default; });
  }

  /**
   * get rules for specific feature after applying filters
   * @param  {FeatureTypeStyle} featureTypeStyle [description]
   * @param  {object} feature
   * @param  {number} resolution m/px
   * @return {Rule[]}
   */
  function getRules(featureTypeStyle, feature, resolution) {
    var result = [];
    for (var j = 0; j < featureTypeStyle.rules.length; j += 1) {
      var rule = featureTypeStyle.rules[j];
      if (rule.filter && scaleSelector(rule, resolution) && filterSelector(rule.filter, feature)) {
        result.push(rule);
      } else if (rule.elsefilter && result.length === 0) {
        result.push(rule);
      } else if (!rule.elsefilter && !rule.filter) {
        result.push(rule);
      }
    }
    return result;
  }

  exports.Reader = Reader;
  exports.getStyleDescription = getStyleDescription;
  exports.OlStyler = OlStyler;
  exports.getLayerNames = getLayerNames;
  exports.getLayer = getLayer;
  exports.getStyleNames = getStyleNames;
  exports.getStyle = getStyle;
  exports.getRules = getRules;

  Object.defineProperty(exports, '__esModule', { value: true });

})));