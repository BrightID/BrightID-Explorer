import json
import community
import networkx as nx
from collections import Counter
from networkx.algorithms.flow import build_residual_network
from networkx.algorithms.connectivity import minimum_st_node_cut
from networkx.algorithms.connectivity import build_auxiliary_node_connectivity
from utils import load_graph
import config

nodes = subg = H = R = None


def clusterify(graph, resolution, regions=None):
    print(f'graph: {graph}, resolution: {resolution}')
    global nodes
    clusters = community.best_partition(
        graph, resolution=resolution, randomize=False)
    for n, cluster in clusters.items():
        nodes[n]['cluster'] = nodes[n]['cluster'] + (int(cluster) + 1,)
    for region in regions or {}:
        members_clusters = [nodes[member]['cluster']
                            for member in regions[region]['members']]
        most_common = max(set(members_clusters), key=members_clusters.count)
        if len(most_common) > 0 and most_common[-1] in regions and regions[region]['priority'] > regions[most_common[-1]]['priority']:
            continue
        for n in nodes:
            if nodes[n]['cluster'] == most_common:
                nodes[n]['cluster'] = nodes[n]['cluster'][:-1] + (region,)


def remove_attacks_from(graph, cluster, region):
    global nodes, subg, H, R
    print(f'remove attacks from cluster {cluster}')
    # if cluster != ('core-team',): return
    keys = [n for n in nodes if nodes[n]['cluster'] == cluster]

    # clusterify the region to find attack patterns in each cluster
    subg = graph.subgraph(keys)
    H = build_auxiliary_node_connectivity(subg)
    R = build_residual_network(H, 'capacity')

    clusterify(subg, region.get('resolution', .5))
    clusters = set([nodes[n]['cluster']
                    for n in nodes if nodes[n]['cluster'][:-1] == cluster])
    for c in sorted(clusters, key=lambda c: c[-1]):
        print(c, len(clusters))
        remove_best_cut(graph, c, region)


def remove_best_cut(graph, cluster, region, filtered=None):
    global nodes, subg, H, R
    # uses filtered to ignore including nodes that split region members in the cut
    filtered = filtered or set([])
    keys = [n for n in nodes if nodes[n]['cluster']
            == cluster and subg.has_node(n)]
    keys.sort()

    # uses track to debug
    track = None
    # track = 'OwLKbjDcjyRqheYpJBBJCM-ZNiMt5G8Hh1NdhEzstlM'
    # if track in keys:
    #     print('cluster of {} has {} members.\n{}'.format(track, len(keys), '\n'.join(keys)))

    # consider first pre-defined member of the region as from for min-cut
    f = region['members'][0]
    cache = {}

    def min_cut(k):
        if k not in cache:
            cache[k] = minimum_st_node_cut(
                subg, f, k, auxiliary=H, residual=R) or (k,)
        return cache[k]

    # finds min-cuts from first predefined member of region, to sample set of cluster nodes
    all_cuts = []  # accumulates cuts for all samples
    for k in keys[:5]:
        # replaces min-cut of each node with next level cut for nodes in that min-cut and stops this when
        # - reaches nodes that are not inside the cluster
        # - reaches nodes that are filtered
        # - length of cut increases by 2 compared to the previous level
        # this helps to find a better and deeper cut for the node compared to the initial shallow cut
        history = [(k,)]
        while True:
            # finds min-cuts for cutting nodes that are still in the cluster
            visited = []
            cuts = [[n for n in min_cut(k) if n not in visited] if k in keys else (
                k,) for k in history[-1]]
            # concatenate cuts into single cut
            cut = set([k for cut in cuts for k in cut])
            # stops if length of cut increases by 2 compared to the previous level without accepting the new cut
            if len(history) > 1 and len(cut) > 6 and len(cut) - len(history[-1]) > 1:
                break
            # stops if a vicious circle detected without accepting the new cut
            if not cut or cut in history:
                break
            # stops if there is a node in the cut that is not acceptable without accepting the new cut
            if filtered.intersection(cut):
                break
            history.append(cut)
            # stops if all cutting nodes are outside of the cluster after accepting the new cut by adding it to the history
            if all([k not in keys for k in cut]):
                break

        # considers last accepted cut as the cut for the sample node
        if len(history) > 1:
            all_cuts.extend(history[-1])
        if track in keys:
            print(f'history: {history}, k: {k}')

    # sorts cutting nodes for all samples based on their frequency in being included
    # in cuts for different samples and consider the result and candidate cut for the cluster
    c = Counter(all_cuts)
    cut = sorted(c.keys(), key=lambda k: c[k], reverse=True)

    # counts how many nodes will be removed from the graph when each cutting node is cutted
    subg_copy = subg.copy()
    stats = []
    for k in cut:
        if not subg_copy.has_node(k):
            continue
        subg_copy.remove_node(k)
        # finds the component that includes all region pre-defiend members and ignores cut members
        component = next(filter(lambda l: all(n in l or n in cut for n in region['members']),
                                nx.connected_components(subg_copy)), None)
        # if cutting one of the cutting nodes break the region and put pre-defined members into
        # different components repeat the function by filtering that node to not be included in the cut
        if not component:
            filtered.add(k)
            return remove_best_cut(graph, cluster, region, filtered)
        # counts number of nodes that get removed by cutting the node
        stats.append((k, len(subg) - len(component)))
        # considers the main component as the graph for cutting the next node
        subg_copy = subg_copy.subgraph(component).copy()

    if track in keys:
        print(f'stats: {stats}')

    # finds slice of the cluster's candidate cut that removes maximum acceptable nodes compared to
    # the length of the cut slice
    for i in range(len(stats), 0, -1):
        if stats[i - 1][1] >= region.get('min_cut_multiplier', 10) * i ** region.get('min_cut_power', 1):
            break
    else:
        return
    cut = [stat[0] for stat in stats[:i]]

    # applies the final cut
    if track in keys:
        print(f'final cut: {cut}')
    subg = subg.copy()
    for k in cut:
        if subg.has_node(k):
            subg.remove_node(k)
    component = next(filter(lambda l: all(n in l or n in cut for n in region['members']),
                            nx.connected_components(subg)), None)
    assert component is not None
    subg = subg.subgraph(component).copy()

    # returns cutting nodes if they had neighbors to nodes that are not removed by removing them
    for k in cut:
        for n in graph.neighbors(k):
            if subg.has_node(n):
                subg.add_edge(n, k)
    H = build_auxiliary_node_connectivity(subg)
    R = build_residual_network(H, 'capacity')

    # removes removed nodes from main graph and nodes objects
    for n in list(nodes.keys()):
        if cluster[:-1] == nodes[n]['cluster'][:-1] and not subg.has_node(n):
            del nodes[n]
            graph.remove_node(n)
            print('removed', n, '|'.join(cut))


def run():
    global nodes
    print('\nFind bitu eligibles ...')
    # finds clusters based on regions in 2 levels
    graph = load_graph()
    nodes = {n: {'cluster': ()} for n in graph.nodes}
    with open(config.REGIONS_FILE) as f:
        regions = json.loads(f.read())
    clusterify(graph, regions['resolution'], regions['regions'])
    for region in regions['regions']:
        r = regions['regions'][region]
        if 'regions' in r:
            subg = graph.subgraph(
                [n for n in nodes if nodes[n]['cluster'] == (region,)])
            clusterify(subg, r['resolution'], r['regions'])

    # removes all clusters except pre-defined valid ones
    valid = []
    for region in regions['regions']:
        if 'regions' not in regions['regions'][region]:
            valid.append((region,))
        else:
            valid.extend([(region, sub)
                          for sub in regions['regions'][region]['regions']])

    for n in list(nodes.keys()):
        if nodes[n]['cluster'] not in valid:
            del nodes[n]
            graph.remove_node(n)

    # remove attack patterns based on min-cut from valid clusters
    for cluster in valid:
        r = regions['regions'][cluster[0]]
        if len(cluster) == 2:
            r = r['regions'][cluster[1]]
        remove_attacks_from(graph, cluster, r)

    # print number of nodes for each cluster
    stats = {}
    for n in nodes:
        c = nodes[n]['cluster'][:-1]
        if c not in stats:
            stats[c] = 0
        stats[c] += 1
    print('*********** stats ***********')
    for cluster in stats:
        print(cluster, stats[cluster])

    # change cluster from multi-level tupple to a single string
    for n in nodes:
        nodes[n]['cluster'] = '_'.join(map(str, nodes[n]['cluster']))

    with open(config.BITU_ELIGIBLES_FILE, 'w') as f:
        f.write(json.dumps({n: nodes[n]['cluster'] for n in nodes}))


if __name__ == '__main__':
    run()
