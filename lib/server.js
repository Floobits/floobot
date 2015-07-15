"use strict";

const util = require("util");

const _ = require("lodash");
const express = require("express");
const fleece = require("fleece");
const irc = require("irc");
const log = require("floorine");

const settings = require("./settings");


const Server = function () {
  const self = this;

  self.app = express(log);
  self.app.use(express.bodyParser());
  self.app.use(express.basicAuth(self.auth.bind(self)));
  self.app.post("/deploy/:project/:env", self.handle_deploy.bind(self));

  settings.irc.options.channels = _.keys(settings.channels);

  self.irc_client = new irc.Client(settings.irc.server, settings.irc.nick, settings.irc.options);
  self.irc_client.on("message", self.on_msg.bind(self));
  self.irc_client.on("error", function (msg) {
    log.error("IRC error:", msg);
  });
};

Server.prototype.auth = function (user, pass) {
  return settings.users[user] && settings.users[user] === pass;
};

Server.prototype.handle_deploy = function (req, res) {
  const self = this;

  if (!req.body) {
    log.error("No request body");
    return;
  }

  const msg = util.format("%s deployed %s to %s", req.user, req.params.project, req.params.env);

  _.each(self.irc_client.chans, function (channel) {
    const chan = settings.channels[channel.key];
    if (chan && _.contains(chan.announcements, "deploys")) {
      log.debug("Saying %s: %s", channel.key, msg);
      self.irc_client.say(channel.key, msg);
    }
  });

  res.send(204);
};

Server.prototype.listen = function (cb) {
  const self = this;

  log.log("Listening on port %s", settings.http_port);
  // TODO: https (need to async.parallel the app.listen()s)
  self.app.listen(settings.http_port, function (err, listen_result) {
    if (err) {
      return cb(err, listen_result);
    }

    log.log("Connecting to %s as %s", settings.irc.server, settings.irc.nick);
    self.irc_client.connect(3, function (connect_result) {
      log.log("IRC connect:", connect_result);
      // connect doesn't seem to send errors
      cb(null, connect_result);
    });
  });
};

Server.prototype.on_msg = function (from, to, msg) {
  const self = this;

  log.log("%s -> %s: %s", from, to, msg);
  if (from === self.nick || _.contains(settings.ignored_users, from)) {
    return;
  }

  if (to.slice(0, 1) !== "#") {
    // to = from;
    return;
  }

  const chan = settings.channels[to];
  if (!chan || !_.contains(chan.announcements, "urls")) {
    return;
  }

  const url_regex = new RegExp("(?:https?:\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{2,256}\\.[a-z]{2,4}(?::[0-9]{1-5})?\\b([-a-zA-Z0-9@:%_\\+.~#?&//=]*)", "gi");
  const urls = msg.match(url_regex);
  if (!urls) {
    return;
  }

  _.each(urls, function (msg_url) {
    fleece.describe_url(msg_url, function (err, result) {
      if (err || !result) {
        return;
      }
      let processed_title = "    \u001F" + result;
      self.irc_client.say(to, processed_title);
    });
  });
};

Server.prototype.stop = function (reason, cb) {
  const self = this;
  self.irc_client.disconnect(util.format("Shutting down: %s", reason), cb);
};

exports.run = function () {
  const server = new Server();

  log.set_log_level(settings.log_level);

  function shut_down(signal) {
    log.warn("Got %s. Shutting down...", signal);
    server.stop(util.format("Got %s.", signal), function () {
      log.log("All done.");
      /*eslint-disable no-process-exit */
      process.exit(0);
      /*eslint-enable no-process-exit */
    });
  }

  process.on("SIGTERM", function () {shut_down("SIGTERM"); });
  process.on("SIGINT", function () {shut_down("SIGINT"); });

  server.listen(function (err) {
    if (err) {
      log.error(err);
      /*eslint-disable no-process-exit */
      process.exit(1);
      /*eslint-enable no-process-exit */
    }
  });
};
