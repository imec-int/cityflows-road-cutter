# Road cutter procedure step by step
In this document an high level overview of the different steps that are taken will be represented. The words in bold represent a table or index in created the database.

## Steps:
1. postgis is installed
2. the schema is initialized (this drops the previous one)
3. **count_geometries**
    - are read in from the csv file, the geometries are converted from WKT to raw geometries
    - _columns_: (with the geometry of the datasource)
        |id|gridIndex|datasource|geometry|street_object_id|
        |-|-|-|-|-|
        |integer|varchar(255)|varchar(255)|geometry|integer|
4. **segments**
    - are read in from json, the geometries are converted from WKT to raw geometries
    - _columns_: (with the geometry of the segment)
        |id|originalId|geometry|
        |-|-|-|
        |integer|integer|geometry|
5. prepareStreetCuttingData
    - create_street_segments\
        → computes street_segements
        1. a table **polygons** is created:
            - all the data sources with a polygon as region
            - _uses_: count_geometries
            - _columns_: (with the geometry of the data_source, street_object_id is null)
                |id|gridIndex|datasource|geometry|street_object_id|
                |-|-|-|-|-|
                |integer|varchar(255)|varchar(255)|geometry|integer|
        1. a table **linestrings** is created:
            - all the data sources with a linestring as region
            - _uses_: count_geometries
            - _columns_: (with the geometry of the data_source)
                |id|originalId|geometry|
                |-|-|-|
                |integer|integer|geometry|
        1. a table **polygons_union** is created:
            - adds all the polygons together and adds a buffer (1e-3 meters)
            - *uses*: polygons
            - *columns*: 
                |area|boundary|buffered_area|buffered_boundary|
                |-|-|-|-|
                |geometry|geometry|geometry|geometry|
        1. a table **segments_polygons_intersects** is created:
            - combines all the segments and polygons that intersects
            - *uses*: segments, polygons
            - *columns*: 
                |segment_id|polygon_id|
                |-|-|
                |integer|integer|
        1. a table **segment_polygons_collection** is created:
            - replaces the polygon_id in segments_polygons_intersects with its geometry
            - *uses*: segments_polygons_intersects, polygons
            - *columns*: (with the geometry of the polygon)
                |segment_id|geometry|
                |-|-|
                |integer|geoetry|
        1. a table **segments_splits** is created:
            - splits the street_geometry in segments using the polygon geometry and adds all the segments
            - *uses*: segments, segment_polygons_collection
            - *columns*: (with the geometry of the segment)
                |segment_id|geometry|
                |-|-|
                |integer|geometry|
        1. a table **segments_splits_with_properties** is created:
            - adds some properties to segment_splits
            - *uses*: segment_splits, polygons_union
            - *columns*: (geometry of the segment, buffer = 1e-3meters, is_edge = bool whether the segment is NOT fully inside the bufferd area of the source
                |id|segment_id|geometry|buffered_geometry|length|is_edge|
                |-|-|-|-|-|-|
                |bigint|integer|geometry|geometry|double precision|boolean|
        1. an index **segments_splits_with_properties_geometry_idx** is created:
            - adds index to segments_splits_with_properties on the geometry
            - *uses*: segments_splits_with_properties
        1. an index **segments_splits_with_properties_buffered_geometry_idx** is created:
            - adds index to segments_splits_with_properties on the bufferd_geometry
            - *uses*: segments_splits_with_properties
        1. a table **polygons_street_segments** is created:
            - adds segments_split_with_properties, segments and polygons together on matching ids and when the segment and polygon intersect and the length of the intersection exceeds 1e-3 meter.
            - *uses*: segments_split_with_properties, segments, polygons
            - *columns*:
                |street_segment_id|street_object_id|street_segment_length|street_object_length|data_source|data_source_index|is_edge|street_segment_geometry|street_object_geometry|
                |-|-|-|-|-|-|-|-|-|
                |bigint|integer|double precision|double precision|varchar(255)|varchar(255)|boolean|geometry|geometry|
        1. a table **linestrings_street_segments** is created:
            - by adding linestrings and polygons_street_segments together on the id's
            - *uses*: linestrings, polygons_street_segments
            - *columns*:
                |street_segment_id|street_object_id|street_segment_length|street_object_length|data_source|data_source_index|is_edge|street_segment_geometry|street_object_geometry|
                |-|-|-|-|-|-|-|-|-|
                |bigint|integer|double precision|double precision|varchar(255)|varchar(255)|boolean|geometry|geometry|
        1. a table *street_segments* is created:
            - by the union of polygons_street_segments and linestrings_street_segments
            - *uses*: polygons_street_segments, linestrings_street_segments
            -*columns*:
                |street_segment_id|street_object_id|street_segment_length|street_object_length|data_source|data_source_index|is_edge|street_segment_geometry|street_object_geometry|
                |-|-|-|-|-|-|-|-|-|
                |bigint|integer|double precision|double precision|varchar(255)|varchar(255)|boolean|geometry|geometry|
    - create_intersection\
    → calcualtes the intersections
        1. a table *intersections_non_unique* is created:
            - defines all the intersections where two segments intersect and sets the type
            - *uses*: segment_splits_with properties
            - *columns*:
                |geometry|type|
                |-|-|
                |geometry|text|
        1. a table *intersections_unique* is created:
            - only keeps the unique intersections in intersections_non_unique
            - *uses*: intersections_non_unique
            - *columns*:
                |geometry|type|
                |-|-|
                |geometry|text|
        1. a table *intersections_unique_with_properties* is created:
            - adds an id and whether the intersection is on the edge
            - *uses*: intersections_unique, polygons_union
            - *columns*:
                |id|geometry|type|is_edge|
                |-|-|-|-|
                |bigint|geometry|text|boolean|
        1. an index *intersections_unique_with_properties_idx* is created:
            - adds index to intersection_unique_with_properties on the geometry
            - *uses*: intersection_unique_with_properties
        1. a table intersection_connected_segments is created:
            - adds head/tail attribute; combines segments, segments_splits_with_properties and intersection_unique_with_properties where the segment and intersection intersect and the id’s match
            - *uses*: segments, segments_splits_with_properties, intersection_unique_with_properties
            - *columns*:
                |intersection_id|intersection_type|is_edge|street_segment_id|street_object_id|end_type|geometry|
                |-|-|-|-|-|-|-|
                |bigint|text|boolean|bigint|integer|text|geometry|
1. fetchAndWrite
    - fetchResults:
        1. fetch_intersection_connected_segments\
            →fetches the attributes from intersection_connected_segments (with geometry as WKT)
        1. fetch_street_segments \
            →fetches the attribute from street_segments (with geometry as WKT) where the street_object_id is in intersection_connected_segments filtered on the intersection type in the past
    - files intersection.csv and street_segments.csv are written
