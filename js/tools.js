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

function getMainComponent2() {
  const mainNode = "AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA";
  const checked = {};
  const checkList = [];
  const mainComponent = [];
  checkList.push(mainNode);
  while (checkList.length > 0) {
    const v = checkList.shift();
    if (!checked[v]) {
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
  const mainComponent = new Set(getMainComponent2());
  $.getJSON("/test/filtered_ids.json", function (result) {
    const filtered_ids = new Set(result);
    mainComponent.forEach(v => {
      if (filtered_ids.has(v)) {
        mainComponent.delete(v);
      }
    });
    Graph.nodeColor(n => mainComponent.has(n.id) ? "blue" : "red");
    Graph.nodeVal(15);
    console.log(`Num verifieds: ${mainComponent.size}`);
    // Graph.linkVisibility(l => true).linkDirectionalArrowLength(2).linkWidth(.1).nodeVal(15);
  });
}
