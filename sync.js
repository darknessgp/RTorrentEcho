var FTPS = require('./lftp.js');
var Rtorrent = require('./rtorrent.js');
var Torrent = require('./torrent.js');
var Unrar = require('./unrar.js');

if (!global.torrents) {
    global.torrents = [];
}

if (!global.isDownloading) {
    global.isDownloading = false;
}

function Sync(config) {
    self = this;

    self.doneLabel = config.doneLabel;
    self.doneLabelDelay = (config.doneLabelDelay || 0) * 1000;
    self.verboseLogging = config.verboseLogging || false;

    // Setup based on config
    self.rtorrent = new Rtorrent({
        mode: config.mode,
        host: config.host,
        port: config.port,
        path: config.path,
        user: config.user,
        pass: config.pass,
        isSecure: config.isSecure
    });

    var pgetCommand = "set mirror:use-pget-n " + config.pget + ";set pget:default-n " + config.pget;
    var tempCommand = "set xfer:use-temp-file true;set xfer:temp-file-name *.tmp";

    additionalCommands = pgetCommand;

    if (config.useTemp)
        additionalCommands += ";" + tempCommand;

    self.ftps = new FTPS({
        host: config.host,
        username: config.user,
        password: config.pass,
        protocol: 'sftp',
        autoConfirm: true,
        additionalLftpCommands: additionalCommands
    });

    self.unrar = new Unrar(config);
};

Sync.prototype.sync = function(label, location, doneLabel, callback) {

    WriteMessage("Getting Torrents");

    self.rtorrent.getTorrents(function(err, data) {
        if (err) return console.log('err: ', err);

        // filter down to torrents with the label and are complete
        var torrents = data.filter(function(obj) {
            return obj.label === label;
        });

        WriteMessage(torrents.length + " torrents with label " + label, callback);

        // Loop over each torrent and add commands to queue them
        torrents.forEach(function(item) {
            if (item.hash in global.torrents)
                WriteMessage(item.name + " already being handled by another call. Skipping", callback);
            else {
                // Set global tag to true, since we are going to try downloading it.
                global.torrents[item.hash] = new Torrent(item.complete == 1, item.ismultifile, item.name, item.path, location);

                // If the torrent isn't complete, check it
                if (!(item.complete == 1)) {
                    WriteMessage(item.name + " incomplete, waiting for torrent to complete", callback);
                    self.CheckTorrentComplete(item.hash);
                } else {
                    WriteMessage("Adding " + item.name + "to download", callback);
                }
            }
        });

        WriteMessage("Starting Download", callback, true);
        self.DownloadNext();
    });
}

Sync.prototype.ProcessDownload = function(torrentHash) {
    var item = global.torrents[torrentHash];
    global.isDownloading = true;

    // Check if we should even try downloading
    if (item.ShouldDownload) {
        if (item.IsDirectory == true) {
            var mirrorCommand = self.ftps.mirror(item.Path, item.DownloadLocation);
            WriteMessage("Wrote lftp command: " + mirrorCommand);
        } else { // Otherwise use pget
            var pgetCommand = self.ftps.pget(item.Path, item.DownloadLocation);
            WriteMessage("Wrote lftp command: " + pgetCommand);
        }

        // Mark torrent as should not download, since we are executing on it
        item.ShouldDownload = false;
        global.torrents[torrentHash] = item;

        WriteMessage("Starting download for " + item.Name);

        // Finally execute the command
        self.ftps.exec(function(err, data) {
            if (err) {
                WriteMessage(err + " " + data.error + " " + data.data);
            } else {
                WriteMessage("LFTP Response: " + data.data);

                if (item.IsDirectory) {
                    // Make call to try and unrar the folder
                    self.unrar.HandleFolder(item.DownloadLocation + "/" + item.Name);
                }
            }

            // Call cleanup with the configurable delay, so external processes can do whatever they need.
            setTimeout(function() {
                WriteMessage("Relabelling " + item.Name);

                // Call to relabel the torrent
                self.rtorrent.setLabel(torrentHash, self.doneLabel, function() {
                    return;
                });

                // Remove the torrent from the global collection
                delete global.torrents[torrentHash];
            }, self.doneLabelDelay);

            // Mark that we are done downloading.
            global.isDownloading = false;

            self.DownloadNext();
        });
    }
};

// Method for just grabbing the next download and starting it if we are currently not downloading anything
Sync.prototype.DownloadNext = function() {
    // Check if we should try to download it immediately
    if (global.isDownloading == false) {
        var nextTorrentHash = GetNextTorrent();
        if (nextTorrentHash) {
            self.ProcessDownload(nextTorrentHash);
        }
    }
}

Sync.prototype.CheckTorrentComplete = function(hash) {
    self.rtorrent.getSingle(hash, function(err, data) {
        if (err) return console.log('err: ', err);
        if (data == 1) {
            global.torrents[hash].ShouldDownload = true;

            // Try to start download if we can
            self.DownloadNext();
        } else {
            // Otherwise check again in 15 seconds
            setTimeout(function() {
                self.CheckTorrentComplete(hash);
            }, 15000)
        }
    });
}

function GetNextTorrent() {
    var keys = Object.keys(global.torrents);
    if (keys.length > 0) {
        return keys.filter(function(key) {
            return global.torrents[key].ShouldDownload == true;
        })[0];
    }
    return null;
}

function WriteMessage(message, callback, isEnd) {
    console.log((new Date().toLocaleString()) + " - " + message.toString());
    if (callback) {
        callback(message, isEnd);
    }
}

module.exports = Sync;
