function getMainComponent() {
  const mainNode = "AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA";
  const checked = {};
  const graphData = Graph.graphData();
  const links = graphData.links;
  const numLinks = graphData.links.length;
  const checkList = [];
  const mainComponent = [];
  checkList.push(mainNode);
  while (checkList.length > 0) {
    const v = checkList.shift();
    if (!checked[v]) {
      mainComponent.push(v);
      checked[v] = true;
      for (const link of links) {
        const level = link["history"][link["history"].length - 1][1];
        if (link.source.id === v && !checked[link.target.id] && ["already known", "recovery"].includes(level)) {
          checkList.push(link.target.id);
        }
      }
    }
  }
  console.log(`Main Component length: ${mainComponent.length}`);
  // console.log("Main Component: ", mainComponent)
  return mainComponent;
}

function getMainComponent2(filteredIds) {
  filteredIds = filteredIds || new Set();
  const mainNode = "AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA";
  const checked = {};
  const checkList = [];
  const mainComponent = [];
  checkList.push(mainNode);
  while (checkList.length > 0) {
    const v = checkList.shift();
    if (!checked[v] && !filteredIds.has(v)) {
      mainComponent.push(v);
      checked[v] = true;
      for (const neighbor of Object.keys(allNodes[v].neighbors)) {
        const outConns = allNodes[v].neighbors[neighbor]["to"];
        const inConns = allNodes[v].neighbors[neighbor]["from"];
        const tLevel = outConns.length > 0 ? outConns[outConns.length - 1][1] : null;
        const fLevel = inConns.length > 0 ? inConns[inConns.length - 1][1] : null;
        if (["already known", "recovery"].includes(tLevel) && ["already known", "recovery"].includes(fLevel)) {
          checkList.push(neighbor);
        }
      }
    }
  }
  console.log(`Main Component length: ${mainComponent.length}`);
  // console.log("Main Component: ", mainComponent)
  return mainComponent;
}

function verify() {
  const directPenalty = 5;
  const indirectPenalty = 2;
  updateGraphData(0);
  setPosition("2d");
  drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, 0, false, false);
  $.getJSON("/filtered_ids.json", function (result) {
    const filteredIds = new Set(result);
    const mainComponent = new Set(getMainComponent2(filteredIds));

    scores = {}
    mainComponent.forEach(v => scores[v] = {"linksNum": 0, "score": 0, "directReport": 0, "negativeScores": {}});
    Graph.graphData().links.forEach(l => {
      const s = l.source.id;
      const t = l.target.id;
      if (!mainComponent.has(s)) {
        return;
      }

      const level = l.history[l.history.length - 1][1];
      if (!["already known", "recovery"].includes(level)) {
        return;
      }
      const ol = allLinks[`${t}${s}`];
      const otherSideLevel = ol?.history[ol.history.length - 1][1];
      if (["already known", "recovery"].includes(otherSideLevel)) {
        scores[s]["linksNum"] += 1;
        scores[s]["score"] += 1;
      } else if (["suspicious", "reported"].includes(otherSideLevel)) {
        scores[s]["directReport"] += 1;
        scores[s]["score"] -= directPenalty;
        scores[s]["negativeScores"][t] = -directPenalty;
      }
    });

    Graph.graphData().links.forEach(l => {
      const s = l.source.id;
      const t = l.target.id;
      if (!mainComponent.has(s) || !mainComponent.has(t)) {
        return;
      }

      const level = l["history"][l["history"].length - 1][1];
      if (!["already known", "recovery"].includes(level)) {
        return;
      }

      if (scores[t]["directReport"] > 0) {
        if (t in scores[s]["negativeScores"]) {
          scores[s]["negativeScores"][t] -= scores[t]["directReport"] * indirectPenalty;
        } else {
          scores[s]["negativeScores"][t] = -scores[t]["directReport"] * indirectPenalty;
        }
      }
    });

    Graph
      .linkVisibility(l => mainComponent.has(l.source.id) && mainComponent.has(l.target.id) && ["already known", "recovery"].includes(l.history[l.history.length - 1][1]))
      .nodeVal(n => Math.max(3*(scores[n.id]?.score || 1), 20)**.5)
      .nodeColor(n => scores[n.id]?.score || 0 > 0 ? "blue" : "red")
      .linkDirectionalArrowLength(2)
      .linkWidth(.1);
    console.log(Object.keys(scores).map(user => {
      return {
        name: 'markaz',
        user,
        ...scores[user]
      }
    }));
  });
}
