const http = require("http");
const fs = require("fs");
const { exec } = require("child_process");

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const bodyObj = JSON.parse(body);
      if (req.url === "/deploy") {
        const { container, domain } = bodyObj;
        const fileName = `/etc/nginx/conf.d/${domain}.conf`;
        const contents = `server {
          listen 80;
          server_name ${domain};
          location / {
              proxy_pass http://${container}:${port};
              proxy_set_header Host $host;
              proxy_set_header X-Real-IP $remote_addr;               
              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          }
        }`;
        fs.writeFile(fileName, contents, (err) => {
          if (err) throw err;
          console.log("File created successfully.");
          exec("systemctl restart nginx", (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`);
              return;
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
            }
            console.log(`stdout: ${stdout}`);
          });
          res.writeHead(200, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ message: `File created successfully for ${container} at ${domain}.` }));
        });
      } else if (req.url === "/undeploy") {
        const { domain } = bodyObj;
        const fileName = `/etc/nginx/conf.d/${domain}.conf`;
        fs.unlink(fileName, (err) => {
          if (err) throw err;
          console.log(`${fileName} deleted successfully.`);
          exec("systemctl restart nginx", (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`);
              return;
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
            }
            console.log(`stdout: ${stdout}`);
          });
          res.writeHead(200, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ message: `Deleted file for ${domain} successfully.` }));
        });
      }
    });
  } else {
    res.writeHead(404, {
      "Content-Type": "text/html",
    });
    res.end("404 Not found!");
  }
});

server.listen(process.env.PORT, () => {
  console.log("Server started listening on port" + process.env.PORT);
});
