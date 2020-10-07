const http = require("http");

const {
  parseMessage,
  constructReply,
  generateAcceptValue,
  runBuild,
} = require("./utils/utils");
const { PORT } = require("./utils/constants");

const server = http.createServer();
server.on("upgrade", (req, socket) => {
  if (req.headers["upgrade"] !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request");
  }
  // Create header response
  const acceptKey = req.headers["sec-websocket-key"];
  const hash = generateAcceptValue(acceptKey);
  const responseHeaders = [
    "HTTP/1.1 101 Web Socket Protocol HandShake",
    "Upgrade:WebSocket",
    "Connection:Upgrade",
    `Sec-WebSocket-Accept:${hash}`,
  ];
  // Check exchanged data format
  const protocol = req.headers["sec-websocket-protocol"];
  const protocols = !protocol ? [] : protocol.split(",").map((s) => s.trim());
  if (protocols.includes("json")) {
    responseHeaders.push("Sec-WebSocket-Protocol:json");
  }
  socket.write(responseHeaders.join("\r\n") + "\r\n\r\n");
  // Listen incoming message from client
  socket.on("data", (buffer) => {
    const message = parseMessage(buffer);

    if (message) {
      runBuild(message)
        .then((data) => {
          socket.write(
            constructReply({ message: data.toString("utf8").trim() })
          );
        })
        .catch((error) => {
          socket.write(
            constructReply({
              error: true,
              message: error.toString("utf8").trim(),
            })
          );
        });
    } else if (message === null) {
      // When client side close connect, null message was auto sended to server
      console.log("websocket connection close by the client");
    }
  });
});

server.listen(PORT, () => console.log(`server is listening at ${PORT}`));
