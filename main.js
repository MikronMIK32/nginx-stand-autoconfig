const Docker = require("dockerode");
const DockerCompose = require("dockerode-compose");
const fs = require("fs/promises");
const path = require("path");
const http = require("http");

const HOST_SUFFIX = process.env.HOST_SUFFIX;
const CONF_D_PATH = "/etc/nginx/conf.d";

const NGINX_COMPOSE_PATH = "/var/nginx/docker-compose.yml";

class Template {
  constructor(text) {
    this.text = text;
    this.regex = /{{\s*([a-z_\-]+)\s*}}/gim;
  }

  static async loadFromFile(path) {
    const content = await fs.readFile(path, { encoding: "utf8" });
    return new Template(content);
  }

  substitute(map) {
    const replacer = (_, p1) => {
      const result = map.get(p1);

      if (!result) throw new Error("No substitution for " + p1);

      return result;
    };

    const result = this.text.replace(this.regex, replacer);

    return (
      `# Warning: this file is auto generated by nginx-stand-autoconfig. 
      # Please do not modify it, as you might lose your edits.\n` + result
    );
  }

  listVariables() {
    const matches = this.text
      .match(this.regex)
      .map((match) => match.replace(/{{\s*|\s*}}/g, ""));

    return [...new Set(matches).values()];
  }
}

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const nginxCompose = new DockerCompose(docker, NGINX_COMPOSE_PATH, "nginx");

async function findImagesByName(name) {
  return new Promise((resolve, reject) => {
    docker.listImages(function (err, images) {
      if (err) {
        reject(err);
        return;
      }
      const matchingImages = images.filter(function (image) {
        const tags = image.RepoTags || [];
        for (let tag of tags) {
          if (tag.startsWith(`${name}:`)) {
            return true;
          }
        }
        return false;
      });

      resolve(matchingImages);
    });
  });
}

// // Inputs
// const appName = "configurator";
// const branch = "test";
async function process({ appName, branch }) {
  const template = await Template.loadFromFile("./template.conf");

  if (branch === "master" || branch === "main") {
    throw new Error(
      "This autoconfig is not supposed to be used on production containers. Please deploy production builds manually for security and compatibility reasons."
    );
  }

  const images = findImagesByName(appName);

  console.log("found app", appName, "images:", images);
  // TODO: create and run container based on this image

  const hostName = `${appName}-${branch}.${HOST_SUFFIX}`;

  const map = new Map();
  map.set("containerName", `${appName}-${branch}`);

  // TODO: get from images
  map.set("containerPort", "3000");
  map.set("hostName", hostName);
  map.set(
    "extraRoutes",
    `
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }`
  );

  const generated = template.substitute(map);

  console.log("generated!");
  console.log(generated);

  const outFile = path.join(CONF_D_PATH, "stands", hostName + ".conf");

  console.log("Writing stand config to:", outFile);

  await fs.writeFile(outFile, generated, { encoding: "utf-8" });

  await nginxCompose.down();
  await nginxCompose.up();

  return {
    message: "ok",
  };
}

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const bodyObj = JSON.parse(body);

      if (req.url === "/deploy") {
        process({
          appName: bodyObj.appName,
          branch: bodyObj.branch,
        })
          .then((res) => {
            res.writeHead(200, {
              "Content-Type": "application/json",
            });
            res.end(JSON.stringify(res));
          })
          .catch((err) => {
            res.writeHead(500, {
              "Content-Type": "application/json",
            });
            res.end(JSON.stringify({ error: err }));
          });
      } else if (req.url === "/undeploy") {
        const { appName, branch } = bodyObj;

        // TODO: undeploy

        res.writeHead(200, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            message: `TODO: Deleted file for ${appName}-${branch} successfully.`,
          })
        );
      }
    });
  } else {
    res.writeHead(404, {
      "Content-Type": "text/html",
    });
    res.end("404 Not found!");
  }
});

const port = process.env.PORT;

server.listen(port, () => {
  console.log("Server started listening on port", port);
});
