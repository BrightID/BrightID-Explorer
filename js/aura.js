const ratingLinkColor = "orange";
const energyLinkColor = "blue";
const ratedNodeColor = "orange";
const energyTransferedNodeColor = "blue";

async function drawAura(fname) {
  const { energyTransfers, ratings, energy } = await $.ajax({
    url: `./${fname}.json`,
    cache: false,
  });
  updateAuraLegend();

  graphNodes = {};
  graphLinks = [];
  linksMap = {};

  ratings.forEach((r) => {
    allNodes[r.fromBrightId]["outgoingRatings"] =
      (allNodes[r.fromBrightId]["outgoingRatings"] || 0) + 1;
    allNodes[r.toBrightId]["incomingRatings"] =
      (allNodes[r.toBrightId]["incomingRatings"] || 0) + 1;
    allNodes[r.fromBrightId]["givenRatings"] =
      (allNodes[r.fromBrightId]["givenRatings"] || 0) + parseFloat(r.rating);
    allNodes[r.toBrightId]["rating"] =
      (allNodes[r.toBrightId]["rating"] || 0) + parseFloat(r.rating);

    linksMap[`${r.fromBrightId}:${r.toBrightId}`] = {
      source: r.fromBrightId,
      target: r.toBrightId,
      history: [[new Date(r.createdAt).getTime(), "already known"]],
      aColor: ratingLinkColor,
      width: 1,
      rating: parseFloat(r.rating),
    };

    graphNodes[r.fromBrightId] = {
      ...allNodes[r.fromBrightId],
      aColor: ratedNodeColor,
      val: 1,
    };

    graphNodes[r.toBrightId] = {
      ...allNodes[r.toBrightId],
      aColor: ratedNodeColor,
      val: 1,
    };
  });

  energyTransfers.forEach((et) => {
    if (et.amount == 0) {
      return;
    }
    linksMap[`${et.fromBrightId}:${et.toBrightId}`] = Object.assign(
      linksMap[`${et.fromBrightId}:${et.toBrightId}`],
      {
        aColor: energyLinkColor,
        width: ((et.amount - 1) * (5 - 2)) / (100 - 1) + 2,
        energy: et.amount,
      }
    );
  });

  const energies = [];
  energy.forEach((e) => {
    if (e.amount == 0) {
      return;
    }
    energies.push(e.amount);
  });
  const maxEnergies = Math.max(...energies);
  const minEnergies = Math.min(...energies);
  energy.forEach((e) => {
    if (e.amount == 0) {
      return;
    }
    graphNodes[e.brightId] = Object.assign(graphNodes[e.brightId], {
      aColor: energyTransferedNodeColor,
      val:
        ((e.amount - minEnergies) * (10 - 2)) / (maxEnergies - minEnergies) + 2,
      energy: e.amount,
    });
  });

  graphLinks = Object.values(linksMap);
  const data = { nodes: Object.values(graphNodes), links: graphLinks };
  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem);
  Graph.nodeColor((n) => n.aColor)
    .graphData(data)
    .nodeId("id")
    .nodeVal((n) => n.val)
    .nodeLabel(
      (n) =>
        `${allNodes[n.id]?.name || n.id}<br/>energy: ${
          n.energy || 0
        }<br/>outgoing ratings: ${
          n.outgoingRatings || 0
        }<br/>incoming ratings: ${n.incomingRatings || 0}`
    )
    .linkSource("source")
    .linkTarget("target")
    .linkLabel((link) => {
      const source = allNodes[link.source.id]?.name || link.source.id;
      const target = allNodes[link.target.id]?.name || link.target.id;
      const res = `${source} -> ${target} rank: ${link.rating || 0} energy: ${
        link.energy || 0
      }`;
      const rlink = linksMap[`${link.target.id}:${link.source.id}`];
      return rlink
        ? `${res}<br/>${target} -> ${source}  rank: ${
            rlink.rating || 0
          } energy: ${rlink.energy || 0}`
        : res;
    })
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true, false);
      }
      Graph.linkWidth((l) => l.width).linkVisibility(true);
    })
    .onBackgroundClick((evt) => {
      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.nodeColor((n) => n.aColor)
        .linkVisibility(true)
        .linkColor((l) => l.aColor)
        .linkDirectionalArrowLength(arrowLength);
    })
    .nodeCanvasObjectMode(() => "after")
    .nodeCanvasObject((n, ctx) => {
      let size = 7 * n.val ** 0.5;
      if (n.img) {
        ctx.lineWidth = 0;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = n.aColor;
        try {
          ctx.drawImage(n.img, n.x - size / 2, n.y - size / 2, size, size);
        } catch (err) {
          console.log("Error in drawImage: ", err);
        }
        // ctx.stroke();
        ctx.restore();
      }
    })
    .linkColor((l) => l.aColor)
    .linkWidth((l) => l.width)
    .linkVisibility(true)
    .linkDirectionalArrowLength(arrowLength)
    .cooldownTime(10000);
}

function updateAuraLegend(index) {
  $("#legendNodes").empty();
  $(
    `<li><a href="#" id="ratingNodes" onclick="drawAuraView('rating')" style="text-decoration: none; color: black;"><span style="background:${ratedNodeColor};"></span>rating</a></li>`
  ).appendTo("#legendNodes");
  $(
    `<li><a href="#" id="energyNodes" onclick="drawAuraView('energy')" style="text-decoration: none; color: black;"><span style="background:${energyTransferedNodeColor};"></span>energy transfer</a></li>`
  ).appendTo("#legendNodes");

  $("#legendLinks").empty();
  $(
    `<li><span style="background:${ratingLinkColor};"></span>rating</li>`
  ).appendTo("#legendLinks");
  $(
    `<li><span style="background:${energyLinkColor};"></span>energy transfer</li>`
  ).appendTo("#legendLinks");
}

const auraView = { rating: true, energy: true };
async function drawAuraView(type) {
  auraView[type] = !auraView[type];
  $("#ratingNodes").css("color", auraView.rating ? "black" : "#d49a9a");
  $("#energyNodes").css("color", auraView.energy ? "black" : "#d49a9a");

  Graph.nodeVisibility((n) =>
    auraView.energy && n.energy
      ? true
      : auraView.rating && n.rating
      ? true
      : false
  )
    .linkVisibility((l) =>
      auraView.energy && l.energy
        ? true
        : auraView.rating && l.rating
        ? true
        : false
    )
    .nodeLabel((n) => {
      let label = `${allNodes[n.id]?.name || n.id}`;
      if (auraView.energy && n.energy) label += `<br/>energy: ${n.energy || 0}`;
      if (auraView.rating && n.rating)
        label += `<br/>outgoing ratings: ${
          n.outgoingRatings || 0
        }<br/>incoming ratings: ${n.incomingRatings || 0}`;
      return label;
    })
    .linkLabel((l) => {
      const source = allNodes[l.source.id]?.name || l.source.id;
      const target = allNodes[l.target.id]?.name || l.target.id;
      let label = `${source} -> ${target}`;
      if (auraView.energy && l.energy) label += ` energy: ${l.energy || 0}`;
      if (auraView.rating && l.rating) label += ` rank: ${l.rating || 0}`;
      const rl = linksMap[`${l.target.id}:${l.source.id}`];
      if (rl) label += `<br/>${target} -> ${source}`;
      if (rl && auraView.energy && l.energy)
        label += ` energy: ${rl.energy || 0}`;
      if (rl && auraView.rating && l.rating)
        label += ` rank: ${rl.rating || 0}`;
      return label;
    })
    .nodeColor((n) => {
      if (auraView.rating && auraView.energy) return n.aColor;
      if (auraView.rating) return ratedNodeColor;
      if (auraView.energy) return energyTransferedNodeColor;
    })
    .linkColor((l) => {
      if (auraView.rating && auraView.energy) return l.aColor;
      if (auraView.rating) return ratingLinkColor;
      if (auraView.energy) return energyLinkColor;
    });
}
