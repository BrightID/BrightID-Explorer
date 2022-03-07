import json
import gzip
import requests
import community
import networkx as nx
from arango import ArangoClient
import utils
import config

db = ArangoClient(hosts=config.ARANGO_SERVER_ENDPOINT).db(
    config.ARANGO_DB_NAME)
with gzip.open(config.POSITIONS2D_FILE, 'rb') as f:
    pos2d = json.loads(f.read())

zones = {
    'z0': {'center': (0, 0), 'r1': 400, 'r2': 3000, 'resolution': .3, 'verifieds': set(), 'nodes': set()},
    'z1': {'center': (0, 0), 'r1': 150, 'r2': 1500, 'resolution': .3, 'verifieds': set(), 'nodes': set()},
    'z2': {'center': (0, 0), 'r1': 3000, 'r2': 7000, 'resolution': .3, 'verifieds': set(), 'nodes': set()},
    'z3': {'center': (0, 0), 'r1': 1300, 'r2': 5000, 'resolution': .3, 'verifieds': set(), 'nodes': set()},
}


def center_of(cluster):
    sum_x = 0
    sum_y = 0
    for n in cluster:
        sum_x += pos2d[n]['x']
        sum_y += pos2d[n]['y']
    return (sum_x / len(cluster), sum_y / len(cluster))


def set_zones_center():
    with open(config.CENTER_NODES_FILE, 'r') as f:
        temp = json.loads(f.read())
    for zone in temp:
        zones[zone]['center'] = center_of(temp[zone])
    with open(config.CIRCLES_FILE, 'w') as f:
        f.write(json.dumps([[z['center'], z['r1'], z['r2']]
                            for z in zones.values()]))


def distance_of(n1, n2):
    return ((n1[0] - n2[0]) ** 2 + (n1[1] - n2[1]) ** 2) ** .5


def get_manual_verifieds():
    bitu_verifieds_file = requests.get(config.BITU_VERIFIEDS_FILE)
    bitu_verifieds = set()
    for d in json.loads(bitu_verifieds_file.content):
        if d['score'] != 0:
            bitu_verifieds.add(d['user'])
        elif d['score'] == 0 and d['linksNum'] != 0:
            bitu_verifieds.add(d['user'])
    return bitu_verifieds


def load_graph():
    suspicious_conns = utils.read_suspicious_conns()
    graph = nx.Graph()
    connections = {
        f"{c['_from'].replace('users/', '')}{c['_to'].replace('users/', '')}": c for c in db['connections']}
    for c in connections.values():
        if c['level'] not in ['recovery', 'already known']:
            continue
        f = c['_from'].replace('users/', '')
        t = c['_to'].replace('users/', '')
        if f'{f}{t}' in suspicious_conns:
            continue
        if f'{t}{f}' in suspicious_conns:
            continue
        if graph.has_edge(f, t) or graph.has_edge(t, f):
            continue
        if (connections.get(f'{t}{f}', {}).get('level') not in ['recovery', 'already known']):
            continue
        if f not in pos2d or t not in pos2d:
            weight = 1
        else:
            d = distance_of((pos2d[f]['x'], pos2d[f]['y']), (pos2d[t]['x'], pos2d[t]['y']))
            weight = max(1, 1000 / max(1, d))
        graph.add_edge(f, t, weight=weight)
    main_component = sorted([comp for comp in nx.connected_components(
        graph)], key=lambda l: len(l), reverse=True)[0]
    for node in list(graph):
        if node not in main_component:
            graph.remove_node(node)
    # print(
    #     f'main component\tnodes: {len(graph.nodes)}\tedges: {len(graph.edges)}')
    return graph


def zoning_graph(graph):
    for n in list(graph):
        if n not in pos2d:
            continue
        distances = {
            distance_of((pos2d[n]['x'], pos2d[n]['y']), zones[z]['center']): z for z in zones}
        zoned = False
        for d, z in distances.items():
            if d < zones[z]['r1']:
                zones[z]['verifieds'].add(n)
            if d < zones[z]['r2']:
                zones[z]['nodes'].add(n)
                zoned = True
        if not zoned:
            zone = distances[min(distances.keys())]
            zones[zone]['nodes'].add(n)


def clustering_zone(graph, zone):
    index = int(zone.replace('z', ''))
    for node in list(graph):
        if node not in zones[zone]['nodes']:
            graph.remove_node(node)
    clusters = community.best_partition(
        graph, resolution=zones[zone]['resolution'], randomize=False)
    clusters = {k: ((index + 1) * 1000) + v for k, v in clusters.items()}
    return clusters


def clustering_graph(graph):
    all_clusters = {n: [] for n in graph}
    cluster_members = {}
    for zone in zones:
        zone_clusters = clustering_zone(graph.copy(), zone)
        for n in zone_clusters:
            all_clusters[n].append(zone_clusters[n])
            if zone_clusters[n] not in cluster_members:
                cluster_members[zone_clusters[n]] = set()
            cluster_members[zone_clusters[n]].add(n)
    with open(config.CLUSTERS_FILE, 'w') as f:
        f.write(json.dumps(all_clusters))
    return cluster_members


def check_connectivity(graph, verifieds, cluster_members, cluster, zone):
    verified_neighbors = set()
    cluster_connectivity = 0
    cluster_members = cluster_members - verifieds
    zone = zones[zone]
    if len(cluster_members) == 0:
        return False
    cluster_center = center_of(cluster_members)
    distance = distance_of(cluster_center, zone['center'])
    multiplier = 2 * zone['r1'] / distance
    # print("######", zone['r1'], distance, multiplier, 7 * multiplier, 4 * multiplier)
    for node in cluster_members:
        temp = verifieds.intersection(set(graph.neighbors(node)))
        if temp:
            cluster_connectivity += len(temp)**.5
            verified_neighbors.update(temp)

    verified_connectivity = 0
    for n in verified_neighbors:
        verified_connectivity += len(
            verifieds.intersection(set(graph.neighbors(n))))**.5
    passed_cluster_connectivity = cluster_connectivity and len(cluster_members) / cluster_connectivity < 20 * multiplier
    passed_verified_connectivity = verified_connectivity and len(cluster_members) / verified_connectivity < 8 * multiplier
    return passed_cluster_connectivity and passed_verified_connectivity


def get_eligible_nodes(graph, cluster_members):
    manual_verifieds = get_manual_verifieds()
    eligibles = set()
    clusters_center = {c: center_of(
        cluster_members[c]) for c in cluster_members}
    for zone in zones:
        i = int(zone.replace('z', ''))
        temp = {k: v for k, v in clusters_center.items() if k // 1000 == i + 1}
        clusters_distance = {c: distance_of(
            zones[zone]['center'], temp[c]) for c in temp}
        clusters_distance = dict(
            sorted(clusters_distance.items(), key=lambda item: item[1]))
        zone_eligibles = zones[zone]['verifieds']
        verified_clusters = []
        while True:
            before = len(zone_eligibles)
            for cluster in clusters_distance:
                if cluster in verified_clusters:
                    continue
                if check_connectivity(graph, zone_eligibles, cluster_members[cluster], cluster, zone):
                    zone_eligibles.update(cluster_members[cluster])
                    verified_clusters.append(cluster)
            if len(zone_eligibles) == before:
                break
        p_verifieds = zones[zone]['nodes'].intersection(manual_verifieds)
        true_verifieds = len(zone_eligibles.intersection(
            p_verifieds)) * 100 / len(p_verifieds)
        false_verifieds = len(zone_eligibles - p_verifieds) * \
            100 / len(zone_eligibles)
        eligibles.update(zone_eligibles)

    true_verifieds = len(eligibles.intersection(
        manual_verifieds)) * 100 / len(manual_verifieds)
    false_verifieds = len(eligibles - manual_verifieds) * \
        100 / len(eligibles)
    print('all nodes:')
    print(f'manual verifieds: {len(manual_verifieds)}')
    print(f'auto verifieds: {len(eligibles)}')
    print(
        f'true verifieds: {len(eligibles.intersection(manual_verifieds))}\t{true_verifieds} %')
    print(
        f'false verifieds: {len(eligibles - manual_verifieds)}\t{false_verifieds} %')
    return eligibles


def main():
    print('\nRestoring database...')
    utils.restore_backup()
    print('\nClustering the graph...')
    set_zones_center()
    graph = load_graph()
    zoning_graph(graph)
    cluster_members = clustering_graph(graph.copy())
    eligibles = get_eligible_nodes(graph.copy(), cluster_members)
    with open(config.BITU_ELIGIBLES_FILE, 'w') as f:
        f.write(json.dumps(list(eligibles)))


if __name__ == '__main__':
    main()
