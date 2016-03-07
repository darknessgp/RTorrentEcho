var FTPS = require('./lftp.js');
var Rtorrent = require('./rtorrent.js');

function Sync(config) {
    self = this;
    
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
};


Sync.prototype.sync = function (label, location, callback) {
    
    console.log("Getting Torrents");
    
    self.rtorrent.getTorrents(function (err, data) {
        if (err) return console.log('err: ', err);
        
        //    console.log(data);
        var torrents = data.filter(function (obj) {
            return obj.label === label;
        });

        console.log(torrents.length + " torrents with label " + label);
        
        // Loop over each and download
        torrents.forEach(function (item) {
            console.log(item.name + " found\n" + item.path);
            
            console.log("Testing lftp");
            
            // Mirror it for now, need to adjust so we detect if it is a directory or a single file.
            self.ftps.pget(item.path, location).exec(console.log);
        });

        console.log("Done");
    });
};

module.exports = Sync;