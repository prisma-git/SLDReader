export const endPointArrowSld = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0" xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>End point arrow</Name>
    <UserStyle>
      <Name>End point arrow</Name>
      <FeatureTypeStyle>
        <Rule>
          <PointSymbolizer>
            <Geometry>
              <ogc:Function name="endPoint">
                <ogc:PropertyName>geometry</ogc:PropertyName>
              </ogc:Function>
            </Geometry>
            <Graphic>
              <Mark>
                <WellKnownName>triangle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#000000</CssParameter>
                </Fill>
              </Mark>
              <Size>12</Size>
              <Rotation>
                <ogc:Add>
                  <ogc:Function name="endAngle">
                    <ogc:PropertyName>geometry</ogc:PropertyName>
                  </ogc:Function>
                  <ogc:Literal>90.0</ogc:Literal>
                </ogc:Add>
              </Rotation>
            </Graphic>
          </PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
`;

export default endPointArrowSld;
