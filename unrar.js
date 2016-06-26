var fs = require('fs');
var path = require('path');
var rarModule = require('node-unrar');

function Unrar(config) {
    self = this;
};

// Method for checking if there are rar'd files to uncompress
Unrar.prototype.HandleFolder = function(folderPath) {
    //figure out path to the rar file, if there is one
    var rarFile = '';
    var files = fs.readdirSync(folderPath);

    for(var i in files) {
       if(path.extname(files[i]) === ".rar") {
           rarFile = files[i];
           break;
       }
    }

    var rar = new rarModule(rarFile);

    rar.extract(folderPath, null, function(err) {
        if (err) {
            console.log("Error in unrar for " + folderPath + " ERROR: " + err);
        } else {
            console.log(rarFile + " extracted");
        }
    });
}

module.exports = Unrar;
