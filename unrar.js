var rarModule = require('node-unrar');

function Unrar(config) {
    self = this;
};

// Method for checking if there are rar'd files to uncompress
Sync.prototype.HandleFolder = function(folderPath) {
    //figure out path to the rar file, if there is one
    var rarFile = '';
    var rar = new Unrar(rarFile);

    rar.extract(folderPath, null, function(err) {
        if (err) {
            console.log("Error in unrar for " + folderPath + " ERROR: " + err);
        } else {
            console.log(rarFile + " extracted");
        }
    });
}

module.exports = Unrar;
