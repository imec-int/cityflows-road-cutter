# Documentation 
The Cityflows road cutter is a service that is part of the Cityflows ecosystem. It is designed to help in the preprocessing of data before it can beprocessed by the [cityflows model](https://github.com/imec-int/cityflows-model). It takes input from a street network and a list of polygons, then labels the steets with the overlapping polygons. The GIS procedures are performed in a POSTGIS database. More information on how the road cutter operates can be found in the [procedure steps](./procedure_steps.md).
 
## Launch a PostGIS instance locally 

```
docker run --name some-postgis -e POSTGRES_DB=postgis -e POSTGRES_USER=postgis -e POSTGRES_PASSWORD=rootpass -e POSTGIS_GEOS_VERSION=3.8.0 -p "5432:5432" -d mdillon/postgis
```

alternatively, you can use another base image (which hase a newer version of GEOS installed)

```
docker run --name some-postgis -e POSTGRES_PASSWD=rootpass -p "5432:5432" -d geographica/postgis
```

You can then connect to the DB using these credentials: 
```
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "rootpass",
    database: "postgres",
```

(if you have an issue where you can't create a table because type `geometry` doesn't exist, try running `CREATE EXTENSION postgis;`)

> If you change some of the env variables, make sure to reflect the change in `src/index.js` where the knex instance is created.

## Input data

The inputdata is defined in the `config.js` file, there a inputfile is determined for the countGeometries and for the segments. The files you specify are required to be available in the following locations:
```
data/COUNTGEOMETRIES_INPUTFILE
data/managed_data_files/shapefiles/SEGMENTS_INPUTFILE
```

### Where to get this data
1. **CountGeometries**: \
This is the result of the data preparation in the data model [repository](https://github.com/imec-int/cityflows-model). Where first the data scraping/collecting needs to be done then the projecting to the correct format. Lastly all the different datasources need to be merged using `src/tooling/merge/main.py`. If the resulting file is large (most often because of a large area of interest) then it's recommended to do an additional step: run the `tools/all_shapes.py` script. This extra step will reduce the file to the unique geometries which is sufficient for the roadcutter procedure (**NOT** for the data model!).
1. **segments**: \
This is an extract from the flemish roadregister. To get this you first need to download it: [here](https://download.vlaanderen.be/catalogus) (look for wegenregister) and then run the notebook `notebooks/extract_wegenregister.ipynb`. This results in an useable formatted inputfile.

## Insert the segments and counts geometries

Execute
```
node src/index.js
```

> Note that this will drop and recreate the road_cutter schema and all the temporary tables at every execution. 


## Visualize the results

QGIS is a nice visualization software for spatial data. It can be used easily to configure a connection to the PostGIS database and visualize any geometry from the work tables or event the outputs of the whole cutting procedure.

## Troubleshouting
Previous issues:
- wrong formatting of input data:
  - polygons (all_ref data): 
    - some geometries are multipolygons. This will throw
    - check naming of column 'index', 'gridIndex' or 'grid_index'. This may vary.
    - ID's are sometimes not unique. Currently they are overwritten by the loop index.

Make sure in postgis that the polygons table has id's and indexes. If this is `null`, the query will fail down the road.
Make sure you are checking the correct database ;)

# Connected repositories in the Cityflows ecosystem
- the data model: [repository](https://github.com/imec-int/cityflows-model)
- weighted distribution: [repository](https://github.com/imec-int/cityflows-ml-weights)