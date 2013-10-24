var express = require("express");
var irc = require("irc");
var log = require("floorine");
var settings = require("./settings");


var Server = function () {
  var self = this;

  self.irc_client = new irc.Client(settings.irc.server, settings.irc.nick, settings.irc.options);

  self.app = express(log);
  self.app.use(express.bodyParser());
  self.app.post("/deploy", self.handle_deploy);
};

Server.prototype.handle_deploy = function (req, res) {
  var self = this;
};

Server.prototype.listen = function (cb) {
  var self = this;

  log.log("Listening on port %s", settings.http_port)
  // TODO: https (need to async.parallel the app.listen()s)
  self.app.listen(settings.http_port, function (err, result) {
    log.log("Connecting to %s as %s", settings.irc.server, settings.irc.nick);
    self.irc_client.connect(3, function (err, result) {
      cb(err, result);
    });
  });
};

exports.run = function () {
  var server = new Server();

  server.listen(function (err, result) {
    if (err) {
      log.error(err);
      process.exit(1);
    }
  });
};
