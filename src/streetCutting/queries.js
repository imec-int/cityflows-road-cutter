const install_postgis = async (knex) => {
  await knex.raw('CREATE EXTENSION postgis;');
};

const initialize_schema = async (knex, schema) => {
  await knex.raw(`
    DROP SCHEMA IF EXISTS ${schema} CASCADE;
    CREATE SCHEMA ${schema};
  `);
};

const create_street_segments = async (knex, schema) => {
  let objectName;

  objectName = `${schema}.polygons`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT *
    FROM ${schema}.count_geometries
    WHERE ST_GeometryType(geometry) = 'ST_Polygon'
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.linestrings`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT *
    FROM ${schema}.count_geometries
    WHERE ST_GeometryType(geometry) = 'ST_LineString'
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.polygons_union`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT 
      TMP1.area,
      TMP1.boundary,
      ST_Buffer(TMP1.area::geography, 1e-3)::geometry as buffered_area,
      ST_Buffer(TMP1.boundary::geography, 1e-3)::geometry as buffered_boundary
      -- 1e-3 in the ST_Buffer calls means 1e-3 meters
    FROM (
      SELECT TMP2.geometry as area, ST_Boundary(TMP2.geometry) as boundary
      FROM
        (
          SELECT ST_Union(geometry) as geometry
          FROM ${schema}.polygons
        ) TMP2
    ) TMP1
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.segments_polygons_intersects`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      S.id as segment_id,
      P.id as polygon_id
    FROM
      ${schema}.segments S,
      ${schema}.polygons P
    WHERE ST_Intersects(S.geometry, P.geometry);
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.segment_polygons_collection`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      SPI.segment_id,
      ST_Collect(P.geometry) as geometry
    FROM
      ${schema}.segments_polygons_intersects SPI,
      ${schema}.polygons P
    WHERE
      SPI.polygon_id = P.id
    GROUP BY SPI.segment_id;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.segments_splits`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT 
      SPC.segment_id,
      (ST_Dump(ST_Split(S.geometry, SPC.geometry))).geom as geometry
    FROM
      ${schema}.segments S,
      ${schema}.segment_polygons_collection SPC
    WHERE S.id = SPC.segment_id
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.segments_splits_with_properties`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      row_number() OVER () as id,
      SS.*,
      ST_Buffer(SS.geometry::geography, 1e-3)::geometry as buffered_geometry,
      ST_Length(SS.geometry::geography) as length,
      ST_Intersects(SS.geometry, PU.buffered_boundary) as is_edge --the buffer is there because of float inaccuracies
    FROM
      ${schema}.segments_splits SS,
      ${schema}.polygons_union PU
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `segments_splits_with_properties_geometry_idx`;
  await knex.raw(`
    CREATE INDEX ${objectName}
    ON ${schema}.segments_splits_with_properties
    USING GIST(geometry);
  `);
  console.log(`created index: ${objectName}`);

  objectName = `segments_splits_with_properties_buffered_geometry_idx`;
  await knex.raw(`
    CREATE INDEX ${objectName}
    ON ${schema}.segments_splits_with_properties
    USING GIST(buffered_geometry);
  `);
  console.log(`created index: ${objectName}`);

  objectName = `${schema}.polygons_street_segments`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      SP.id as street_segment_id,
      S."originalId" as street_object_id,
      SP.length as street_segment_length,
      ST_Length(S.geometry::geography) as street_object_length,
      P.datasource as data_source,
      P."gridIndex" as data_source_index,
      SP.is_edge,
      SP.geometry as street_segment_geometry,
      S.geometry as street_object_geometry
    FROM
      ${schema}.segments_splits_with_properties as SP,
      ${schema}.segments S,
      ${schema}.polygons as P
    WHERE
      SP.segment_id = S.id AND
      ST_Intersects(SP.geometry, P.geometry) AND
      ST_Length(ST_Intersection(SP.geometry, P.geometry)::geography) > 1e-3
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.linestrings_street_segments`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      SS.street_segment_id,
      SS.street_object_id,
      SS.street_segment_length,
      SS.street_object_length,
      LS.datasource as data_source,
      LS."gridIndex" as data_source_index,
      SS.is_edge,
      SS.street_segment_geometry,
      SS.street_object_geometry
    FROM 
      ${schema}.linestrings LS,
      ${schema}.polygons_street_segments SS
    WHERE LS.street_object_id = SS.street_object_id
    ;    
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.street_segments`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT * FROM ${schema}.polygons_street_segments
    UNION
    SELECT * FROM ${schema}.linestrings_street_segments
    ;    
  `);
  console.log(`created table: ${objectName}`);
};

const fetch_street_segments = async (knex, schema) =>
  knex.raw(`
    SELECT
      street_segment_id,
      street_object_id,
      street_segment_length,
      street_object_length,
      data_source,
      data_source_index,
      is_edge,
      ST_AsText(street_segment_geometry) as street_segment_geometry,
      ST_AsText(street_object_geometry) as street_object_geometry
    FROM ${schema}.street_segments
    WHERE street_object_id IN
    (
      SELECT DISTINCT street_object_id
      FROM ${schema}.intersection_connected_segments
      WHERE intersection_type = 'physical'
    );
`);

const create_intersections = async (knex, schema) => {
  objectName = `${schema}.intersections_non_unique`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
      SELECT 
        (ST_DumpPoints(MP.geometry)).geom as geometry,
        MP.type
      FROM (
        SELECT
          ST_Intersection(S1.geometry, S2.geometry) as geometry,
          CASE
            WHEN S1.segment_id = S2.segment_id THEN 'virtual'
            ELSE 'physical'
          END AS type
        FROM
          ${schema}.segments_splits_with_properties as S1,
          ${schema}.segments_splits_with_properties as S2
        WHERE
          S1.id > S2.id AND -- using > instead of != speeds up by a factor 2 -> really nice
          NOT (S1.is_edge = True AND S2.is_edge = True) AND
          ST_Intersects(S1.buffered_geometry, S2.buffered_geometry)
      ) AS MP
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.intersections_unique`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT DISTINCT geometry, type
    FROM ${schema}.intersections_non_unique
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `${schema}.intersections_unique_with_properties`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      row_number() OVER () as id,
      I.*,
      ST_Intersects(I.geometry, PU.buffered_boundary) as is_edge --the buffer is there because of float inaccuracies
    FROM 
      ${schema}.intersections_unique I,
      ${schema}.polygons_union PU
    ;
  `);
  console.log(`created table: ${objectName}`);

  objectName = `intersections_unique_with_properties_idx`;
  await knex.raw(`
    CREATE INDEX ${objectName}
    ON ${schema}.intersections_unique_with_properties
    USING GIST(geometry);
  `);
  console.log(`created index: ${objectName}`);

  objectName = `${schema}.intersection_connected_segments`;
  await knex.raw(`
    CREATE TABLE ${objectName} AS
    SELECT
      I.id as intersection_id,
      I.type as intersection_type,
      I.is_edge,
      SS.id as street_segment_id,
      S."originalId" as street_object_id,
      CASE
        WHEN ST_Intersects(ST_StartPoint(SS.geometry), I.geometry) THEN 'head'
        WHEN ST_Intersects(ST_EndPoint(SS.geometry), I.geometry) THEN 'tail'
        ELSE 'error'
      END AS end_type,
      I.geometry
    FROM
      ${schema}.intersections_unique_with_properties as I,
      ${schema}.segments_splits_with_properties as SS,
      ${schema}.segments as S
    WHERE
      ST_Intersects(SS.buffered_geometry, I.geometry) AND
      SS.segment_id = S.id
    ;
  `);
  console.log(`created table: ${objectName}`);
};

const fetch_intersection_connected_segments = async (knex, schema) =>
  knex.raw(`
    SELECT
      intersection_id,
      intersection_type,
      is_edge,
      street_segment_id,
      street_object_id,
      end_type,
      ST_ASText(geometry) as geometry
    FROM ${schema}.intersection_connected_segments;
`);

module.exports = {
  install_postgis,
  initialize_schema,
  create_street_segments,
  create_intersections,
  fetch_intersection_connected_segments,
  fetch_street_segments,
};
