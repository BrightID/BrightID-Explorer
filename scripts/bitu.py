import os
import json
import zipfile
import tarfile
import requests
import networkx as nx
from google.cloud import storage

BACKUP_URL = "https://storage.googleapis.com/brightid-backups/brightid.tar.gz"
BITU_VERIFIEDS_FILE = "https://explorer.brightid.org/history/bitu_verified.json"
FILTERED_IDS_FILE = "https://explorer.brightid.org/filtered_ids.json"
FILTER_FILES_DIR = "./suspicious_conns"
DIRECT_PENALTY = 5
INDIRECT_PENALTY = 1

dir_path = os.path.dirname(os.path.realpath(__file__))
BUCKET_NAME = "brightid-explorer"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    dir_path, "google.json")
client = storage.Client()
bucket = client.get_bucket(BUCKET_NAME)


def upload(fpath):
    fname = os.path.basename(fpath)
    blob = bucket.blob(fname)
    with open(fpath, "rb") as f:
        blob.upload_from_file(f)
    return blob


def get_main_component():
    rar_addr = "/tmp/brightid.tar.gz"
    zip_addr = "/tmp/brightid.zip"
    backup = requests.get(BACKUP_URL)
    with open(rar_addr, "wb") as f:
        f.write(backup.content)
    tar_to_zip(rar_addr, zip_addr)
    users = records(zip_addr, "users")
    connections = records(zip_addr, "connections")
    suspicious_conns = read_filtered_conns()
    for c in connections:
        if connections[c]["level"] in ['recovery', 'already known']:
            if (connections[c]["_from"], connections[c]["_to"]) in suspicious_conns:
                connections[c]["level"] = "filtered"
    graph = nx.DiGraph()
    graph.add_nodes_from(users.keys())
    graph.add_edges_from([(c["_from"].replace("users/", ""), c["_to"].replace(
        "users/", ""), {"level": c["level"]}) for c in connections.values()])
    main_node = "AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"
    checked = {}
    check_list = []
    main_component = []
    check_list.append(main_node)
    f = requests.get(FILTERED_IDS_FILE)
    filtered_ids = set(json.loads(f.content))
    while len(check_list) > 0:
        v = check_list.pop()
        if v not in checked and v not in filtered_ids:
            main_component.append(v)
            checked[v] = True
            allNeighbors = set(list(graph.neighbors(v)) +
                               list(graph.predecessors(v)))
            for neighbor in allNeighbors:
                c1 = graph.edges.get([v, neighbor], {}).get("level") in ["already known", "recovery"]
                c2 = graph.edges.get([neighbor, v], {}).get("level") in ["already known", "recovery"]
                if c1 and c2:
                    check_list.append(neighbor)
    for node in list(graph):
        if node not in main_component or node in filtered_ids:
            graph.remove_node(node)
    return graph


def read_filtered_conns():
    suspicious_conns = {}
    if not os.path.exists(FILTER_FILES_DIR):
        os.makedirs(FILTER_FILES_DIR)
    files = os.listdir(FILTER_FILES_DIR)
    for file in files:
        with open(os.path.join(FILTER_FILES_DIR, file), "r") as f:
            for l in json.loads(f.read()):
                suspicious_conns[tuple(l)] = True
    return suspicious_conns


def records(f, table):
    zf = zipfile.ZipFile(f)
    fnames = zf.namelist()
    fname = list(filter(lambda fn: fn.endswith(".data.json")
                        and fn.count("/{}_".format(table)) > 0, fnames))[0]
    content = zf.open(fname).read().decode("utf-8")
    ol = [json.loads(line) for line in content.split("\n") if line.strip()]
    d = {}
    for o in ol:
        if o["type"] == 2300:
            d[o["data"]["_key"]] = o["data"]
        elif o["type"] == 2302 and o["data"]["_key"] in d:
            del d[o["data"]["_key"]]
    return dict((d[k]["_id"].replace(table + "/", ""), d[k]) for k in d)


def tar_to_zip(fin, fout):
    if os.path.exists(fout):
        os.remove(fout)
    tarf = tarfile.open(fin, mode="r|gz")
    zipf = zipfile.ZipFile(fout, mode="a", compression=zipfile.ZIP_DEFLATED)
    for m in tarf:
        f = tarf.extractfile(m)
        if f:
            zipf.writestr(m.name, f.read())
    tarf.close()
    zipf.close()


def bitu():
    f = requests.get(BITU_VERIFIEDS_FILE)
    eligibles = {v["user"]: v for v in json.loads(f.content)}
    main_component = get_main_component()
    scores = {v: {"name": "Bitu", "user": v, "linksNum": 0, "score": 0, "tempScore": 0, "directReports": {
    }, "indirectReports": {}, "reportedConnections": {}} for v in main_component.nodes}
    for l in main_component.edges:
        level = main_component.edges[l]["level"]
        if level not in ["already known", "recovery"]:
            continue

        otherSideLevel = main_component.edges.get(
            (l[1], l[0]), {}).get("level")
        if otherSideLevel in ["already known", "recovery"]:
            scores[l[0]]["linksNum"] += 1
            scores[l[0]]["tempScore"] += 1
        elif otherSideLevel in ["suspicious", "reported"]:
            scores[l[0]]["directReports"][l[1]] = -DIRECT_PENALTY
            scores[l[0]]["tempScore"] -= DIRECT_PENALTY

    for l in main_component.edges:
        level = main_component.edges[l]["level"]
        if level not in ["already known", "recovery"]:
            continue
        if len(scores[l[1]]["directReports"]) > 0:
            scores[l[0]]["indirectReports"][l[1]] = - \
                INDIRECT_PENALTY * len(scores[l[1]]["directReports"])
            scores[l[0]]["reportedConnections"][l[1]] = list(
                scores[l[1]]["directReports"].keys())
            scores[l[0]]["tempScore"] -= INDIRECT_PENALTY * \
                len(scores[l[1]]["directReports"])
    for node in scores:
        if node in eligibles:
            eligibles[node]["tempScore"] = scores[node]["tempScore"]
        elif node not in eligibles and scores[node]["tempScore"] > 0:
            eligibles[node] = scores[node]
    for node in eligibles:
        if node not in scores:
            eligibles[node]["tempScore"] = 0

    res = json.dumps(list(eligibles.values()))
    with open("bitu.json", "w") as f:
        f.write(res)


def main():
    bitu()
    print("Uploading bitu.json")
    upload("./bitu.json")


if __name__ == "__main__":
    main()
