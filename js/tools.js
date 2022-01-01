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
        checkList.push(neighbor);
      }
    }
  }
  console.log(`Main Component length: ${mainComponent.length}`);
  // console.log("Main Component: ", mainComponent)
  return mainComponent;
}

function bitu() {
  const directPenalty = 5;
  const indirectPenalty = 1;
  $.getJSON("/filtered_ids.json", function (result) {
    const filteredIds = new Set(result);
    const mainComponent = new Set(getMainComponent2(filteredIds));

    scores = {}
    mainComponent.forEach(v => scores[v] = {"linksNum": 0, "score": 0, "directReports": {}, "indirectReports": {}, "reportedConnections": {}});
    Object.values(allLinks).forEach(l => {
      const s = l.source?.id || l.source;
      const t = l.target?.id || l.target;
      if (!mainComponent.has(s) || !mainComponent.has(t)) {
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
        scores[s]["directReports"][t] = -directPenalty;
        scores[s]["score"] -= directPenalty;
      }
    });

    Object.values(allLinks).forEach(l => {
      const s = l.source?.id || l.source;
      const t = l.target?.id || l.target;
      if (!mainComponent.has(s) || !mainComponent.has(t)) {
        return;
      }

      const level = l["history"][l["history"].length - 1][1];
      if (!["already known", "recovery"].includes(level)) {
        return;
      }

      if (Object.keys(scores[t]["directReports"]).length > 0) {
        scores[s]["indirectReports"][t] = -indirectPenalty * Object.keys(scores[t]["directReports"]).length;
        scores[s]["reportedConnections"][t] = Object.keys(scores[t]["directReports"]);
        scores[s]["score"] -= indirectPenalty * Object.keys(scores[t]["directReports"]).length;
      }
    });

    // visualizing result
    updateGraphData(0);
    setPosition("2d");
    drawGraph2d({ nodes: Object.values(allNodes), links: Object.values(allLinks) }, 0, false, false);
    Graph
      .linkVisibility(l => mainComponent.has(l.source.id) && mainComponent.has(l.target.id) && ["already known", "recovery"].includes(l.history[l.history.length - 1][1]))
      .nodeVal(n => Math.min(Math.max(3*scores[n.id]?.score || 1, 3), 20)**.5)
      .nodeColor(n => scores[n.id]?.score || 0 > 0 ? "blue" : "red")
      .linkDirectionalArrowLength(2)
      .linkWidth(.1);
    console.log(Object.keys(scores).map(user => {
      return {
        name: 'Bitu',
        user,
        ...scores[user]
      }
    }));
  });
}
