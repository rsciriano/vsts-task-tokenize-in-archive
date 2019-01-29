"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var mockrun = require("azure-pipelines-task-lib/mock-run");
var path = require("path");
var taskPath = path.join(__dirname, '../src/TokenizeInArchiveTask', 'TokenizeInArchive.js');
var runner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('PathToArchives', '/srcDir');
runner.setInput('Packages', 'AppSettings.zip');
runner.setInput('FilesToTokenize', '**/**/AppSettings.json');
var answers = {
    checkPath: {},
    find: {},
    findMatch: {}
};
answers.checkPath[path.normalize('/srcDir')] = true;
answers.find[path.normalize('/srcDir')] = [
    path.normalize('/srcDir'),
    path.normalize('/srcDir/AppSettings.zip'),
    path.normalize('/srcDir/someOtherDir'),
    path.normalize('/srcDir/someOtherDir/file1.file'),
    path.normalize('/srcDir/someOtherDir/file2.file'),
    path.normalize('/srcDir/someOtherDir2'),
    path.normalize('/srcDir/someOtherDir2/file1.file'),
    path.normalize('/srcDir/someOtherDir2/file2.file'),
    path.normalize('/srcDir/someOtherDir2/file3.file'),
    path.normalize('/srcDir/someOtherDir3'),
];
runner.setAnswers(answers);
runner.registerMockExport('stats', function (itemPath) {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize('/srcDir/someOtherDir'):
        case path.normalize('/srcDir/someOtherDir2'):
        case path.normalize('/srcDir/someOtherDir3'):
            return { isDirectory: function () { return true; } };
        case path.normalize('/srcDir/AppSettings.zip'):
        case path.normalize('/srcDir/someOtherDir/file1.file'):
        case path.normalize('/srcDir/someOtherDir/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file1.file'):
        case path.normalize('/srcDir/someOtherDir2/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file3.file'):
            return { isDirectory: function () { return false; } };
        default:
            throw { code: 'ENOENT' };
    }
});
var _readFile = fs.readFile;
var _createWriteStream = fs.createWriteStream;
fs.readFile = function (filename, cb) {
    if (filename == path.normalize('/srcDir/AppSettings.zip')) {
        //cb(null, new Buffer("fake contents"));
        _readFile(path.join(__dirname, 'samples/AppSettings.zip'), cb);
    }
    else {
        _readFile(filename, cb);
    }
};
fs.createWriteStream = function (filename) {
    if (filename == path.normalize('/srcDir/AppSettings.zip')) {
        //cb(null, new Buffer("fake contents"));
        return _createWriteStream(path.join(__dirname, 'samples/AppSettings_updated.zip'));
    }
    else {
        return _createWriteStream(filename);
    }
};
runner.registerMock('fs', fs);
// set variables
process.env["PROPERTY1"] = "Property1_Value";
process.env["PROPERTY2"] = "Property2_Value";
process.env["APPNAME"] = "RobApp";
runner.run();
