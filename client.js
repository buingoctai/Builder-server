// Establish a WebSocket connection to the echo server
const WebSocket = require("ws");
const socket = new WebSocket("ws://localhost:8080", ["json", "xml"]);

// Fire open event khi chuyển từ trạng thái connecting sang open
socket.addEventListener("open", () => {
  const data = { buildVersion: 1.0, buildType: 69, buildPlatform: "win" };
  // const data = null;
  const json = JSON.stringify(data);

  socket.send(json);
});
// Fire message event khi có message đến
socket.addEventListener("message", (event) => {
  console.log("event.data", event.data);
  const data = JSON.parse(event.data);
  console.log(data);
  socket.close();
});
// Fire error event khi connect đến websocket bị lỗi
socket.addEventListener("error", (event) => {
  console.log("connect to websocket server error");
});
// Fire close event khi call close() function hoặc gọi sau khi có error event
socket.addEventListener("close", (event) => {
  console.log("close ket noi");
});
