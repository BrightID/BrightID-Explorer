import {
  forceSimulation,
  forceManyBody,
  forceX,
  forceY,
  forceLink,
  forceCenter,
} from "d3-force";
import fs from "fs";
import data from "./brightid.json";

const TICKS = 50;
const ITERATIONS = 100;

const nodes = [];
const links = [];

const init = () => {
  const allLinks = {};
  const nodesSet = new Set();
  data.links.forEach((l) => {
    allLinks[`${l.source}${l.target}`] = l;
  });
  const selectedLevels = ["already known", "recovery"];
  Object.values(allLinks).forEach((l) => {
    const timestamp = l["history"][l["history"].length - 1][0];
    const level = l["history"][l["history"].length - 1][1];
    if (!selectedLevels.includes(level)) {
      return;
    }
    const s = l.source;
    const t = l.target;
    const otherSideLevel =
      allLinks[`${t}${s}`]?.history[
        allLinks[`${t}${s}`]["history"].length - 1
      ][1];
    if (!selectedLevels.includes(otherSideLevel)) {
      return;
    }
    links.push(l);
    nodesSet.add(s);
    nodesSet.add(t);
  });
  Array.from(nodesSet).forEach((n) => {
    nodes.push({ id: n });
  });
};

const run = () => {
  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink(links).id((d) => d.id)
    )
    .force("charge", forceManyBody())
    .force("center", forceCenter())
    .stop()
    .tick(TICKS);
};

const main = () => {
  init();
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`iteration ${i + 1}/${ITERATIONS}`);
    run();
  }
  const positions = {};
  nodes.forEach((n) => {
    positions[n.id] = { x: n.x, y: n.y };
  });
  fs.writeFile("positions2d.json", JSON.stringify(positions), () => {});
};

main();
