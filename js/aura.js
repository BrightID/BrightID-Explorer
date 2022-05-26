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
