"use strict";

process.on("uncaughtException", function (err) {
  console.error(err.stack);
  /*eslint-disable no-process-exit */
  process.exit(1);
  /*eslint-enable no-process-exit */
});

exports.run = function run() {
  require("./server").run();
};
