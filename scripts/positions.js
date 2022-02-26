import {
  forceSimulation,
  forceManyBody,
  forceX,
  forceY,
  forceLink,
  forceCenter,
} from "d3-force";
import fs from "fs";
import zlib from "zlib";

const TICKS = 50;
const ITERATIONS = 10;

const nodes = [];
const links = [];

const readGzJson = async (fname) => {
  return new Promise(function (resolve, reject) {
    let d = "";
    fs.createReadStream(fname)
      .pipe(zlib.createGunzip())
      .on("data", function (data) {
        // console.log(1, data.toString());
        d += data.toString();
      })
      .on("error", reject)
      .on("end", function () {
        resolve(JSON.parse(d));
      });
  });
};

const writeGzJson = async (data, fname) => {
  return new Promise(function (resolve, reject) {
    const gz = zlib.createGzip();
    gz.pipe(fs.createWriteStream(fname));
    gz.on("error", reject);
    gz.on("finish", resolve);
    gz.write(JSON.stringify(data));
    gz.end();
  });
};

const init = async () => {
  const data = await readGzJson("../brightid.json.gz");
  const currentPos = await readGzJson("../positions2d-released.json.gz");
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
    nodes.push({
      id: n,
      x: currentPos[n] ? currentPos[n].x : 0,
      y: currentPos[n] ? currentPos[n].y : 0,
    });
    if (!currentPos[n]) {
      console.log("new node", n);
    }
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

const main = async () => {
  await init();
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`iteration ${i + 1}/${ITERATIONS}`);
    run();
  }
  const positions = {};
  nodes.forEach((n) => {
    positions[n.id] = { x: n.x, y: n.y };
  });
  await writeGzJson(positions, "../positions2d.json.gz");
};

main();
