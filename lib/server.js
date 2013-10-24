var util = require("util");

var express = require("express");
var irc = require("irc");
var log = require("floorine");
var _ = require("lodash");

var settings = require("./settings");


var Server = function () {
  var self = this;

  self.app = express(log);
  self.app.use(express.bodyParser());
  self.app.use(express.basicAuth(self.auth.bind(self)));
  self.app.post("/deploy/:project/:env", self.handle_deploy.bind(self));

  self.irc_client = new irc.Client(settings.irc.server, settings.irc.nick, settings.irc.options);
  self.irc_client.on("error", function (msg) {
    log.error("IRC error:", msg);
  });
};

Server.prototype.auth = function (user, pass) {
  var self = this;

  return settings.users[user] && settings.users[user] === pass;
};

Server.prototype.handle_deploy = function (req, res) {
  var self = this,
    msg;

  if (!req.body) {
    log.error("No request body");
    return;
  }

  msg = util.format("%s deployed %s to %s", req.user, req.params.project, req.params.env);

  _.each(self.irc_client.chans, function (channel) {
    log.debug("saying", channel.key, msg);
    self.irc_client.say(channel.key, msg);
  });

  res.send(204);
};

Server.prototype.listen = function (cb) {
  var self = this;

  log.log("Listening on port %s", settings.http_port);
  // TODO: https (need to async.parallel the app.listen()s)
  self.app.listen(settings.http_port, function (err, result) {
    if (err) {
      return cb(err, result);
    }

    log.log("Connecting to %s as %s", settings.irc.server, settings.irc.nick);
    self.irc_client.connect(3, function (result) {
      log.log("IRC connect:", result);
      // connect doesn't seem to send errors
      cb(null, result);
    });
  });
};

Server.prototype.stop = function (cb) {
  var self = this;

  self.irc_client.disconnect("Shutting down", cb);
};

exports.run = function () {
  var server = new Server();

  log.set_log_level(settings.log_level);

  function shut_down(signal) {
    log.warn("Got %s. Shutting down...", signal);
    server.stop(function () {
      log.log("All done.");
      process.exit(0);
    });
  }

  process.on("SIGTERM", function () {shut_down("SIGTERM"); });
  process.on("SIGINT", function () {shut_down("SIGINT"); });

  server.listen(function (err, result) {
    if (err) {
      log.error(err);
      process.exit(1);
    }
  });
};
