import pandas as pd
import geopandas as gpd
import argparse
from shapely import wkt

def filter_shapes(folder,stations_file_path):
    # reading the all_data.csv file
    all_data = pd.read_csv(f'{folder}/all_data.csv',index_col=0,dtype={'timestamp':str, 'data_source': str, 'index': str, 'modality':str, 'count':float, 'locationrange':str, 'speed':float, 
    'measurement_type':str, 'refRoadSegment': pd.Int64Dtype()})
    # filtering for the unique locationranges
    all_shapes = all_data.drop_duplicates(['locationrange','index']).reset_index(drop=True)
    all_shapes['locationrange'] = all_shapes.apply(lambda x: wkt.loads(x.locationrange),axis=1)
    all_shapes_geo = gpd.GeoDataFrame(all_shapes,geometry='locationrange')

    # looking for the multipolygons, because if Voronoi cells are used with a non-convex border it is possible that the cell is split and one gets multipolygons.
    # In such a situation we only keep the part of the cell where the station (counting device) is.
    multi_shapes = all_shapes_geo[all_shapes_geo['locationrange'].apply(lambda x: x.geom_type)== 'MultiPolygon']

    stations = pd.read_csv(stations_file_path)
    stations['geometry'] = stations.apply(lambda x: wkt.loads(x.geometry),axis=1)
    stations_geo = gpd.GeoDataFrame(stations,geometry='geometry')

    for tup in multi_shapes.itertuples():
        multi = multi_shapes[multi_shapes.index==tup.Index].explode('locationrange')
        poly = gpd.sjoin(stations_geo, multi, op='within',how='inner')
        if len(poly.index)==1:
            index_0 = poly['index_right0'].to_list()[0]
            index_1 = poly['index_right1'].to_list()[0]
            locationrange = multi.loc[(index_0,index_1),'locationrange']
            all_shapes.loc[index_0,'locationrange'] = locationrange
        else:
            raise Exception('no or multiple stations in 1 MultiPolygon region')

    all_shapes.to_csv(f'{folder}/all_shapes.csv')
    return

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        prog='python -m src.tools.all_shapes',
        description='Retrieve the unique locationranges from an all_data.csv file in the folder.'
    )
    parser.add_argument('--folder', help='Input/output folder', required=True)
    parser.add_argument('--stations_file_path', help='location of stations.csv file', required=True)
    args = vars(parser.parse_args())


    filter_shapes(args['folder'],args['stations_file_path'])
    